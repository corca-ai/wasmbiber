import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const directory = resolve(process.argv[2] || 'assets')
const files = {}
for (const name of [
  'runtime.mjs',
  'biber.wasm',
  'biber.data',
  'filesystem.json',
]) {
  const bytes = await readFile(resolve(directory, name))
  files[name] = {
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}
const digest = createHash('sha256').update(JSON.stringify(files)).digest('hex')
const manifest = {
  schema: 1,
  id: `biber-2.22-${digest.slice(0, 24)}`,
  biber: '2.22',
  bcf: '3.11',
  files,
}
await writeFile(
  resolve(directory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
console.log(manifest.id)
