import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BiberError } from '../src/errors.js'
import type { RuntimeManifest } from '../src/types.js'
import { snapshotRequest, validateFilesystem } from '../src/validation.js'

const manifest = { bcf: '3.11' } as RuntimeManifest
const bcf = '<bcf:controlfile version="3.11"></bcf:controlfile>'
test('snapshots nested text and raw bytes without retaining caller buffers', () => {
  const bytes = new Uint8Array([0xe9])
  const input = { bcf, bibFiles: { 'refs/a.bib': bytes, 'refs/b.bib': 'é' } }
  const copy = snapshotRequest(input, manifest, 1024)
  bytes[0] = 0
  assert.deepEqual(copy.bibFiles['refs/a.bib'], new Uint8Array([0xe9]))
  assert.deepEqual(copy.bibFiles['refs/b.bib'], new Uint8Array([0xc3, 0xa9]))
})
test('rejects traversal, reserved output, absolute and ambiguous paths', () => {
  for (const name of [
    '../x',
    'a/../x',
    '/x',
    'a//x',
    'a\\x',
    'x:1',
    'main.bcf',
    'main.bbl',
    'a\0x',
  ])
    assert.throws(
      () =>
        snapshotRequest({ bcf, bibFiles: { [name]: 'data' } }, manifest, 1024),
      { code: 'INVALID_INPUT' },
    )
})
test('refuses truncated, external-entity, incompatible and oversized control files', () => {
  for (const value of [
    '<bcf:controlfile version="3.11">',
    `<!DOCTYPE x>${bcf}`,
  ])
    assert.throws(
      () => snapshotRequest({ bcf: value, bibFiles: {} }, manifest, 1024),
      { code: 'INVALID_INPUT' },
    )
  assert.throws(
    () =>
      snapshotRequest(
        { bcf: bcf.replace('3.11', '3.10'), bibFiles: {} },
        manifest,
        1024,
      ),
    { code: 'VERSION_MISMATCH' },
  )
  assert.throws(() => snapshotRequest({ bcf, bibFiles: {} }, manifest, 1), {
    code: 'INVALID_INPUT',
  })
})
test('filesystem metadata must describe the complete blob without overlap or traversal', () => {
  assert.deepEqual(
    validateFilesystem([{ path: '/opt/perl-wasm/a', offset: 0, length: 2 }], 2),
    [{ path: '/opt/perl-wasm/a', offset: 0, length: 2 }],
  )
  for (const value of [
    [{ path: '/opt/perl-wasm/../x', offset: 0, length: 2 }],
    [{ path: '/opt/perl-wasm/a', offset: 1, length: 1 }],
    [{ path: '/opt/perl-wasm/a', offset: 0, length: 3 }],
    [],
  ])
    assert.throws(() => validateFilesystem(value, 2), BiberError)
})
