# Distribution

This repository produces a local npm-compatible archive; it does not publish to
a registry or CDN. `private: true` prevents accidental npm publication. The
package includes compiled SDK modules/declarations, runtime assets, documentation,
a browser example, notices, and a corresponding-source archive. It excludes
test fixtures, evaluation reports and developer dependencies.

After [building](build.md), run:

```sh
bun run verify
bun run test:browser
bun run benchmark
bun run package
```

The packaging script requires passing qualification evidence for the exact
runtime identity and current SDK files. It verifies asset digests, copies the
corresponding-source bundle and notices into the distribution, packs locally,
then extracts into a separate temporary consumer and runs a real Biber job
through the public Node export. The same extracted package also passes the
browser/offline suite before the release receipt is written. The source archive checksum and release identity
are recorded in `assets/provenance.json`. Preserve the local release receipt
under `local-evaluation/distribution/` with the archive.

The host must deploy a complete versioned directory, including `manifest.json`,
SDK Worker modules, runtime files and source/notices. Never replace one file of a
cached runtime version in place. Serve `.wasm` as `application/wasm`, JS modules
as JavaScript, and use HTTP compression for runtime files. The uncompressed
bytes are what the manifest hashes. Cache old versions according to the host's
active-document policy; the SDK never deletes another release's cache.

The manifest is trusted release metadata. SHA-256 detects corrupt or mixed
assets; it is not a signature authenticating an untrusted manifest. Bundle or
otherwise authenticate the manifest through the host's normal release channel.

The SDK's MIT license covers original TypeScript/JavaScript. Biber, Perl,
CPAN/Unicode data and TeXlyre-derived build/bootstrap code retain their original
licenses. `THIRD_PARTY_NOTICES.md`, bundled license texts and corresponding
sources travel with the runtime. Packaging must not label the combined runtime
as MIT-only. See [integration](integration.md) for host responsibilities.
