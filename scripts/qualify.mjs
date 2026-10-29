import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { BiberError, createBiber } from '../dist/src/node.js'
import { sdkFingerprint } from './evidence.mjs'

const assetBaseUrl = new URL('../assets/', import.meta.url)
const manifest = JSON.parse(
  await readFile(new URL('manifest.json', assetBaseUrl), 'utf8'),
)
const client = createBiber({
  assetBaseUrl,
  manifest,
  timeoutMs: 60000,
  maxQueue: 4,
})
const root = new URL('../tests/fixtures/', import.meta.url)
const corpus = JSON.parse(await readFile(new URL('corpus.json', root), 'utf8'))
const results = []
try {
  assert.equal((await client.offlineStatus()).ready, true)
  for (const item of corpus) {
    const bcf = await readFile(
      new URL(`upstream/${item.name}.bcf`, root),
      'utf8',
    )
    const bibFiles = Object.fromEntries(
      await Promise.all(
        item.sources.map(async (n) => [
          n,
          new Uint8Array(await readFile(new URL(`upstream/${n}`, root))),
        ]),
      ),
    )
    const oracle = JSON.parse(
      await readFile(new URL(`native/${item.name}.json`, root), 'utf8'),
    )
    try {
      const result = await client.run({ bcf, bibFiles })
      assert.equal(oracle.exitCode, 0, `${item.name}: native rejected`)
      const expected = await readFile(
        new URL(`native/${item.name}.bbl`, root),
        'utf8',
      )
      assert.equal(result.bbl, expected, `${item.name}: output differs`)
      if (oracle.log.includes('WARN -'))
        assert.ok(
          result.diagnostics.some((d) => d.severity === 'warning'),
          `${item.name}: native warnings must remain visible`,
        )
      results.push({
        name: item.name,
        ok: true,
        sha256: createHash('sha256').update(result.bbl).digest('hex'),
        ...result.metrics,
      })
    } catch (error) {
      if (
        oracle.exitCode !== 0 &&
        error instanceof BiberError &&
        error.code === 'BIBER_FAILED'
      )
        results.push({
          name: item.name,
          ok: true,
          nativeExit: oracle.exitCode,
          rejected: true,
        })
      else {
        results.push({ name: item.name, ok: false, message: error.message })
        console.error(
          item.name,
          error.code || error.name,
          error.message.slice(0, 800),
        )
      }
    }
  }
  const request = JSON.parse(
    await readFile(new URL('document.json', root), 'utf8'),
  )
  const expected = await readFile(new URL('document.bbl', root), 'utf8')
  assert.equal(
    (await client.run(request)).bbl,
    expected,
    'nested-path document',
  )
  const aborted = new AbortController()
  aborted.abort()
  await assert.rejects(client.run(request, { signal: aborted.signal }), {
    code: 'ABORTED',
  })
  const active = new AbortController()
  const work = client.run(request, { signal: active.signal })
  const reject = assert.rejects(work, { code: 'ABORTED' })
  setTimeout(() => active.abort(), 50)
  await reject
  assert.equal(
    (await client.run(request)).bbl,
    expected,
    'recovery after cancellation',
  )
  const failure = { ...request, bibFiles: {} }
  await assert.rejects(client.run(failure), { code: 'BIBER_FAILED' })
  assert.equal(
    (await client.run(request)).bbl,
    expected,
    'recovery after Biber error',
  )
  const limited = createBiber({ assetBaseUrl, manifest, timeoutMs: 2000 })
  try {
    await limited.warmUp()
    const large = {
      bcf: await readFile(new URL('large/large.bcf', root), 'utf8'),
      bibFiles: {
        'large.bib': new Uint8Array(
          await readFile(new URL('large/large.bib', root)),
        ),
      },
    }
    await assert.rejects(limited.run(large), { code: 'TIMEOUT' })
    assert.equal(
      (await limited.run(request)).bbl,
      expected,
      'recovery after hard timeout',
    )
  } finally {
    await limited.dispose()
  }
  await mkdir('local-evaluation', { recursive: true })
  await writeFile(
    'local-evaluation/qualification.json',
    JSON.stringify(
      { runtime: manifest.id, sdk: await sdkFingerprint(), results },
      null,
      2,
    ),
  )
  assert.equal(results.filter((r) => !r.ok).length, 0, 'native parity failures')
  console.log(
    `${results.length} native parity cases; lifecycle recovery passed`,
  )
} finally {
  await client.dispose()
}
