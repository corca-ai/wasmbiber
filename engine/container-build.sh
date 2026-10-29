#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
image=${WASMBIBER_BUILD_IMAGE:-wasmbiber-toolchain:5.0.4}
# Use the recorded image when available, or restore the exported toolchain archive.
if ! docker image inspect "$image" >/dev/null 2>&1; then
 if [ -f .cache/toolchain.tar.gz ]; then gzip -dc .cache/toolchain.tar.gz | docker load; else docker build -t "$image" -f engine/Dockerfile .; fi
fi
expected=$(node -p "require('./engine/toolchain.lock.json').imageId")
actual=$(docker image inspect "$image" --format '{{.Id}}')
if [ "$actual" != "$expected" ]; then
 echo 'Toolchain image differs from the qualified image; restore its archive or explicitly requalify the new toolchain.' >&2
 exit 1
fi
docker run --rm --platform linux/amd64 --cpus=8 --memory=16g -v "$PWD:/work" "$image" bash -c 'dpkg-query -W > /tmp/packages.txt; cmp /tmp/packages.txt /work/engine/packages.lock.txt; bash /work/engine/build-runtime.sh; bash /work/engine/link-runtime.sh; bash /work/engine/source-bundle.sh'
node scripts/manifest.mjs
