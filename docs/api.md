# API contract

Import `createBiber` and `BiberError` from `wasmbiber` in browsers, or
`wasmbiber/node` in Node. The two entry points expose the same job contract.
[Integration](integration.md) shows complete examples; public types are defined
in [types.ts](../src/types.ts).

`createBiber(options)` returns a client without fetching assets. `assetBaseUrl`
is an HTTP(S) directory URL in browsers and a file directory URL in Node.
`manifest` is the trusted release manifest shipped with that runtime. Fetching
an arbitrary manifest from an untrusted source does not establish authenticity.

`warmUp()` prepares and verifies assets and compiles the WebAssembly module.
`run({ bcf, bibFiles }, { signal? })` snapshots the complete control file and
bibliography bytes, then returns `.bbl`, diagnostics, runtime identity and timing.
String file contents are UTF-8; use `Uint8Array` for other input encodings.
Nested project-relative paths are preserved. Absolute paths, traversal,
backslashes, reserved output names and external XML entities are refused.
Biber remains the authority for detailed schema and bibliography diagnostics.

One client runs one job at a time. `maxQueue` bounds waiting jobs; overflow
rejects with `QUEUE_FULL`. `timeoutMs` bounds active execution including
preparation, but not time waiting behind other admitted jobs. `maxInputBytes`
bounds UTF-8 control plus database bytes. Defaults are 30 seconds, four waiting jobs and 16 MiB of input.
All limits must be positive integers. Aborting a queued job removes it; aborting an active job terminates
its Worker. An aborted request cannot publish a result. Cancellation does not
invalidate successful shared runtime preparation.

`state` is `idle`, `preparing`, `ready`, `running` or `disposed`.
`offlineStatus()` checks the actual persistent asset set; it is separate from
in-memory readiness. `dispose()` rejects pending work, terminates active work,
releases retained assets and is idempotent. Calls after disposal reject.

`BiberError.code` distinguishes invalid input, incompatible BCF, missing or
corrupt assets, Biber failure, timeout, cancellation, disposal, queue overflow
and Worker failure. A failed job never silently falls back or emits an empty
bibliography as success. Hosts own any deliberately degraded fallback and its
user-facing explanation. See [compatibility](compatibility.md).
