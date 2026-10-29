# Runtime assets

Build with `engine/build-runtime.sh` and `engine/link-runtime.sh` inside the pinned
build container. `scripts/manifest.mjs` seals all files by SHA-256. See
[build instructions](../docs/build.md) and [distribution](../docs/distribution.md).
Generated runtime bytes are not committed to Git. Package archives include the
verified assets and license/source notices; SDK-only code has no CDN dependency.
