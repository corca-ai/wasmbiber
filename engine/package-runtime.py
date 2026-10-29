"""Package a deterministic virtual filesystem, retaining all runtime data/locales."""
from pathlib import Path
import hashlib,json,shutil,re
import sys
stage=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
# Native object files cannot run in WASM. Build/test tooling is not Biber runtime.
exclude_suffix={'.so','.o','.a','.h','.pod','.t','.bs','.pc'}
exclude_dirs={'CORE','CPAN','CPANPLUS','TAP','Test','Test2','ExtUtils','Dpkg','Debconf','Debian','Debhelper','pod','t','doc','docs','examples'}
files=[];offset=0;removed=[]
with (out/'biber.data').open('wb') as stream:
 for p in sorted(stage.rglob('*')):
  if not p.is_file():continue
  rel=p.relative_to(stage)
  if any(x in exclude_dirs for x in rel.parts) or p.suffix in exclude_suffix or p.name in {'.packlist','perllocal.pod'}:
   removed.append(str(rel));continue
  body=p.read_bytes()
  if str(rel).endswith('Data/Uniqid.pm'):
   source=body.decode();source,n=re.subn(r'sub suniqid \{[\s\S]*?\n\}', 'my $wasmbiber_id = 0;\n# IDs never escape this Biber job. Browser clocks cannot guarantee uniqueness.\nsub suniqid { return "W" . ++$wasmbiber_id; }',source,count=1)
   assert n==1;body=source.encode()
  files.append({'path':'/opt/perl-wasm/'+str(rel),'offset':offset,'length':len(body)})
  stream.write(body);offset+=len(body)
(out/'filesystem.json').write_text(json.dumps(files,separators=(',',':'))+'\n')
(out/'packaging-report.json').write_text(json.dumps({'bytes':offset,'files':len(files),'excluded':removed},indent=2)+'\n')
