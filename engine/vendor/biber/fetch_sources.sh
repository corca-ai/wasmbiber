#!/bin/bash
# WasmBiber replaces floating Git/MetaCPAN resolution with a reviewed lockfile.
set -euo pipefail
python3 "$(dirname "$0")/../../fetch-sources.py"
