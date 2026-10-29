import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'

export async function sdkFingerprint(
  directory = new URL('../dist/src/', import.meta.url),
) {
  const digest = createHash('sha256')
  for (const name of (await readdir(directory))
    .filter((n) => n.endsWith('.js'))
    .sort()) {
    digest.update(name)
    digest.update(await readFile(new URL(name, directory)))
  }
  return digest.digest('hex')
}
