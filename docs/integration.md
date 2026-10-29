# Integration

Use a verified local package produced by the [distribution procedure](distribution.md).
The SDK has no public registry or CDN assumption. Serve its `dist/src/` modules
and `assets/` at stable URLs. Preserve relative Worker module paths.

## Browser

```js
import { createBiber } from '/vendor/wasmbiber/dist/src/index.js'
const manifest = await fetch('/vendor/wasmbiber/assets/manifest.json').then(r => r.json())
const biber = createBiber({
  assetBaseUrl: new URL('/vendor/wasmbiber/assets/', location.href),
  manifest,
})
try {
  await biber.warmUp()
  const result = await biber.run({ bcf: controlFile, bibFiles: { 'refs/library.bib': bibliography } })
  consumeBibliography(result.bbl)
} finally {
  await biber.dispose()
}
```

`controlFile`, `bibliography` and `consumeBibliography` belong to the host in
this integration sketch. The [browser example](../examples/browser/index.html)
is a runnable repository example. Browser use requires WebAssembly, module
Workers, Web Crypto and structured cloning of WebAssembly.Module. No threads,
SharedArrayBuffer or cross-origin isolation is required. CSP must allow module
Workers and the verified runtime's blob module (`worker-src 'self'`,
`script-src 'self' blob: 'wasm-unsafe-eval'`). Test the host's actual CSP.

## Node

```js
import { readFile } from 'node:fs/promises'
import { createBiber } from 'wasmbiber/node'
const assetBaseUrl = new URL('./node_modules/wasmbiber/assets/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('manifest.json', assetBaseUrl), 'utf8'))
const biber = createBiber({ assetBaseUrl, manifest })
try {
  const bbl = (await biber.run({
    bcf: await readFile('main.bcf', 'utf8'),
    bibFiles: { 'refs/library.bib': new Uint8Array(await readFile('refs/library.bib')) },
  })).bbl
  console.log(bbl)
} finally { await biber.dispose() }
```

Node 24 is the qualified Node target. A macOS shell can use this API or a
browser WebView with the browser API and HTTP(S) asset URLs. Custom application
URL schemes need a host adapter; WKWebView/Safari are not covered by the Chromium
qualification. A native-process backend is a separate
host choice, not something this SDK launches implicitly.

## wasmtex

Register a structurally compatible backend in the host's registry:

```js
backends.register(BIBER_STAGE, {
  id: 'wasmbiber', stage: BIBER_STAGE, location: 'client',
  version: manifest.id,
  async run(request) { return (await biber.run(request)).bbl },
})
```

This needs a wasmtex version admitting explicit local Biber executors. The
host passes the first TeX pass's `.bcf` and databases, writes the resulting
`.bbl`, then reruns TeX. SDK installation alone does not change the host's
routing. Use the full runtime identity for host caches, not just Biber's version.
See [API](api.md), [compatibility](compatibility.md) and [offline assets](offline.md).

A full PDF qualification is available as an optional interoperability test:

```sh
WASMTEX_MODULE_ROOT=/path/to/qualified-wasmtex/lib \
WASMTEX_PUBLIC_DIR=/path/to/wasmtex/public \
  node scripts/integration-wasmtex.mjs
```

It compiles an author-year document with accented names, same-author/year
disambiguation, nested bibliography paths and separate reference sections, edits
the bibliography, and recompiles. Both intermediate BBLs must equal independently
generated native Biber goldens. It requires the explicit client-backend registry
support described above; it does not modify or install a wasmtex checkout.
