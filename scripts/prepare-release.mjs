import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const json = async (name) =>
  JSON.parse(await readFile(resolve(root, name), 'utf8'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const pkg = await json('package.json')
const receipt = await json('local-evaluation/distribution/release.json')
const manifest = await json('assets/manifest.json')
const toolchain = await json('.cache/toolchain-receipt.json')
assert.equal(pkg.private, true, 'Keep registry publication guarded')
assert.equal(receipt.runtime, manifest.id)
assert.equal(receipt.archive.name, `${pkg.name}-${pkg.version}.tgz`)
assert.equal(receipt.consumer, 'passed')
assert.equal(receipt.packagedBrowser, 'passed')
assert.deepEqual(toolchain.toolchain, await json('engine/toolchain.lock.json'))
const items = [
  [
    `local-evaluation/distribution/${receipt.archive.name}`,
    receipt.archive.name,
    receipt.archive,
  ],
  [`assets/${receipt.source.name}`, receipt.source.name, receipt.source],
  ['.cache/toolchain.tar.gz', 'wasmbiber-toolchain.tar.gz', toolchain],
  ['engine/toolchain.lock.json', 'toolchain.lock.json'],
  ['engine/packages.lock.txt', 'packages.lock.txt'],
  ['local-evaluation/distribution/release.json', 'release.json'],
  ['LICENSE', 'LICENSE'],
  ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
  ['CHANGELOG.md', 'CHANGELOG.md'],
]
const output = resolve(root, 'local-evaluation/public-release')
await mkdir(output, { recursive: true })
const sums = []
for (const [input, name, expected] of items) {
  const bytes = await readFile(resolve(root, input))
  const sha256 = hash(bytes)
  if (expected) {
    assert.equal(bytes.length, expected.bytes)
    assert.equal(sha256, expected.sha256, `Artifact integrity: ${input}`)
  }
  await cp(resolve(root, input), resolve(output, name))
  sums.push(`${sha256}  ${name}`)
}
await writeFile(resolve(output, 'SHA256SUMS'), `${sums.join('\n')}\n`)
console.log(
  `Prepared ${items.length} artifacts and SHA256SUMS in ${output}; nothing published`,
)
