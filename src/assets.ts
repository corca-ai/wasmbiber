import { asBiberError, BiberError } from './errors.js'
import type {
  OfflineStatus,
  PreparedRuntime,
  RuntimeManifest,
} from './types.js'
import { validateFilesystem } from './validation.js'
export interface AssetSource {
  read(name: string, signal: AbortSignal): Promise<Uint8Array>
  offlineStatus(manifest: RuntimeManifest): Promise<OfflineStatus>
}
export async function verify(
  bytes: Uint8Array,
  expected: { bytes: number; sha256: string },
): Promise<void> {
  if (bytes.length !== expected.bytes)
    throw new BiberError(
      'INTEGRITY',
      'Runtime asset length does not match the release manifest',
    )
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  const hex = Array.from(new Uint8Array(digest), (x) =>
    x.toString(16).padStart(2, '0'),
  ).join('')
  if (bytes.length !== expected.bytes || hex !== expected.sha256)
    throw new BiberError(
      'INTEGRITY',
      'Runtime asset does not match the release manifest',
    )
}
export async function prepareRuntime(
  manifest: RuntimeManifest,
  source: AssetSource,
  signal: AbortSignal,
): Promise<PreparedRuntime> {
  if (
    manifest.schema !== 1 ||
    !manifest.id ||
    manifest.biber !== '2.22' ||
    manifest.bcf !== '3.11'
  )
    throw new BiberError('VERSION_MISMATCH', 'Unsupported runtime manifest')
  const names = [
    'runtime.mjs',
    'biber.wasm',
    'biber.data',
    'filesystem.json',
  ] as const
  const assets = await Promise.all(
    names.map(async (name) => {
      const expected = manifest.files[name]
      if (
        !expected ||
        !Number.isSafeInteger(expected.bytes) ||
        expected.bytes <= 0 ||
        expected.bytes > 128 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/.test(expected.sha256)
      )
        throw new BiberError('INTEGRITY', 'Invalid asset manifest')
      try {
        const bytes = await source.read(name, signal)
        await verify(bytes, expected)
        return bytes
      } catch (error) {
        throw asBiberError(error, 'ASSET_UNAVAILABLE')
      }
    }),
  )
  const [code, wasm, data, index] = assets
  if (!code || !wasm || !data || !index)
    throw new BiberError('INTEGRITY', 'Incomplete asset set')
  const files = validateFilesystem(
    JSON.parse(new TextDecoder().decode(index)),
    data.length,
  )
  return {
    manifest,
    code: new TextDecoder().decode(code),
    data,
    files,
    module: await WebAssembly.compile(new Uint8Array(wasm)),
  }
}
