/** One Biber job. File bytes allow non-UTF-8 bibliography databases. */
export interface BiberRequest {
  bcf: string
  bibFiles: Readonly<Record<string, string | Uint8Array>>
}
export interface Diagnostic {
  severity: 'info' | 'warning' | 'error'
  message: string
}
export interface BiberResult {
  bbl: string
  diagnostics: readonly Diagnostic[]
  runtimeId: string
  metrics: {
    preparationMs: number
    executionMs: number
    totalMs: number
    wasmMemoryBytes: number
  }
}
export interface AssetRecord {
  bytes: number
  sha256: string
}
export interface RuntimeManifest {
  schema: 1
  id: string
  biber: string
  bcf: string
  files: Readonly<
    Record<
      'runtime.mjs' | 'biber.wasm' | 'biber.data' | 'filesystem.json',
      AssetRecord
    >
  >
}
export interface ClientOptions {
  /** Directory containing this release's assets, ending in '/'. */
  assetBaseUrl: URL | string
  manifest: RuntimeManifest
  timeoutMs?: number
  maxQueue?: number
  maxInputBytes?: number
  /** Browser cache is best effort; offlineStatus() verifies actual persisted bytes. */
  cache?: 'persistent' | 'memory'
}
export interface RunOptions {
  signal?: AbortSignal
}
export interface OfflineStatus {
  ready: boolean
  missing: readonly string[]
}
export interface PreparedRuntime {
  manifest: RuntimeManifest
  module: WebAssembly.Module
  code: string
  data: Uint8Array
  files: readonly VirtualFile[]
}
export interface VirtualFile {
  path: string
  offset: number
  length: number
}
export interface Job {
  request: BiberRequest
  runtime: PreparedRuntime
}
export type WorkerReply =
  | {
      ok: true
      bbl: string
      diagnostics: Diagnostic[]
      executionMs: number
      wasmMemoryBytes: number
    }
  | { ok: false; code: ErrorCode; message: string; diagnostics: Diagnostic[] }
export type ErrorCode =
  | 'INVALID_INPUT'
  | 'VERSION_MISMATCH'
  | 'ASSET_UNAVAILABLE'
  | 'INTEGRITY'
  | 'BIBER_FAILED'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'DISPOSED'
  | 'QUEUE_FULL'
  | 'WORKER_FAILED'
