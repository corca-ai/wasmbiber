# Building the runtime

The runtime consists of Biber 2.22, Perl 5.38.2, statically linked XS modules,
libxml2, and the complete runtime Unicode/collation data. The compiler is
Emscripten 5.0.4. Source URLs, archive lengths and SHA-256 digests are recorded in
`engine/sources.lock.json`. `engine/fetch-sources.py` verifies archives before
safe extraction and refuses stale source trees. Build-time CPAN package
resolution is not performed.

## Toolchain

`engine/toolchain.lock.json` identifies the qualified Linux amd64 image by its
content ID. `engine/packages.lock.txt` identifies every installed Debian package.
The Dockerfile pins the base SDK digest; apt repositories can change, so a fresh
Dockerfile build must be requalified if its image differs. The normal script
refuses drift. Preserve the image, rather than claiming an unpinned apt install
is reproducible:

```sh
docker save wasmbiber-toolchain:5.0.4 | gzip > .cache/toolchain.tar.gz
bash engine/container-build.sh
```

On a new machine the build script loads `.cache/toolchain.tar.gz` if the image
is absent. It checks the image identity and package inventory before building.
The compiler image is a development artifact, separate from the SDK/runtime
package. Record its archive checksum when transferring or backing it up.

The build uses eight CPUs and a 16 GiB container limit. Apple Silicon can run
amd64 emulation, but a native Linux amd64 host is preferable. Copy this standalone
repository and `.cache/source-archives/` to the chosen host, run the same command,
and copy back `assets/` plus `local-evaluation/distribution/`. No sibling checkout
or private build-host pathname is needed. A remote host requires Node 24 for
manifest sealing, or seal the returned files locally with
`node scripts/manifest.mjs`.

## Changes from upstream

Build support under `engine/vendor/` is pinned to the revision in its
`UPSTREAM.md`; its patches remain visible. Additional changes are:

- Perl uses 64-bit integers within a 32-bit WASM address space. This preserves
  Biber/DateTime arithmetic for expanded ISO years; widening WASM pointers is
  unnecessary.
- XML::LibXML is compiled with `HAVE_UTF8`, preserving the UTF-8 XS contract.
- Data::Uniqid's job-local IDs use a counter. Browser clock resolution cannot
  support its microsecond-clock uniqueness assumption. IDs do not escape the
  job; native output remains the independent oracle.
- All source fetching uses locked, verified archives. Unicode::LineBreak's
  bundled sombok is used, with no floating Git fallback.
- The final link uses `-O2`, ES modules, a 512 MiB maximum linear memory, no
  preloaded LZ4 filesystem and no implicit runtime download. The final link
  refuses undefined symbols; unavailable POSIX `sigsuspend` reports `ENOSYS`. The SDK mounts a
  deterministic offset-table filesystem from verified bytes.

`engine/package-runtime.py` removes native object files and build/test-only
modules, retaining runtime encodings and locale data. Its generated
`assets/packaging-report.json` lists exclusions. Do not reduce Unicode coverage
to improve a download-size metric. Every pruning/link change must pass the
native corpus and browser tests in [testing](testing.md).

`engine/source-bundle.sh` captures source archives, modified build support,
installed Perl sources, notices, toolchain inventory and the complete SDK source
with its test fixtures. The archive README explains reconstruction without a
sibling checkout; the large compiler image is supplied separately. The final manifest
binds executable/data bytes. See [distribution](distribution.md) for matching
SDK, runtime and source artifacts.
