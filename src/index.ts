import { browserAssets } from './browser-assets.js'
import { BiberClient, type WorkerFactory } from './client.js'
import type { ClientOptions, WorkerReply } from './types.js'
export function createBiber(options: ClientOptions): BiberClient {
  options = { ...options, manifest: structuredClone(options.manifest) }
  const createWorker: WorkerFactory = (reply, error) => {
    const worker = new Worker(new URL('./worker-browser.js', import.meta.url), {
      type: 'module',
      name: 'wasmbiber',
    })
    worker.onmessage = (event: MessageEvent<WorkerReply>) => reply(event.data)
    worker.onerror = (event) => error(new Error(event.message))
    worker.onmessageerror = () => error(new Error('Invalid Worker message'))
    return {
      post: (job) => worker.postMessage(job),
      async terminate() {
        worker.terminate()
      },
    }
  }
  return new BiberClient(options, browserAssets(options), createWorker)
}
export { BiberClient } from './client.js'
export { BiberError } from './errors.js'
export type {
  BiberRequest,
  BiberResult,
  ClientOptions,
  Diagnostic,
  OfflineStatus,
  RunOptions,
  RuntimeManifest,
} from './types.js'
