import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { arch, cpus, platform, release } from 'node:os'
import { resolve } from 'node:path'
import { Worker } from 'node:worker_threads'
import { gzipSync } from 'node:zlib'
import { createBiber } from '../dist/src/node.js'
import { sdkFingerprint } from './evidence.mjs'

const root = resolve(import.meta.dirname, '..')
const assets = resolve(root, 'assets')
const read = (name) => readFile(resolve(root, 'tests/fixtures', name), 'utf8')
const manifest = JSON.parse(
  await readFile(resolve(assets, 'manifest.json'), 'utf8'),
)
const client = createBiber({
  assetBaseUrl: new URL('../assets/', import.meta.url),
  manifest,
  timeoutMs: 60000,
})
const workload = [
  {
    name: 'document',
    request: JSON.parse(await read('document.json')),
    expected: await read('document.bbl'),
  },
  {
    name: 'names',
    request: {
      bcf: await read('upstream/names.bcf'),
      bibFiles: { 'names.bib': await read('upstream/names.bib') },
    },
    expected: await read('native/names.bbl'),
  },
  {
    name: '1000-references',
    request: {
      bcf: await read('large/large.bcf'),
      bibFiles: { 'large.bib': await read('large/large.bib') },
    },
    expected: await read('large/large.bbl'),
  },
]
const digest = (value) => createHash('sha256').update(value).digest('hex')
const repetitions = 5
async function sizes(directory, names) {
  const files = []
  for (const name of names) {
    const data = await readFile(resolve(directory, name))
    files.push({
      name,
      raw: data.length,
      gzip: gzipSync(data, { level: 9 }).length,
    })
  }
  return {
    files,
    raw: files.reduce((n, f) => n + f.raw, 0),
    gzip: files.reduce((n, f) => n + f.gzip, 0),
  }
}
async function measure(run) {
  const results = []
  for (const item of workload) {
    const samples = []
    for (let i = 0; i < repetitions; i++) {
      const started = performance.now()
      const result = await run(item.request)
      const totalMs = performance.now() - started
      assert.equal(result.bbl, item.expected, item.name)
      samples.push({ ...result.metrics, totalMs })
    }
    const times = samples.map((x) => x.totalMs).sort((a, b) => a - b)
    results.push({
      name: item.name,
      sha256: digest(item.expected),
      medianMs: times[Math.floor(times.length / 2)],
      minMs: times[0],
      maxMs: times.at(-1),
      samples,
    })
  }
  return results
}
const report = {
  environment: {
    node: process.version,
    platform: platform(),
    arch: arch(),
    release: release(),
    cpu: cpus()[0]?.model,
  },
  repetitions,
  sdk: await sdkFingerprint(),
  runtime: manifest.id,
}
try {
  if (process.env.BASELINE_ASSETS) {
    const directory = resolve(process.env.BASELINE_ASSETS)
    const before = performance.now()
    const module = await WebAssembly.compile(
      await readFile(resolve(directory, 'biber.wasm')),
    )
    report.baseline = {
      preparationMs: performance.now() - before,
      sizes: await sizes(directory, ['biber.js', 'biber.wasm', 'biber.data']),
      results: await measure(async (request) => {
        const worker = new Worker(
          new URL('./baseline-worker.cjs', import.meta.url),
        )
        try {
          const result = await new Promise((resolve, reject) => {
            worker.once('message', (value) =>
              value.error ? reject(Error(value.error)) : resolve(value),
            )
            worker.once('error', reject)
            worker.postMessage({ directory, module, request })
          })
          return {
            bbl: result.bbl,
            metrics: {
              executionMs: result.executionMs,
              wasmMemoryBytes: result.wasmMemoryBytes,
            },
          }
        } finally {
          await worker.terminate()
        }
      }),
    }
  }
  const before = performance.now()
  await client.warmUp()
  report.candidate = {
    preparationMs: performance.now() - before,
    sizes: await sizes(assets, Object.keys(manifest.files)),
    results: await measure((request) => client.run(request)),
  }
  report.repeated = []
  for (let i = 0; i < 25; i++) {
    const result = await client.run(workload[0].request)
    assert.equal(result.bbl, workload[0].expected)
    report.repeated.push({
      iteration: i + 1,
      rssBytes: process.memoryUsage().rss,
      ...result.metrics,
    })
  }
  await mkdir(resolve(root, 'local-evaluation'), { recursive: true })
  await writeFile(
    resolve(root, 'local-evaluation/benchmark.json'),
    JSON.stringify(report, null, 2),
  )
  console.log(
    JSON.stringify(
      {
        baseline: report.baseline?.results.map((x) => ({
          name: x.name,
          medianMs: x.medianMs,
        })),
        candidate: report.candidate.results.map((x) => ({
          name: x.name,
          medianMs: x.medianMs,
        })),
        sizes: report.candidate.sizes,
      },
      null,
      2,
    ),
  )
} finally {
  await client.dispose()
}
