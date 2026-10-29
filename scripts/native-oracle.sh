#!/bin/bash
set -euo pipefail
# Run in the build image; supply the pristine Biber 2.22 source tree explicitly.
export PERL5LIB=${BIBER_SOURCE:?}/lib
python3 - <<'PY'
from pathlib import Path
import json,shutil,subprocess,tempfile,os
root=Path('/work');cases=json.loads((root/'tests/fixtures/corpus.json').read_text());out=root/'tests/fixtures/native';out.mkdir(parents=True,exist_ok=True)
for case in cases:
 name=case['name']
 with tempfile.TemporaryDirectory() as td:
  for n in [name+'.bcf',*case['sources']]:shutil.copy(root/'tests/fixtures/upstream'/n,Path(td)/n)
  run=subprocess.run(['perl',os.environ['BIBER_SOURCE']+'/bin/biber','--noconf','--nolog',name+'.bcf'],cwd=td,capture_output=True,timeout=30)
  bbl=Path(td)/(name+'.bbl')
  if run.returncode==0:
   assert bbl.exists(),name
   shutil.copy(bbl,out/(name+'.bbl'))
  (out/(name+'.json')).write_text(json.dumps({'exitCode':run.returncode,'log':run.stdout.decode(errors='replace')+run.stderr.decode(errors='replace')},indent=2)+'\n')
  print(name,run.returncode,flush=True)
PY
