import { type AssetSource, prepareRuntime } from './assets.js'
import { asBiberError, BiberError } from './errors.js'
import type {
  BiberRequest,
  BiberResult,
  ClientOptions,
  Job,
  PreparedRuntime,
  RunOptions,
  WorkerReply,
} from './types.js'
import { snapshotRequest } from './validation.js'
export interface WorkerHandle {
  post(job: Job): void
  terminate(): Promise<void>
}
export type WorkerFactory = (
  reply: (data: WorkerReply) => void,
  error: (cause: unknown) => void,
) => WorkerHandle
interface Pending {
  request: BiberRequest
  signal: AbortSignal | undefined
  abort: () => void
  resolve: (value: BiberResult) => void
  reject: (reason: unknown) => void
  started: number
  controller: AbortController
  settled: boolean
}
/** FIFO, bounded admission, one isolated interpreter job at a time. */
export class BiberClient {
  private prepared: PreparedRuntime | undefined
  private preparing: Promise<PreparedRuntime> | undefined
  private preparationAbort = new AbortController()
  private queue: Pending[] = []
  private current: Pending | undefined
  private disposed = false
  private shutdown: Promise<void> | undefined
  readonly runtimeId: string
  private readonly timeoutMs: number
  private readonly maxQueue: number
  private readonly maxBytes: number
  constructor(
    private readonly options: ClientOptions,
    private readonly source: AssetSource,
    private readonly createWorker: WorkerFactory,
  ) {
    this.options = { ...options, manifest: structuredClone(options.manifest) }
    this.runtimeId = this.options.manifest.id
    this.timeoutMs = options.timeoutMs ?? 30000
    this.maxQueue = options.maxQueue ?? 4
    this.maxBytes = options.maxInputBytes ?? 16 * 1024 * 1024
    for (const [name, n] of Object.entries({
      timeoutMs: this.timeoutMs,
      maxQueue: this.maxQueue,
      maxInputBytes: this.maxBytes,
    }))
      if (!Number.isSafeInteger(n) || n <= 0)
        throw new BiberError('INVALID_INPUT', `Invalid ${name}`)
  }
  get state(): 'idle' | 'preparing' | 'ready' | 'running' | 'disposed' {
    return this.disposed
      ? 'disposed'
      : this.current
        ? 'running'
        : this.prepared
          ? 'ready'
          : this.preparing
            ? 'preparing'
            : 'idle'
  }
  async warmUp(): Promise<void> {
    await this.prepare()
  }
  async offlineStatus() {
    this.assertOpen()
    return this.source.offlineStatus(this.options.manifest)
  }
  private assertOpen() {
    if (this.disposed)
      throw new BiberError('DISPOSED', 'Biber client is disposed')
  }
  private prepare(): Promise<PreparedRuntime> {
    this.assertOpen()
    if (this.prepared) return Promise.resolve(this.prepared)
    if (!this.preparing) {
      const timeout = setTimeout(
        () => this.preparationAbort.abort(),
        this.timeoutMs,
      )
      this.preparing = prepareRuntime(
        this.options.manifest,
        this.source,
        this.preparationAbort.signal,
      )
        .then((value) => {
          this.assertOpen()
          this.prepared = value
          return value
        })
        .catch((error) => {
          throw this.disposed
            ? new BiberError('DISPOSED', 'Biber client is disposed')
            : this.preparationAbort.signal.aborted
              ? new BiberError('TIMEOUT', 'Runtime preparation timed out')
              : asBiberError(error, 'ASSET_UNAVAILABLE')
        })
        .finally(() => {
          clearTimeout(timeout)
          // A failed asset must cancel sibling reads before their timeout is cleared.
          this.preparationAbort.abort()
          this.preparing = undefined
          if (!this.disposed) this.preparationAbort = new AbortController()
        })
    }
    return this.preparing
  }
  run(request: BiberRequest, options: RunOptions = {}): Promise<BiberResult> {
    try {
      this.assertOpen()
      if (options.signal?.aborted)
        throw new BiberError('ABORTED', 'Biber job was cancelled')
      if (this.queue.length >= this.maxQueue)
        throw new BiberError('QUEUE_FULL', 'Biber queue is full')
      const input = snapshotRequest(
        request,
        this.options.manifest,
        this.maxBytes,
      )
      return new Promise((resolve, reject) => {
        const task: Pending = {
          request: input,
          signal: options.signal,
          abort: () => {
            task.controller.abort()
          },
          controller: new AbortController(),
          resolve,
          reject,
          started: performance.now(),
          settled: false,
        }
        task.signal?.addEventListener('abort', task.abort, { once: true })
        task.controller.signal.addEventListener(
          'abort',
          () => {
            if (task !== this.current) {
              this.queue = this.queue.filter((t) => t !== task)
              this.finish(
                task,
                new BiberError(
                  this.disposed ? 'DISPOSED' : 'ABORTED',
                  'Biber job was cancelled',
                ),
              )
            }
          },
          { once: true },
        )
        this.queue.push(task)
        this.pump()
      })
    } catch (error) {
      return Promise.reject(error)
    }
  }
  private finish(task: Pending, error?: unknown, result?: BiberResult) {
    if (task.settled) return
    task.settled = true
    task.signal?.removeEventListener('abort', task.abort)
    if (error) task.reject(error)
    else if (result) task.resolve(result)
  }
  private pump() {
    if (this.current || this.disposed) return
    const task = this.queue.shift()
    if (!task) return
    this.current = task
    this.shutdown = this.execute(task).finally(() => {
      this.current = undefined
      this.pump()
    })
  }
  private async execute(task: Pending) {
    let worker: WorkerHandle | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let onAbort: (() => void) | undefined
    const begin = performance.now()
    try {
      // Register cancellation before preparation, including offline asset loading.
      const result = await new Promise<BiberResult>((resolve, reject) => {
        onAbort = () =>
          reject(
            new BiberError(
              this.disposed ? 'DISPOSED' : 'ABORTED',
              'Biber job was cancelled',
            ),
          )
        task.controller.signal.addEventListener('abort', onAbort, {
          once: true,
        })
        timer = setTimeout(
          () =>
            reject(
              new BiberError('TIMEOUT', 'Biber job exceeded its time limit'),
            ),
          this.timeoutMs,
        )
        void this.prepare()
          .then((runtime) => {
            if (task.controller.signal.aborted || task.settled || this.disposed)
              return
            worker = this.createWorker(
              (reply) => {
                if (!reply.ok) {
                  reject(
                    new BiberError(
                      reply.code,
                      reply.message,
                      reply.diagnostics,
                    ),
                  )
                  return
                }
                resolve({
                  bbl: reply.bbl,
                  diagnostics: reply.diagnostics,
                  runtimeId: this.runtimeId,
                  metrics: {
                    preparationMs:
                      performance.now() - begin - reply.executionMs,
                    executionMs: reply.executionMs,
                    totalMs: performance.now() - task.started,
                    wasmMemoryBytes: reply.wasmMemoryBytes,
                  },
                })
              },
              (error) => reject(asBiberError(error, 'WORKER_FAILED')),
            )
            worker.post({ request: task.request, runtime })
          })
          .catch(reject)
      })
      // Resolve only after termination: the next job cannot overlap this heap.
      await worker?.terminate()
      worker = undefined
      this.finish(task, undefined, result)
    } catch (error) {
      this.finish(task, asBiberError(error, 'WORKER_FAILED'))
    } finally {
      if (timer) clearTimeout(timer)
      if (onAbort) task.controller.signal.removeEventListener('abort', onAbort)
      await worker?.terminate().catch(() => {})
    }
  }
  async dispose(): Promise<void> {
    if (!this.disposed) {
      this.disposed = true
      this.preparationAbort.abort()
      for (const task of [...this.queue]) task.controller.abort()
      this.current?.controller.abort()
      this.prepared = undefined
    }
    await Promise.allSettled([this.shutdown, this.preparing])
  }
}
