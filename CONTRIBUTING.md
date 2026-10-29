# Contributing

Start with [the contributor guide](AGENTS.md) and [development setup](docs/development.md).
Use the pinned Node and Bun versions; install dependencies with
`bun install --frozen-lockfile`.

SDK-only work can run `bun run build`, `bun run lint`, `bun run test` and
`node scripts/check-doc-links.mjs` without runtime artifacts. Changes to runtime
behavior require the complete native and browser qualification described in
[testing](docs/testing.md). Native Biber output is the independent oracle;
never regenerate expected output from the WASM candidate.

Open an issue describing the use case before a substantial API or engine change.
Include a minimal reproduction for bugs, with private bibliography data removed.
Pull requests should describe behavior, compatibility impact and validation.
Contributions retain this project's license boundaries; preserve upstream
copyright notices, fixture provenance and source locks. No contributor license
agreement is required.
