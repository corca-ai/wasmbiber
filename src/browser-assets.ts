import type { AssetSource } from './assets.js'
import { verify } from './assets.js'
import { BiberError } from './errors.js'
import type { ClientOptions, RuntimeManifest } from './types.js'

// Bound the stream before allocation, even when a server ignores Content-Length.
async function readBounded(
  response: Response,
  expected: number,
): Promise<Uint8Array> {
  if (
    !Number.isSafeInteger(expected) ||
    expected <= 0 ||
    expected > 128 * 1024 * 1024
  )
    throw new BiberError('INTEGRITY', 'Invalid asset length')
  const reader = response.body?.getReader()
  if (!reader) throw new BiberError('INTEGRITY', 'Missing asset body')
  const bytes = new Uint8Array(expected)
  let offset = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (offset + value.length > expected)
        throw new BiberError(
          'INTEGRITY',
          'Runtime asset exceeds the release length',
        )
      bytes.set(value, offset)
      offset += value.length
    }
    if (offset !== expected)
      throw new BiberError('INTEGRITY', 'Truncated runtime asset')
    return bytes
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
export function browserAssets(options: ClientOptions): AssetSource {
  const base = new URL(options.assetBaseUrl, globalThis.location?.href)
  if (
    !base.pathname.endsWith('/') ||
    !['http:', 'https:'].includes(base.protocol)
  )
    throw new BiberError(
      'INVALID_INPUT',
      'assetBaseUrl must be an HTTP(S) directory URL',
    )
  const cacheName = `wasmbiber-${options.manifest.id}`
  async function cache() {
    try {
      return options.cache !== 'memory' && globalThis.caches
        ? await caches.open(cacheName)
        : undefined
    } catch {
      return undefined
    }
  }
  async function cached(name: string, manifest: RuntimeManifest) {
    const storage = await cache()
    const url = new URL(name, base)
    try {
      const response = await storage?.match(url)
      if (!response) return undefined
      const record = manifest.files[name as keyof RuntimeManifest['files']]
      const bytes = await readBounded(response, record.bytes)
      await verify(bytes, record)
      return bytes
    } catch {
      await storage?.delete(url).catch(() => {})
      return undefined
    }
  }
  return {
    async read(name, signal) {
      const saved = await cached(name, options.manifest)
      if (saved) return saved
      const response = await fetch(new URL(name, base), {
        signal,
        credentials: 'omit',
        redirect: 'error',
      })
      if (!response.ok)
        throw new BiberError(
          'ASSET_UNAVAILABLE',
          `Could not load ${name}: HTTP ${response.status}`,
        )
      const record =
        options.manifest.files[name as keyof RuntimeManifest['files']]
      const bytes = await readBounded(response, record.bytes)
      await verify(bytes, record)
      try {
        await (await cache())?.put(
          new URL(name, base),
          new Response(new Uint8Array(bytes)),
        )
      } catch {
        /* Quota/privacy mode affects persistence, never output correctness. */
      }
      return bytes
    },
    async offlineStatus(manifest) {
      const missing: string[] = []
      for (const name of Object.keys(manifest.files))
        if (!(await cached(name, manifest))) missing.push(name)
      return { ready: missing.length === 0, missing }
    },
  }
}
