#!/bin/bash
set -euo pipefail
cd /work/engine/vendor
export AR=emar MAKEFLAGS=-j8 EMPERL_OPTIMIZ=-O2
export BUILD=/work/.cache/engine PERL_WASM_PREFIX=/opt/perl-wasm
bash biber/build_biber.sh
