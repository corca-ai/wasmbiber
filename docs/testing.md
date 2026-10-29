# Testing

`bun run verify` is the normal gate after [setup](development.md). It includes
scheduler/input unit tests and `scripts/qualify.mjs`, which runs the real packaged
WASM through the Node Worker API against native Biber goldens. Failures exit
nonzero and write an ignored report under `local-evaluation/`.

The corpus is enumerated in `tests/fixtures/corpus.json`. Native status and BBL
files are generated independently with `scripts/native-oracle.sh` using pristine
Biber 2.22 in the recorded Linux build environment. Successful outputs compare
byte-for-byte, including Unicode, order, names and dates. Invalid upstream inputs
must fail in both native and WASM execution. CLI fixture runs are not a claim
that the upstream Perl test suite ran. Some upstream tests alter options through
their Perl harness; those CLI inputs intentionally fail. See fixture provenance.

Unit tests protect bounded FIFO admission, input snapshotting, cancellation,
timeout, disposal, corruption recovery and path/version refusal. Runtime tests
also prove recovery after actual cancellation and actual Biber errors.

`bun run test:browser` uses the agent-browser CLI against a dedicated local
server and session. It runs the published entry point, output comparisons,
cancellation, cache corruption recovery, repeated jobs, UI heartbeat and a
fresh-page offline run with the server stopped. The runner exits nonzero on
failure and closes its session/server. These tests do not automate a user's
regular browser session. See [offline assets](offline.md).

Use [performance](performance.md) for benchmark methodology, and
[distribution](distribution.md) for package-consumer checks. Never bless a WASM
regression by replacing native goldens with candidate output.
