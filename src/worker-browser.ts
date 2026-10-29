import { execute, type ModuleFactory } from './runtime.js'
import type { Job, WorkerReply } from './types.js'

// This module is instantiated in a dedicated Worker, never on the UI thread.
const host = globalThis as unknown as {
  onmessage: ((event: MessageEvent<Job>) => void) | null
  postMessage: (reply: WorkerReply) => void
}
let used = false
host.onmessage = async (event) => {
  if (used) return
  used = true
  const url = URL.createObjectURL(
    new Blob([event.data.runtime.code], { type: 'text/javascript' }),
  )
  try {
    const loaded: { default: ModuleFactory } = await import(url)
    // Assets are already verified. Executing bibliography jobs never accesses the network.
    globalThis.fetch = () =>
      Promise.reject(new Error('Network is disabled during Biber execution'))
    Object.defineProperty(globalThis, 'WebSocket', {
      value: class {
        constructor() {
          throw new Error('Network is disabled during Biber execution')
        }
      },
    })
    Object.defineProperty(globalThis, 'XMLHttpRequest', {
      value: class {
        constructor() {
          throw new Error('Network is disabled during Biber execution')
        }
      },
    })
    host.postMessage(await execute(event.data, loaded.default))
  } catch (error) {
    host.postMessage({
      ok: false,
      code: 'WORKER_FAILED',
      message: String(error),
      diagnostics: [],
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
