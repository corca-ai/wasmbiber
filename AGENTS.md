# WasmBiber contributor guide

Read [architecture](docs/architecture.md) and the relevant topic in
[documentation](docs/index.md) before changing public behavior.

- Use pinned tool versions and `bun run verify`; browser/runtime changes also run
  `bun run test:browser`. See [testing](docs/testing.md).
- Preserve exact native Biber output. Never normalize away a regression or refresh
  goldens from the WASM candidate. See [compatibility](docs/compatibility.md).
- Keep app/project models out of this SDK. Each interpreter job is isolated and
  terminated. Cancellation and asset cache correctness are public contracts.
- Measure before optimizing; keep raw results in ignored `local-evaluation/`.
- Update the owning current guide; keep experiment reports separate. See
  [documentation rules](docs/documentation.md).
- Preserve third-party licenses and locked inputs. See [build](docs/build.md)
  and [distribution](docs/distribution.md).

`CLAUDE.md` is a symlink to this file.
