#!/bin/bash
# Run inside the locked build container after linking the runtime.
set -euo pipefail
cd /work
bundle=$(mktemp -d /work/.cache/corresponding-source.XXXXXX)
trap 'rm -rf "$bundle"' EXIT
mkdir -p "$bundle/engine" "$bundle/archives" "$bundle/licenses/debian" "$bundle/installed-perl"
cp -a engine/. "$bundle/engine/"
mkdir -p "$bundle/sdk-source"
for item in src scripts tests docs examples .github engine package.json bun.lock tsconfig.json biome.json .mise.toml .gitignore .gitattributes README.md AGENTS.md LICENSE THIRD_PARTY_NOTICES.md; do
 cp -a "/work/$item" "$bundle/sdk-source/"
done
ln -sf AGENTS.md "$bundle/sdk-source/CLAUDE.md"
cp -a .cache/source-archives/. "$bundle/archives/"
cp -aL .cache/engine/prefix-stage/. "$bundle/installed-perl/"
for package in /usr/share/doc/*; do
  if [ -f "$package/copyright" ]; then cp "$package/copyright" "$bundle/licenses/debian/$(basename "$package").copyright"; fi
done
cp /emsdk/upstream/emscripten/LICENSE "$bundle/licenses/EMSCRIPTEN-LICENSE"
dpkg-query -W > "$bundle/installed-packages.txt"
emcc --version > "$bundle/compiler.txt"
cat > "$bundle/README.txt" <<'TEXT'
Corresponding sources and build support for wasmbiber.
archives/ holds every hash-locked source archive in engine/sources.lock.json.
installed-perl/ contains the installed Perl module source/data tree, including
Debian-provided pure Perl dependencies. Their notices are in licenses/debian/.
engine/ contains the complete modified build support, patches and source lock.
sdk-source/ is the complete SDK, fixtures and build/qualification scripts.
To reconstruct the project, copy sdk-source/ to a working directory, then copy
archives/ into its .cache/source-archives/. Restore the separately supplied
qualified toolchain image archive as .cache/toolchain.tar.gz and run
bash engine/container-build.sh. See docs/build.md and the toolchain receipt.
The large compiler image is supplied separately from this source archive.
The SDK's MIT license does not replace these components' individual licenses.
The distributed Data::Uniqid change is applied by engine/package-runtime.py.
TEXT
mkdir -p local-evaluation/distribution
tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner -C "$bundle" -czf local-evaluation/distribution/wasmbiber-corresponding-source.tar.gz .
sha256sum local-evaluation/distribution/wasmbiber-corresponding-source.tar.gz
