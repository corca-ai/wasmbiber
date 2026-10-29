import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type AssetSource, verify } from '../src/assets.js'
import { BiberClient, type WorkerFactory } from '../src/client.js'
import type { RuntimeManifest, WorkerReply } from '../src/types.js'

const bcf = '<bcf:controlfile version="3.11"></bcf:controlfile>'
const input = { bcf, bibFiles: { 'a.bib': 'original' } }
async function setup(options: { timeoutMs?: number; maxQueue?: number } = {}) {
  const enc = new TextEncoder()
  const blobs: Record<string, Uint8Array> = {
    'runtime.mjs': enc.encode('export default 0'),
    'biber.wasm': new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
    'biber.data': enc.encode('x'),
    'filesystem.json': enc.encode(
      '[{"path":"/opt/perl-wasm/a","offset":0,"length":1}]',
    ),
  }
  const files: Record<string, { bytes: number; sha256: string }> = {}
  for (const [name, bytes] of Object.entries(blobs)) {
    const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
    files[name] = {
      bytes: bytes.length,
      sha256: Buffer.from(hash).toString('hex'),
    }
  }
  const manifest = {
    schema: 1,
    id: 'test',
    biber: '2.22',
    bcf: '3.11',
    files,
  } as RuntimeManifest
  let reads = 0
  let live = 0
  let maxLive = 0
  let terminated = 0
  const jobs: { reply: (data: WorkerReply) => void; body: string }[] = []
  const source: AssetSource = {
    async read(name) {
      reads++
      const b = blobs[name]
      if (!b) throw Error(name)
      return b
    },
    async offlineStatus() {
      return { ready: false, missing: ['all'] }
    },
  }
  const factory: WorkerFactory = (reply) => {
    live++
    maxLive = Math.max(maxLive, live)
    return {
      post(job) {
        const body = job.request.bibFiles['a.bib']
        jobs.push({
          reply,
          body:
            typeof body === 'string' ? body : new TextDecoder().decode(body),
        })
      },
      async terminate() {
        live--
        terminated++
      },
    }
  }
  const client = new BiberClient(
    { assetBaseUrl: 'https://example.test/', manifest, ...options },
    source,
    factory,
  )
  const complete = (i = 0) => {
    const job = jobs[i]
    assert.ok(job)
    job.reply({
      ok: true,
      bbl: job.body,
      diagnostics: [],
      executionMs: 1,
      wasmMemoryBytes: 100,
    })
  }
  const wait = async (n: number) => {
    for (let i = 0; i < 100 && jobs.length < n; i++)
      await new Promise((r) => setTimeout(r, 1))
    assert.equal(jobs.length, n)
  }
  return {
    client,
    complete,
    wait,
    jobs,
    source,
    blobs,
    manifest,
    stats: () => ({ reads, live, maxLive, terminated }),
  }
}
test('FIFO snapshots, shared verified preparation and non-overlapping workers', async () => {
  const s = await setup()
  const first = s.client.run(input)
  await s.wait(1)
  const mutable = { bcf, bibFiles: { 'a.bib': 'second' } }
  const second = s.client.run(mutable)
  mutable.bibFiles['a.bib'] = 'mutated'
  s.complete()
  assert.equal((await first).bbl, 'original')
  await s.wait(2)
  s.complete(1)
  assert.equal((await second).bbl, 'second')
  assert.deepEqual(s.stats(), { reads: 4, live: 0, maxLive: 1, terminated: 2 })
  await s.client.dispose()
})
test('queued cancellation releases admission and never reaches an interpreter', async () => {
  const s = await setup({ maxQueue: 1 })
  const first = s.client.run(input)
  await s.wait(1)
  const controller = new AbortController()
  const second = s.client.run(input, { signal: controller.signal })
  const rejection = assert.rejects(second, { code: 'ABORTED' })
  await assert.rejects(s.client.run(input), { code: 'QUEUE_FULL' })
  controller.abort()
  await rejection
  s.complete()
  await first
  assert.equal(s.jobs.length, 1)
  await s.client.dispose()
})
test('active cancellation terminates before the following job starts', async () => {
  const s = await setup()
  const controller = new AbortController()
  const first = s.client.run(input, { signal: controller.signal })
  const rejection = assert.rejects(first, { code: 'ABORTED' })
  await s.wait(1)
  const second = s.client.run(input)
  controller.abort()
  await rejection
  await s.wait(2)
  s.complete(1)
  await second
  assert.equal(s.stats().maxLive, 1)
  await s.client.dispose()
})
test('timeouts and failed executions do not poison later jobs', async () => {
  const s = await setup({ timeoutMs: 50 })
  await s.client.warmUp()
  await assert.rejects(s.client.run(input), { code: 'TIMEOUT' })
  const next = s.client.run(input)
  await s.wait(2)
  s.complete(1)
  await next
  await s.client.dispose()
})
test('dispose rejects all work and is idempotent', async () => {
  const s = await setup()
  const first = s.client.run(input)
  const a = assert.rejects(first, { code: 'DISPOSED' })
  await s.wait(1)
  const second = s.client.run(input)
  const b = assert.rejects(second, { code: 'DISPOSED' })
  await s.client.dispose()
  await Promise.all([a, b])
  await s.client.dispose()
  assert.equal(s.stats().live, 0)
  await assert.rejects(s.client.run(input), { code: 'DISPOSED' })
})
test('bad assets never execute and a corrected subsequent load can recover', async () => {
  const s = await setup()
  const original = s.blobs['biber.data']
  assert.ok(original)
  s.blobs['biber.data'] = new Uint8Array([0])
  await assert.rejects(s.client.run(input), { code: 'INTEGRITY' })
  assert.equal(s.jobs.length, 0)
  s.blobs['biber.data'] = original
  const next = s.client.run(input)
  await s.wait(1)
  s.complete()
  await next
  await s.client.dispose()
})
test('asset digests detect changes even when lengths match', async () => {
  await assert.rejects(
    verify(new Uint8Array([1]), { bytes: 1, sha256: '0'.repeat(64) }),
    { code: 'INTEGRITY' },
  )
})

test('late asset completion cannot spawn a worker after cancellation or disposal', async () => {
  const s = await setup()
  const read = s.source.read
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  s.source.read = async (name, signal) => {
    await gate
    return read(name, signal)
  }
  const controller = new AbortController()
  const cancelled = assert.rejects(
    s.client.run(input, { signal: controller.signal }),
    { code: 'ABORTED' },
  )
  controller.abort()
  await cancelled
  const disposed = s.client.dispose()
  release()
  await disposed
  assert.equal(s.jobs.length, 0)
  assert.equal(s.client.state, 'disposed')
})

test('caller manifest mutation cannot switch the validated runtime', async () => {
  const s = await setup()
  s.manifest.bcf = 'changed'
  s.manifest.files['biber.data'].sha256 = '0'.repeat(64)
  const job = s.client.run(input)
  await s.wait(1)
  s.complete()
  assert.equal((await job).bbl, 'original')
  await s.client.dispose()
})

test('a failed preparation cancels sibling downloads instead of leaving unbounded reads', async () => {
  const s = await setup()
  let pending = 0
  s.source.read = async (name, signal) => {
    if (name === 'runtime.mjs') throw Error('offline')
    pending++
    return new Promise((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          pending--
          reject(Error('cancelled sibling'))
        },
        { once: true },
      )
    })
  }
  await assert.rejects(s.client.warmUp(), { code: 'ASSET_UNAVAILABLE' })
  assert.equal(pending, 0)
  assert.equal(s.jobs.length, 0)
  await s.client.dispose()
})
