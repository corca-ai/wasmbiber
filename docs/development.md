# Development

Use the versions in `.mise.toml` and the committed Bun lockfile. Install with
`bun install --frozen-lockfile`, then `bun run build`. TypeScript sources in
`src/` compile to `dist/src/`; tests compile to `dist/tests/`. Public entry points
are browser `src/index.ts` and Node `src/node.ts`.

`bun run verify` runs type/build, lint, unit tests, actual runtime qualification
and document graph checks. Build runtime assets first using [build](build.md).
`bun run test:browser` exercises the browser Worker and offline behavior.
`bun run benchmark` measures real jobs separately from correctness checks.
See [testing](testing.md) and [performance](performance.md).

Keep generated assets, build trees, source downloads and local reports out of
Git. Fixture sources and independently generated native goldens are committed.
No adjacent checkout is required for default tests or a source build.
The optional wasmtex integration check accepts an explicit SDK/engine location.

Follow [documentation rules](documentation.md) for current guides and evidence,
and [distribution](distribution.md) for package qualification.

GitHub's SDK workflow checks build, lint, unit tests and local document links on
ordinary branches. It does not claim runtime qualification without generated
assets. The packaging gate requires native/browser/benchmark receipts for the
current SDK and runtime. Full local document checks additionally use the `awiki`
CLI for graph connectivity. Browser qualification needs `agent-browser` on
PATH and its installed Chrome; it is a development tool, not a runtime
dependency. The first qualification used agent-browser 0.27.0; the report records
the actual browser version.
