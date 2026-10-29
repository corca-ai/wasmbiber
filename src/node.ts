import { mkdtempSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { verify } from './assets.js'
import { BiberClient, type WorkerFactory } from './client.js'
import { BiberError } from './errors.js'
import type { ClientOptions } from './types.js'
export function createBiber(options: ClientOptions): BiberClient {
  options = { ...options, manifest: structuredClone(options.manifest) }
  const base = new URL(options.assetBaseUrl)
  if (base.protocol !== 'file:' || !base.pathname.endsWith('/'))
    throw new BiberError(
      'INVALID_INPUT',
      'Node assetBaseUrl must be a file directory URL',
    )
  const createWorker: WorkerFactory = (reply, error) => {
    const directory = mkdtempSync(join(tmpdir(), 'wasmbiber-'))
    let worker: Worker
    try {
      worker = new Worker(new URL('./worker-node.js', import.meta.url), {
        workerData: { directory },
      })
    } catch (cause) {
      void rm(directory, { recursive: true, force: true })
      throw cause
    }
    let done = false
    worker.on('message', (value) => {
      done = true
      reply(value)
    })
    worker.on('error', error)
    worker.on('exit', (code) => {
      if (!done)
        error(new Error(`Biber Worker exited before a result (${code})`))
    })
    return {
      post: (job) => worker.postMessage(job),
      async terminate() {
        done = true
        try {
          await worker.terminate()
        } finally {
          await rm(directory, { recursive: true, force: true })
        }
      },
    }
  }
  return new BiberClient(
    options,
    {
      async read(name, signal) {
        return new Uint8Array(await readFile(new URL(name, base), { signal }))
      },
      async offlineStatus(manifest) {
        const missing: string[] = []
        for (const [name, record] of Object.entries(manifest.files)) {
          try {
            await verify(
              new Uint8Array(await readFile(new URL(name, base))),
              record,
            )
          } catch {
            missing.push(name)
          }
        }
        return { ready: !missing.length, missing }
      },
    },
    createWorker,
  )
}
export { BiberClient } from './client.js'
export { BiberError } from './errors.js'
export type {
  BiberRequest,
  BiberResult,
  ClientOptions,
  RunOptions,
  RuntimeManifest,
} from './types.js'
