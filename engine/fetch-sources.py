"""Extract only locked, hash-verified sources. No live package resolution."""
from pathlib import Path
import hashlib,json,subprocess,tarfile,shutil,os,tempfile
base=Path(__file__).resolve().parent
cache=base.parent/'.cache/source-archives';cache.mkdir(parents=True,exist_ok=True)
dest=Path(os.environ['SRCDIR']);dest.mkdir(parents=True,exist_ok=True)
for item in json.loads((base/'sources.lock.json').read_text())['sources']:
 archive=cache/item['archive']
 if not archive.exists():subprocess.run(['curl','-fL','--retry','3','--output',str(archive),item['url']],check=True)
 if hashlib.sha256(archive.read_bytes()).hexdigest()!=item['sha256']:raise SystemExit('Source digest mismatch: '+item['name'])
 target=dest/item['name']
 if target.exists():
  if not (target/'.wasmbiber-source-sha256').exists() or (target/'.wasmbiber-source-sha256').read_text()!=item['sha256']:raise SystemExit('Stale source tree: '+str(target))
  continue
 staging=Path(tempfile.mkdtemp(prefix=item['name']+'-',dir=dest))
 try:
  with tarfile.open(archive) as tar:
   tar.extractall(staging,filter='data')
  roots=list(staging.iterdir())
  if len(roots)!=1 or not roots[0].is_dir():raise SystemExit('Expected one archive root: '+item['name'])
  (roots[0]/'.wasmbiber-source-sha256').write_text(item['sha256'])
  roots[0].rename(target)
 finally:
  shutil.rmtree(staging)
perl=dest/'perl';emperl=dest/'emperl'
for name in ['nodeperl_dev_prerun.js','nodeperl_dev']:
 if (emperl/name).exists():shutil.copy(emperl/name,perl/name)
if (emperl/'ext/WebPerl').exists():shutil.copytree(emperl/'ext/WebPerl',perl/'ext/WebPerl',dirs_exist_ok=True)
if not (dest/'Unicode-LineBreak/sombok/lib').exists():raise SystemExit('Locked Unicode::LineBreak must include sombok; no floating fallback')
