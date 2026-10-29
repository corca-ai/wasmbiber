import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { sdkFingerprint } from './evidence.mjs'

const exec = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const packageRoot = process.env.WASMBIBER_PACKAGE_ROOT
  ? resolve(process.env.WASMBIBER_PACKAGE_ROOT)
  : root
const session = `wasmbiber-${process.pid}`
const browser = async (...args) => {
  const result = await exec(
    'agent-browser',
    ['--session', session, '--json', ...args],
    { timeout: 45000, maxBuffer: 4 * 1024 * 1024 },
  )
  const value = JSON.parse(result.stdout)
  if (!value.success) throw Error(JSON.stringify(value))
  return value.data
}
const evaluate = async (code) =>
  (await browser('eval', '-b', Buffer.from(code).toString('base64'))).result
const digest = (body) => createHash('sha256').update(body).digest('hex')
const fixtures = resolve(root, 'tests/fixtures')
const corpus = JSON.parse(
  await readFile(resolve(fixtures, 'corpus.json'), 'utf8'),
)
const cases = []
for (const item of corpus) {
  const oracle = JSON.parse(
    await readFile(resolve(fixtures, `native/${item.name}.json`), 'utf8'),
  )
  cases.push({
    name: item.name,
    nativeExit: oracle.exitCode,
    sha256:
      oracle.exitCode === 0
        ? digest(await readFile(resolve(fixtures, `native/${item.name}.bbl`)))
        : undefined,
    request: {
      bcf: await readFile(
        resolve(fixtures, `upstream/${item.name}.bcf`),
        'utf8',
      ),
      bibFiles: Object.fromEntries(
        await Promise.all(
          item.sources.map(async (name) => [
            name,
            [...(await readFile(resolve(fixtures, `upstream/${name}`)))],
          ]),
        ),
      ),
    },
  })
}
cases.push({
  name: 'document',
  nativeExit: 0,
  sha256: digest(await readFile(resolve(fixtures, 'document.bbl'))),
  request: JSON.parse(
    await readFile(resolve(fixtures, 'document.json'), 'utf8'),
  ),
})
const appFiles = [
  '/tests/browser/',
  '/tests/browser/app.js',
  '/browser-fixtures.json',
  '/assets/manifest.json',
  ...(await readdir(resolve(packageRoot, 'dist/src')))
    .filter((n) => n.endsWith('.js'))
    .map((n) => `/dist/src/${n}`),
]
const serviceWorker = `const name='wasmbiber-test-shell';self.addEventListener('install',e=>e.waitUntil(caches.open(name).then(c=>c.addAll(${JSON.stringify(appFiles)})).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(${JSON.stringify(appFiles)}.includes(new URL(e.request.url).pathname))e.respondWith(caches.open(name).then(c=>c.match(e.request)).then(r=>r||fetch(e.request)));});`
let requests = 0
const server = createServer(async (request, response) => {
  requests++
  const pathname = new URL(request.url, 'http://localhost').pathname
  try {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'",
    )
    if (pathname === '/browser-fixtures.json') {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ cases }))
      return
    }
    if (pathname === '/browser-sw.js') {
      response.setHeader('Content-Type', 'text/javascript')
      response.end(serviceWorker)
      return
    }
    const servingRoot =
      pathname.startsWith('/dist/') || pathname.startsWith('/assets/')
        ? packageRoot
        : root
    const path = resolve(
      servingRoot,
      `.${pathname}${pathname.endsWith('/') ? 'index.html' : ''}`,
    )
    if (!path.startsWith(servingRoot + sep)) {
      response.writeHead(403).end()
      return
    }
    const types = {
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.wasm': 'application/wasm',
      '.html': 'text/html',
      '.json': 'application/json',
    }
    response.setHeader(
      'Content-Type',
      types[extname(path)] || 'application/octet-stream',
    )
    response.end(await readFile(path))
  } catch {
    response.writeHead(404).end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const url = `http://127.0.0.1:${port}/tests/browser/`
async function waitReady() {
  for (let i = 0; i < 30; i++) {
    if (await evaluate('window.ready === true')) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  console.error(await browser('errors'))
  console.error(await browser('console'))
  throw Error('Browser app did not become ready')
}
async function waitResult() {
  const deadline = Date.now() + 240000
  while (Date.now() < deadline) {
    const result = await evaluate('window.result || null')
    if (result) {
      assert.equal(result.ok, true, JSON.stringify(result))
      return result
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw Error('Browser qualification timed out')
}
try {
  console.log('Browser qualification at', url, 'session', session)
  await browser('open', url)
  await waitReady()
  await evaluate('window.start(false); true')
  const online = await waitResult()
  console.log(
    `${online.results.length} online cases passed; stopping origin server`,
  )
  const beforeOffline = requests
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  // A new document and fresh SDK/Worker must load with the origin server stopped.
  await browser('tab', 'new', url)
  await waitReady()
  await evaluate('window.start(true); true')
  const offline = await waitResult()
  assert.equal(requests, beforeOffline)
  await mkdir(resolve(root, 'local-evaluation'), { recursive: true })
  await writeFile(
    resolve(
      root,
      packageRoot === root
        ? 'local-evaluation/browser.json'
        : 'local-evaluation/package-browser.json',
    ),
    JSON.stringify(
      {
        online,
        offline,
        sdk: await sdkFingerprint(
          pathToFileURL(resolve(packageRoot, 'dist/src') + sep),
        ),
        originServerStopped: true,
      },
      null,
      2,
    ),
  )
  console.log(
    `${online.results.length} browser cases; ${offline.results.length} offline cases; cancellation, failure and corrupt-cache recovery passed`,
  )
} finally {
  server.closeAllConnections()
  server.close()
  await browser('close').catch(() => {})
}
