# Public releases

A release has two distributions: the MIT SDK sources and the combined runtime
with its component-specific notices and corresponding sources. Start with
[distribution](distribution.md) and [building](build.md).

## Before the repository exists

Keep `private: true` in package metadata: GitHub source and release-asset
publication do not require npm publication. Do not invent a repository URL,
security mailbox or package registry owner. The repository owner supplies those
when creating the public repository. No workflow publishes automatically.

Run the normal SDK, native, browser and benchmark gates, then `bun run package`.
If only SDK documentation or packaging metadata changed after a qualified
runtime build, `bun run source:refresh` refreshes its corresponding-source
archive from the verified previous archive and the Git index. It refuses engine
changes except the source-archive assembly script; engine changes require a
new full build. Stage the intended source files before this command.

Run `bun run release:prepare` after packaging. It creates
`local-evaluation/public-release/` containing the npm-compatible archive,
corresponding sources, exported toolchain image, its inventory/lock, release
receipt, notices and `SHA256SUMS`. It never publishes or creates a tag. The
compiler archive is large and must be uploaded as a release asset, not committed
in Git. The source archive already contains dependency sources and notices.

## Once the owner creates the repository

1. Confirm the public owner/name, configure `origin`, and add the real repository,
   homepage and issue URLs to package metadata. Re-run source refresh, packaging
   and release preparation after changing metadata.
2. Enable private vulnerability reporting in the repository's Security settings
   and update [security reporting](../SECURITY.md) to its actual advisory URL.
3. Push the reviewed source and let the SDK workflow pass. Confirm that generated
   artifacts, local reports, credentials and private host paths are absent.
4. Create a reviewed `v0.1.0` tag at the qualified commit and a **draft** GitHub
   release. Upload every file from the prepared release directory. Include the
   [changelog](../CHANGELOG.md), supported environments and license boundaries.
5. Download the draft assets to a clean machine, verify `SHA256SUMS`, load the
   compiler image, and perform the source-build procedure. This final public
   download/build check requires the repository and its hosted release assets.
6. Publish the draft after those checks. Keep the compiler image available with
   its matching sources. npm publication is a separate explicit decision;
   verify package-name ownership before removing the publication guard.

Consumers can install the downloaded `.tgz` with Bun/npm and deploy its complete
`assets/` directory as described in [integration](integration.md). Building from
a source checkout requires downloading the matching toolchain asset, verifying
its checksum and placing it at `.cache/toolchain.tar.gz`. The build script loads
and checks its image identity before compiling; no private registry is needed.
