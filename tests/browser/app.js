import { createBiber } from '/dist/src/index.js'

const status = document.querySelector('#status')
const manifest = await fetch('/assets/manifest.json').then((r) => r.json())
const fixtures = await fetch('/browser-fixtures.json').then((r) => r.json())
for (const item of fixtures.cases) {
  for (const [name, body] of Object.entries(item.request.bibFiles))
    if (Array.isArray(body)) item.request.bibFiles[name] = new Uint8Array(body)
}
const options = {
  assetBaseUrl: new URL('/assets/', location.href),
  manifest,
  timeoutMs: 60000,
}
const check = (value, message) => {
  if (!value) throw Error(message)
}
async function hash(text) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
    ),
    (x) => x.toString(16).padStart(2, '0'),
  ).join('')
}
async function rejects(promise, code) {
  try {
    await promise
  } catch (error) {
    check(error.code === code, `${error.code}: ${error.message}`)
    return
  }
  throw Error(`Expected ${code}`)
}
async function run(offline) {
  const results = []
  let client = createBiber(options)
  let maxTickGap = 0
  let previous = performance.now()
  const heartbeat = setInterval(() => {
    const now = performance.now()
    maxTickGap = Math.max(maxTickGap, now - previous)
    previous = now
  }, 20)
  try {
    if (!offline) {
      for (const key of await caches.keys())
        if (key === `wasmbiber-${manifest.id}`) await caches.delete(key)
      check(
        !(await client.offlineStatus()).ready,
        'unexpected preexisting runtime cache',
      )
    }
    const cold = performance.now()
    await client.warmUp()
    const preparationMs = performance.now() - cold
    check((await client.offlineStatus()).ready, 'runtime is not cached')
    const cases = offline
      ? fixtures.cases.filter((x) =>
          [
            'names',
            'dateformats',
            'sections-complex',
            'encoding1',
            'labelalpha',
            'document',
          ].includes(x.name),
        )
      : fixtures.cases
    for (const item of cases) {
      status.textContent = `${offline ? 'Offline' : 'Online'}: ${item.name}`
      if (item.nativeExit !== 0) {
        await rejects(client.run(item.request), 'BIBER_FAILED')
        results.push({ name: item.name, rejected: true })
      } else {
        const result = await client.run(item.request)
        check(
          (await hash(result.bbl)) === item.sha256,
          `Native mismatch: ${item.name}`,
        )
        results.push({ name: item.name, ...result.metrics })
      }
    }
    const document = fixtures.cases.find((x) => x.name === 'document')
    const active = new AbortController()
    const cancelled = rejects(
      client.run(document.request, { signal: active.signal }),
      'ABORTED',
    )
    setTimeout(() => active.abort(), 50)
    await cancelled
    await rejects(
      client.run({ ...document.request, bibFiles: {} }),
      'BIBER_FAILED',
    )
    check(
      (await hash((await client.run(document.request)).bbl)) ===
        document.sha256,
      'failed recovery',
    )
    await client.dispose()
    const cache = await caches.open(`wasmbiber-${manifest.id}`)
    const url = new URL('/assets/biber.wasm', location.href)
    const saved = await cache.match(url)
    await cache.put(url, new Response(new Uint8Array([0])))
    client = createBiber(options)
    check(!(await client.offlineStatus()).ready, 'corrupt cache reported ready')
    if (offline) {
      await rejects(client.warmUp(), 'ASSET_UNAVAILABLE')
      await cache.put(url, saved)
    }
    await client.warmUp()
    check(
      (await hash((await client.run(document.request)).bbl)) ===
        document.sha256,
      'cache repair changed output',
    )
    if (!offline) {
      const memoryOnly = createBiber({ ...options, cache: 'memory' })
      try {
        check(
          (await hash((await memoryOnly.run(document.request)).bbl)) ===
            document.sha256,
          'memory-only mode output',
        )
        check(
          !(await memoryOnly.offlineStatus()).ready,
          'memory-only mode must not claim persistent readiness',
        )
      } finally {
        await memoryOnly.dispose()
      }
    }
    check(maxTickGap < 1000, `UI blocked for ${maxTickGap}ms`)
    const report = {
      ok: true,
      offline,
      runtime: manifest.id,
      userAgent: navigator.userAgent,
      preparationMs,
      maxTickGap,
      results,
    }
    window.result = report
    status.textContent = JSON.stringify(report, null, 2)
  } finally {
    clearInterval(heartbeat)
    await client.dispose()
  }
}
window.start = (offline = false) => {
  window.result = undefined
  run(offline).catch((error) => {
    window.result = { ok: false, message: error.message, stack: error.stack }
    status.textContent = JSON.stringify(window.result, null, 2)
  })
}
await navigator.serviceWorker.register('/browser-sw.js')
await navigator.serviceWorker.ready
if (!navigator.serviceWorker.controller)
  await new Promise((resolve) =>
    navigator.serviceWorker.addEventListener('controllerchange', resolve, {
      once: true,
    }),
  )
window.ready = true
status.textContent = 'Ready'
