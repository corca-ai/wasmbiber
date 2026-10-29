import { asBiberError, BiberError } from './errors.js'
import type { Diagnostic, Job, WorkerReply } from './types.js'

interface RuntimeFS {
  mkdirTree(path: string): void
  chdir(path: string): void
  createDataFile(
    parent: string,
    name: string,
    data: Uint8Array,
    readable: boolean,
    writable: boolean,
    own: boolean,
  ): void
  writeFile(path: string, data: string | Uint8Array): void
  readFile(path: string, options: { encoding: 'utf8' }): string
}
interface Module {
  FS: RuntimeFS
  callMain(args: string[]): number
}
interface ModuleOptions {
  noInitialRun: true
  print(line: string): void
  printErr(line: string): void
  locateFile(name: string): string
  instantiateWasm(
    imports: WebAssembly.Imports,
    callback: (
      instance: WebAssembly.Instance,
      module: WebAssembly.Module,
    ) => void,
  ): object
}
export type ModuleFactory = (options: ModuleOptions) => Promise<Module>
export async function execute(
  job: Job,
  factory: ModuleFactory,
): Promise<WorkerReply> {
  const start = performance.now()
  const diagnostics: Diagnostic[] = []
  let memory: WebAssembly.Memory | undefined
  const log = (line: string) => {
    if (diagnostics.length < 2000)
      diagnostics.push({
        severity: /^(ERROR|FATAL)\b/.test(line)
          ? 'error'
          : /^WARN\b/.test(line)
            ? 'warning'
            : 'info',
        message: line.slice(0, 4096),
      })
  }
  try {
    let rejectInstantiation: (cause: unknown) => void = () => {}
    const failed = new Promise<never>((_, reject) => {
      rejectInstantiation = reject
    })
    const module = await Promise.race([
      factory({
        noInitialRun: true,
        print: log,
        printErr: log,
        locateFile: () => {
          throw new BiberError('INTEGRITY', 'Unexpected runtime asset request')
        },
        instantiateWasm(imports, callback) {
          void WebAssembly.instantiate(job.runtime.module, imports)
            .then((instance) => {
              const exported = instance.exports.memory
              if (!(exported instanceof WebAssembly.Memory))
                throw new BiberError(
                  'INTEGRITY',
                  'Runtime memory export is missing',
                )
              memory = exported
              callback(instance, job.runtime.module)
            })
            .catch(rejectInstantiation)
          return {}
        },
      }),
      failed,
    ])
    for (const entry of job.runtime.files) {
      const slash = entry.path.lastIndexOf('/')
      const parent = entry.path.slice(0, slash)
      module.FS.mkdirTree(parent)
      module.FS.createDataFile(
        parent,
        entry.path.slice(slash + 1),
        job.runtime.data.subarray(entry.offset, entry.offset + entry.length),
        true,
        false,
        true,
      )
    }
    const cwd = '/home/web_user/biber'
    module.FS.chdir(cwd)
    for (const [name, body] of Object.entries({
      ...job.request.bibFiles,
      'main.bcf': job.request.bcf,
    })) {
      const slash = name.lastIndexOf('/')
      if (slash >= 0) module.FS.mkdirTree(`${cwd}/${name.slice(0, slash)}`)
      module.FS.writeFile(`${cwd}/${name}`, body)
    }
    let code: number
    try {
      code = module.callMain([
        '/opt/perl-wasm/bin/biber',
        '--noconf',
        '--nolog',
        'main.bcf',
      ])
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        typeof error.status === 'number'
      )
        code = error.status
      else throw error
    }
    if (code !== 0)
      throw new BiberError(
        'BIBER_FAILED',
        `Biber exited with status ${code}`,
        diagnostics,
      )
    const bbl = module.FS.readFile(`${cwd}/main.bbl`, { encoding: 'utf8' })
    if (bbl.length > 64 * 1024 * 1024)
      throw new BiberError(
        'BIBER_FAILED',
        'Bibliography output exceeds the supported limit',
        diagnostics,
      )
    return {
      ok: true,
      bbl,
      diagnostics,
      executionMs: performance.now() - start,
      wasmMemoryBytes: memory?.buffer.byteLength ?? 0,
    }
  } catch (error) {
    const e = asBiberError(error, 'BIBER_FAILED')
    return {
      ok: false,
      code: e.code,
      message: e.message,
      diagnostics: e.diagnostics.length ? [...e.diagnostics] : diagnostics,
    }
  }
}
