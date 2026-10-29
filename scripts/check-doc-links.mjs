import assert from 'node:assert/strict'
import { access, readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const files = [
  'README.md',
  'AGENTS.md',
  'THIRD_PARTY_NOTICES.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CHANGELOG.md',
  ...(await readdir(resolve(root, 'docs')))
    .filter((x) => x.endsWith('.md'))
    .map((x) => `docs/${x}`),
]
const failures = []
for (const name of files) {
  const text = await readFile(resolve(root, name), 'utf8')
  for (const match of text.matchAll(/\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) {
    const target = match[1].split('#')[0]
    if (!target || /^[a-z]+:/i.test(target)) continue
    try {
      await access(resolve(root, dirname(name), decodeURIComponent(target)))
    } catch {
      failures.push(`${name}: ${target}`)
    }
  }
}
assert.deepEqual(failures, [], 'Broken documentation links')
console.log(`${files.length} documents: local links passed`)
