# Performance

`bun run benchmark` measures the actual Node Worker API. It checks exact native
output before accepting each sample. The workloads are a nested-path document,
the upstream name/disambiguation fixture, and a generated 1,000-reference
bibliography. Five samples per workload report median/min/max end-to-end latency;
25 subsequent document jobs record process RSS and WASM linear-memory capacity.
Raw reports are ignored under `local-evaluation/`.

Set `BASELINE_ASSETS` to a directory containing the earlier fixed TeXlyre
`biber.js`, `biber.wasm` and `biber.data` to compare implementations. Both paths
use one fresh Worker per job and reuse a compiled WASM module. Both must match
the same native output. The baseline loader uses its original filesystem
packaging; the candidate includes hash verification, bounded scheduling and
cleanup. Preparation is measured separately. The baseline's 32-bit integers
remain incompatible with expanded-year inputs; speed does not override the
compatibility gate.

The report includes CPU, OS, Node version, runtime identity, raw asset size,
level-9 gzip size, preparation cost, per-job latency and memory samples. Gzip size
estimates HTTP transfer when the server actually enables compression. It does
not include SDK bytes or decompressed memory. Linear-memory capacity is not
whole-process or browser memory. RSS includes Node and may retain allocator
pages after Workers terminate; finite samples do not prove absence of leaks.

Browser qualification records preparation, per-case timing and UI heartbeat
under its actual browser version. It verifies fresh-page execution after the
origin server stops. Report browser measurements separately from Node and do
not compare runs under different machine load as if they were controlled.

The main optimizations are retaining compiled WASM between jobs, mounting runtime
files from a single buffer, pruning build-only files, and letting HTTP compression
operate on the filesystem directly. Worker termination bounds interpreter state
across documents. Preserve full Unicode behavior, cancellation and failure
recovery when changing any optimization. See [architecture](architecture.md),
[building](build.md) and [testing](testing.md).
