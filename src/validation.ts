import { BiberError } from './errors.js'
import type { BiberRequest, RuntimeManifest, VirtualFile } from './types.js'

const encoder = new TextEncoder()
export function snapshotRequest(
  request: BiberRequest,
  manifest: RuntimeManifest,
  maxBytes: number,
): BiberRequest {
  if (
    !request ||
    typeof request.bcf !== 'string' ||
    !request.bibFiles ||
    typeof request.bibFiles !== 'object' ||
    Array.isArray(request.bibFiles)
  )
    throw new BiberError(
      'INVALID_INPUT',
      'Expected a control file and bibliography files',
    )
  if (request.bcf.length > maxBytes)
    throw new BiberError('INVALID_INPUT', `Input exceeds ${maxBytes} bytes`)
  // Never interpret a partial TeX pass or an XML document with external entities.
  if (
    !request.bcf.includes('</bcf:controlfile>') ||
    /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(request.bcf)
  )
    throw new BiberError(
      'INVALID_INPUT',
      'A complete BCF without external entities is required',
    )
  const version =
    /<bcf:controlfile\s[^>]*\bversion\s*=\s*["']([^"']+)["']/.exec(
      request.bcf,
    )?.[1]
  if (version !== manifest.bcf)
    throw new BiberError(
      'VERSION_MISMATCH',
      `Expected BCF ${manifest.bcf}, received ${version ?? 'unknown'}`,
    )
  let bytes = encoder.encode(request.bcf).length
  const files: Record<string, Uint8Array> = Object.create(null)
  const entries = Object.entries(request.bibFiles)
  if (entries.length > 1024)
    throw new BiberError('INVALID_INPUT', 'Too many input files')
  for (const [name, body] of entries) {
    if (
      !name ||
      name.length > 1024 ||
      /[\\:]/.test(name) ||
      [...name].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
      name.split('/').some((p) => !p || p === '.' || p === '..') ||
      name === 'main.bcf' ||
      name === 'main.bbl'
    )
      throw new BiberError(
        'INVALID_INPUT',
        `Invalid bibliography path: ${name}`,
      )
    if (typeof body !== 'string' && !(body instanceof Uint8Array))
      throw new BiberError(
        'INVALID_INPUT',
        `Invalid bibliography bytes: ${name}`,
      )
    if (bytes + body.length > maxBytes)
      throw new BiberError('INVALID_INPUT', `Input exceeds ${maxBytes} bytes`)
    const data = typeof body === 'string' ? encoder.encode(body) : body.slice()
    bytes += data.byteLength
    if (bytes > maxBytes)
      throw new BiberError('INVALID_INPUT', `Input exceeds ${maxBytes} bytes`)
    files[name] = data
  }
  if (bytes > maxBytes)
    throw new BiberError('INVALID_INPUT', `Input exceeds ${maxBytes} bytes`)
  // Biber's XML parser remains the authority for the schema and detailed diagnostics.
  return { bcf: request.bcf, bibFiles: files }
}
export function validateFilesystem(
  value: unknown,
  length: number,
): readonly VirtualFile[] {
  if (!Array.isArray(value) || value.length > 30000)
    throw new BiberError('INTEGRITY', 'Invalid filesystem table')
  const seen = new Set<string>()
  let previousEnd = 0
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof entry.path !== 'string' ||
      !entry.path.startsWith('/opt/perl-wasm/') ||
      entry.path.split('/').includes('..') ||
      seen.has(entry.path) ||
      !Number.isSafeInteger(entry.offset) ||
      !Number.isSafeInteger(entry.length) ||
      entry.offset !== previousEnd ||
      entry.length < 0 ||
      entry.offset + entry.length > length
    )
      throw new BiberError('INTEGRITY', 'Invalid filesystem entry')
    previousEnd = entry.offset + entry.length
    seen.add(entry.path)
  }
  if (previousEnd !== length)
    throw new BiberError('INTEGRITY', 'Incomplete filesystem table')
  return value as VirtualFile[]
}
