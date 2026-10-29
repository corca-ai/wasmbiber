#!/bin/bash
set -euo pipefail
base=${BUILD:-/work/.cache/engine}
output=${OUTPUT:-/work/assets}
mkdir -p "$output"
python3 /work/engine/package-runtime.py "$base/prefix-stage" "$output"
cd "$base/src/perl"
rm -f perl wasmbiber.mjs
make perl EMPERL_OUTPUT=wasmbiber.mjs EMPERL_LINK_FLAGS="/work/engine/wasm-platform.c -O2 -sERROR_ON_UNDEFINED_SYMBOLS=1 -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createBiber -sENVIRONMENT=web,worker,node -sMAXIMUM_MEMORY=536870912 --pre-js /work/engine/vendor/biber/browser_prerun.js"
cp wasmbiber.mjs "$output/runtime.mjs"
cp wasmbiber.wasm "$output/biber.wasm"
