# wasmbiber

Run Biber locally in a browser Worker or Node worker thread. The actual Biber
2.22 Perl implementation produces `.bbl` output from a biblatex `.bcf` and local
bibliography files. This is an independent library: it has no CorTeX, wasmtex or
server dependency.

```js
import { createBiber } from 'wasmbiber'
const biber = createBiber({ assetBaseUrl, manifest })
try {
  const result = await biber.run({ bcf, bibFiles: { 'references.bib': bibliography } })
  // Pass result.bbl to the next TeX pass.
} finally {
  await biber.dispose()
}
```

`assetBaseUrl` points to a complete, matching runtime release. `manifest` comes
from that release's `assets/manifest.json`; the host must ship/cache it alongside
the SDK. See [integration](docs/integration.md) for complete browser/Node examples
and wasmtex/macOS integration boundaries.

The SDK verifies every runtime file against SHA-256, uses a bounded job queue,
supports cancellation/timeouts, and isolates every job in a fresh Worker.
Browser runtime caching is optional and reports verified offline readiness.
No remote bibliography fetching, implicit server fallback or arbitrary Perl/CLI
execution is exposed. BCF version 3.11 is required.

## Develop and qualify

```sh
mise install
bun install --frozen-lockfile
bash engine/container-build.sh
bun run verify
bun run test:browser
bun run benchmark
bun run package
```

Native builds run in the locked Linux amd64 Docker toolchain. On Apple Silicon,
use an amd64 build host as described in [building](docs/build.md). Runtime
artifacts are generated, not checked into Git. `assets/` contains a complete
local build after the build command finishes. Registry publishing is intentionally off. Downloadable GitHub release bundles
are prepared with `bun run release:prepare`; see [public releases](docs/releasing.md).

Contributors should read [AGENTS.md](AGENTS.md).

Start with the [documentation index](docs/index.md), [API](docs/api.md),
[compatibility](docs/compatibility.md), [testing](docs/testing.md),
[performance](docs/performance.md), and [distribution](docs/distribution.md).

The TypeScript SDK is MIT-licensed. Runtime components and build support retain
their own licenses, including Artistic, GPL/AGPL and Unicode terms. See
[third-party notices](THIRD_PARTY_NOTICES.md); runtime bundles include a matching
corresponding-source archive.

For contributions, see [CONTRIBUTING.md](CONTRIBUTING.md). For security reporting,
see [SECURITY.md](SECURITY.md). Release changes are in [CHANGELOG.md](CHANGELOG.md).
