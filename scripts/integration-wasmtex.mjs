import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createBiber } from '../dist/src/node.js'

if (!process.env.WASMTEX_MODULE_ROOT || !process.env.WASMTEX_PUBLIC_DIR)
  throw Error(
    'Set WASMTEX_MODULE_ROOT (directory containing node.js/headless.js) and WASMTEX_PUBLIC_DIR explicitly',
  )
const sdk = pathToFileURL(
  path.resolve(process.env.WASMTEX_MODULE_ROOT) + path.sep,
)
const { installNodeWorkerHost, WasmTexCompiler } = await import(
  new URL('node.js', sdk)
)
const { BackendRegistry, BIBER_STAGE } = await import(
  new URL('headless.js', sdk)
)
const assetDirectory = new URL('../assets/', import.meta.url)
const manifest = JSON.parse(
  fs.readFileSync(new URL('manifest.json', assetDirectory), 'utf8'),
)
const biberClient = createBiber({ assetBaseUrl: assetDirectory, manifest })
const runBiber = (request) => biberClient.run(request)
const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, 'local-evaluation', 'wasmtex-integration')
fs.mkdirSync(out, { recursive: true })
const bib = `@article{knuth, author={Knuth, Donald E.}, title={Literate Programming}, journaltitle={The Computer Journal}, year={1984}, volume={27}, number={2}, pages={97--111}, doi={10.1093/comjnl/27.2.97}}
@book{doe2024, author={Doe, Jane}, title={A First Study}, date={2024}, publisher={Research Press}}
@book{doe2024b, author={Doe, Jane}, title={A Second Study}, date={2024}, publisher={Research Press}}
@article{accent, author={Müller, Jörg and García, María}, title={Multilingual Research}, journaltitle={Methods}, date={2023}, pages={1--12}}`
const tex = String.raw`\documentclass{article}
\usepackage[backend=biber,style=authoryear,sorting=nyt]{biblatex}
\addbibresource{refs/library.bib}
\begin{document}
\section{Offline bibliography qualification}
Programming: \autocite{knuth}. Two studies: \autocite{doe2024,doe2024b}. Names: \autocite{accent}.
\printbibliography
\begin{refsection}
A separate section: \autocite{doe2024b}.
\printbibliography[heading=subbibliography]
\end{refsection}
\end{document}`
const cases = [
  { name: 'original', bib },
  {
    name: 'edited',
    bib: bib
      .replace('A Second Study', 'A Revised Study')
      .replace('date={2024}', 'date={2025}'),
  },
]
const assetBaseUrl = 'http://wasmtex.local/'
const host = installNodeWorkerHost({
  publicDir: process.env.WASMTEX_PUBLIC_DIR,
  assetBaseUrl,
})
let current = 'original',
  calls = 0
const backendResults = []
const backends = new BackendRegistry()
backends.register(BIBER_STAGE, {
  id: 'wasmbiber',
  stage: BIBER_STAGE,
  location: 'client',
  version: manifest.id,
  async run(request) {
    calls++
    fs.writeFileSync(
      path.join(out, `${current}.request.json`),
      JSON.stringify(request),
    )
    const result = await runBiber(request)
    backendResults.push({ case: current, ...result.metrics })
    fs.writeFileSync(path.join(out, `${current}.bbl`), result.bbl)
    return result.bbl
  },
})
const compiler = new WasmTexCompiler({
  engine: 'pdflatex',
  texliveVersion: '2026',
  assetBaseUrl,
  files: { 'main.tex': tex, 'refs/library.bib': bib },
  backends,
})
try {
  await compiler.init()
  const results = []
  for (const item of cases) {
    current = item.name
    if (item.name !== 'original') compiler.setFile('refs/library.bib', item.bib)
    const started = performance.now()
    let result = await compiler.compile()
    if (/Please rerun LaTeX|Label\(s\) may have changed/.test(result.log))
      result = await compiler.compile()
    assert.equal(result.success, true, JSON.stringify(result.errors))
    assert.ok(result.pdf?.length > 1000)
    const expected = fs.readFileSync(
      path.join(
        root,
        'tests/fixtures',
        current === 'original' ? 'document.bbl' : 'document-edited.bbl',
      ),
      'utf8',
    )
    assert.equal(
      fs.readFileSync(path.join(out, `${current}.bbl`), 'utf8'),
      expected,
    )
    fs.writeFileSync(path.join(out, `${current}.log`), result.log)
    if (result.pdf)
      fs.writeFileSync(path.join(out, `${current}.pdf`), result.pdf)
    results.push({
      name: current,
      success: result.success,
      pdfBytes: result.pdf?.length,
      errors: result.errors,
      timeMs: performance.now() - started,
      calls,
    })
  }
  fs.writeFileSync(
    path.join(out, 'summary.json'),
    JSON.stringify({ results, backendResults }, null, 2),
  )
  console.log(JSON.stringify({ results, backendResults }))
} finally {
  compiler.dispose()
  host.dispose()
  await biberClient.dispose()
}
