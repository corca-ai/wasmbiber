# Architecture

The SDK owns bibliography execution. The host owns document editing, TeX passes,
project persistence, UI notices and backend selection. There is no CorTeX or
wasmtex dependency. See [integration](integration.md).

The browser and Node entry points create the same headless client. The client
snapshots inputs at admission, prepares a verified runtime once, and processes a
bounded FIFO queue with one active Worker. Every job gets a fresh interpreter
and virtual filesystem. The Worker terminates before a successful promise
resolves; the next job never overlaps its heap. No result cache can conceal
changed bibliography input.

Preparation retains a compiled WebAssembly module and read-only runtime files.
The files are described by a deterministic offset table and mounted from one
byte buffer. A new Worker receives a structured clone of those assets; it never
sees another document's filesystem or the host filesystem. Node uses a private
temporary JS module file because Emscripten's Node loader requires a file URL.
The parent removes that directory after normal completion or forced termination.

Timeouts and cancellation are enforced by the parent, so a blocked synchronous
Perl run remains interruptible. See [API](api.md) for admission and lifecycle
semantics and [offline assets](offline.md) for persistence.

The native Biber CLI is the output oracle, independent of the candidate runtime.
[Testing](testing.md) explains compatibility, failure and browser qualification.
