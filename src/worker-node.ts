import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parentPort, workerData } from 'node:worker_threads'
import { execute, type ModuleFactory } from './runtime.js'
import type { Job } from './types.js'

const port = parentPort
if (!port) throw new Error('Biber requires a Worker')
port.once('message', async (job: Job) => {
  try {
    // Parent owns the temporary directory and removes it even after forced termination.
    const filename = join(workerData.directory, 'runtime.mjs')
    await writeFile(filename, job.runtime.code)
    const loaded: { default: ModuleFactory } = await import(
      pathToFileURL(filename).href
    )
    globalThis.fetch = () =>
      Promise.reject(new Error('Network is disabled during Biber execution'))
    Object.defineProperty(globalThis, 'WebSocket', {
      value: class {
        constructor() {
          throw new Error('Network is disabled during Biber execution')
        }
      },
    })
    port.postMessage(await execute(job, loaded.default))
  } catch (error) {
    port.postMessage({
      ok: false,
      code: 'WORKER_FAILED',
      message: String(error),
      diagnostics: [],
    })
  }
})
