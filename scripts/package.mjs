import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { verify } from '../dist/src/assets.js'
import { sdkFingerprint } from './evidence.mjs'

const exec = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
for (const command of ['build', 'lint', 'test']) {
  await exec('bun', ['run', command], {
    cwd: root,
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  })
}
await exec(process.execPath, ['scripts/check-doc-links.mjs'], { cwd: root })
const out = resolve(root, 'local-evaluation/distribution')
const json = async (path) =>
  JSON.parse(await readFile(resolve(root, path), 'utf8'))
const manifest = await json('assets/manifest.json')
const sdk = await sdkFingerprint()
const native = await json('local-evaluation/qualification.json')
const browser = await json('local-evaluation/browser.json')
const benchmark = await json('local-evaluation/benchmark.json')
assert.equal(native.runtime, manifest.id)
assert.equal(native.sdk, sdk, 'Rerun native qualification for the current SDK')
assert.equal(
  native.results.length,
  (await json('tests/fixtures/corpus.json')).length,
)
assert.ok(native.results.every((x) => x.ok))
assert.equal(
  browser.sdk,
  sdk,
  'Rerun browser qualification for the current SDK',
)
assert.ok(
  browser.originServerStopped && browser.online.ok && browser.offline.ok,
)
assert.equal(browser.online.runtime, manifest.id)
assert.equal(browser.offline.runtime, manifest.id)
assert.equal(benchmark.runtime, manifest.id)
assert.equal(benchmark.sdk, sdk, 'Rerun benchmark for the current SDK')
assert.equal(benchmark.candidate.results.length, 3)
for (const [name, expected] of Object.entries(manifest.files))
  await verify(
    new Uint8Array(await readFile(resolve(root, 'assets', name))),
    expected,
  )
const sourceName = 'wasmbiber-corresponding-source.tar.gz'
for (const name of [
  'source-bundle.sh',
  'fetch-sources.py',
  'container-build.sh',
  'Dockerfile',
  'packages.lock.txt',
  'sources.lock.json',
  'toolchain.lock.json',
  'build-runtime.sh',
  'link-runtime.sh',
  'package-runtime.py',
  'wasm-platform.c',
  'vendor/biber/build_xs.sh',
  'vendor/biber/build_biber.sh',
]) {
  const packedSource = await exec(
    'tar',
    ['-xOf', resolve(out, sourceName), `./engine/${name}`],
    { maxBuffer: 4 * 1024 * 1024 },
  )
  assert.equal(
    packedSource.stdout,
    await readFile(resolve(root, 'engine', name), 'utf8'),
    `Corresponding source is stale: ${name}`,
  )
}
// Check the complete public source tree, not only selected engine recipes.
const sourceTree = await mkdtemp(resolve(tmpdir(), 'wasmbiber-source-check-'))
try {
  await exec('tar', ['-xzf', resolve(out, sourceName), '-C', sourceTree])
  const tracked = (await exec('git', ['ls-files', '-z'], { cwd: root })).stdout
    .split('\0')
    .filter((name) => name && name !== 'CLAUDE.md')
  for (const name of tracked) {
    assert.deepEqual(
      await readFile(resolve(sourceTree, 'sdk-source', name)),
      await readFile(resolve(root, name)),
      `Corresponding SDK source is stale: ${name}`,
    )
  }
} finally {
  await rm(sourceTree, { recursive: true, force: true })
}
const source = await readFile(resolve(out, sourceName))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
await cp(resolve(out, sourceName), resolve(root, 'assets', sourceName))
await mkdir(resolve(root, 'assets/licenses'), { recursive: true })
await cp(
  resolve(root, 'engine/vendor/LICENSE'),
  resolve(root, 'assets/licenses/TEXLYRE-AGPL-3.0.txt'),
)
await cp(
  resolve(root, 'tests/fixtures/BIBER-LICENSE'),
  resolve(root, 'assets/licenses/BIBER-Artistic-2.0.txt'),
)
const provenance = {
  schema: 1,
  runtime: manifest.id,
  sdk,
  source: { name: sourceName, bytes: source.length, sha256: hash(source) },
  sourcesLock: hash(await readFile(resolve(root, 'engine/sources.lock.json'))),
  toolchain: await json('engine/toolchain.lock.json'),
}
await writeFile(
  resolve(root, 'assets/provenance.json'),
  `${JSON.stringify(provenance, null, 2)}\n`,
)
const packed = JSON.parse(
  (
    await exec(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', out],
      { cwd: root, maxBuffer: 4 * 1024 * 1024 },
    )
  ).stdout,
)[0]
const archive = resolve(out, packed.filename)
const consumer = await mkdtemp(resolve(tmpdir(), 'wasmbiber-consumer-'))
try {
  await mkdir(resolve(consumer, 'node_modules/wasmbiber'), { recursive: true })
  await exec('tar', [
    '-xzf',
    archive,
    '-C',
    resolve(consumer, 'node_modules/wasmbiber'),
    '--strip-components=1',
  ])
  await writeFile(resolve(consumer, 'package.json'), '{"type":"module"}')
  await cp(
    resolve(root, 'tests/fixtures/document.json'),
    resolve(consumer, 'request.json'),
  )
  await cp(
    resolve(root, 'tests/fixtures/document.bbl'),
    resolve(consumer, 'expected.bbl'),
  )
  await writeFile(
    resolve(consumer, 'test.mjs'),
    `import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBiber } from 'wasmbiber/node';
const assetBaseUrl = new URL('./node_modules/wasmbiber/assets/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', assetBaseUrl), 'utf8'));
const client = createBiber({ assetBaseUrl, manifest });
try { const request = JSON.parse(await readFile('request.json', 'utf8')); assert.equal((await client.run(request)).bbl, await readFile('expected.bbl', 'utf8')); } finally { await client.dispose(); }
console.log('Isolated package consumer passed');`,
  )
  const result = await exec(process.execPath, ['test.mjs'], {
    cwd: consumer,
    timeout: 60000,
  })
  console.log(result.stdout.trim())
  await exec(process.execPath, ['scripts/browser-test.mjs'], {
    cwd: root,
    timeout: 300000,
    maxBuffer: 4 * 1024 * 1024,
    env: {
      ...process.env,
      WASMBIBER_PACKAGE_ROOT: resolve(consumer, 'node_modules/wasmbiber'),
    },
  })
  const packagedBrowser = await json('local-evaluation/package-browser.json')
  assert.equal(packagedBrowser.sdk, sdk)
  assert.equal(packagedBrowser.online.runtime, manifest.id)
  assert.ok(
    packagedBrowser.online.ok &&
      packagedBrowser.offline.ok &&
      packagedBrowser.originServerStopped,
  )
  const receipt = {
    ...provenance,
    archive: {
      name: packed.filename,
      bytes: packed.size,
      sha256: hash(await readFile(archive)),
    },
    consumer: 'passed',
    packagedBrowser: 'passed',
    qualification: {
      nativeCases: native.results.length,
      browserCases: browser.online.results.length,
      offlineCases: browser.offline.results.length,
    },
  }
  await writeFile(
    resolve(out, 'release.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
  )
  console.log(archive)
} finally {
  await rm(consumer, { recursive: true, force: true })
}
