// Optional comparison adapter for the original fixed TeXlyre runtime, not shipped.
const { parentPort } = require('node:worker_threads')
const path = require('node:path')
parentPort.once('message', async ({ directory, module, request }) => {
  const started = performance.now()
  let memory
  const logs = []
  try {
    const factory = require(path.join(directory, 'biber.js'))
    const runtime = await factory({
      noInitialRun: true,
      locateFile: (name) => path.join(directory, name),
      instantiateWasm(imports, done) {
        WebAssembly.instantiate(module, imports)
          .then((instance) => {
            memory = instance.exports.memory
            done(instance, module)
          })
          .catch((error) => parentPort.postMessage({ error: String(error) }))
        return {}
      },
      print: (line) => logs.push(line),
      printErr: (line) => logs.push(line),
    })
    const cwd = '/home/web_user/biber'
    runtime.FS.chdir(cwd)
    for (const [name, data] of Object.entries({
      ...request.bibFiles,
      'main.bcf': request.bcf,
    })) {
      const slash = name.lastIndexOf('/')
      if (slash >= 0) runtime.FS.mkdirTree(`${cwd}/${name.slice(0, slash)}`)
      runtime.FS.writeFile(`${cwd}/${name}`, data)
    }
    const code = runtime.callMain([
      '/opt/perl-wasm/bin/biber',
      '--noconf',
      '--nolog',
      'main.bcf',
    ])
    if (code) throw Error(`Biber returned ${code}: ${logs.join('\n')}`)
    parentPort.postMessage({
      bbl: runtime.FS.readFile(`${cwd}/main.bbl`, { encoding: 'utf8' }),
      executionMs: performance.now() - started,
      wasmMemoryBytes: memory.buffer.byteLength,
    })
  } catch (error) {
    parentPort.postMessage({ error: String(error) })
  }
})
