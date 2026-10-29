import type { Diagnostic, ErrorCode } from './types.js'
export class BiberError extends Error {
  override readonly name = 'BiberError'
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly diagnostics: readonly Diagnostic[] = [],
  ) {
    super(message)
  }
}
export function asBiberError(error: unknown, code: ErrorCode): BiberError {
  return error instanceof BiberError
    ? error
    : new BiberError(
        code,
        error instanceof Error ? error.message : String(error),
      )
}
