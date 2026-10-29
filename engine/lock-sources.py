"""Resolve source URLs once, retain archives and write the reviewed source lock."""
from pathlib import Path
import json,hashlib,subprocess,concurrent.futures
base=Path(__file__).resolve().parent;dest=base.parent/'.cache/source-archives';dest.mkdir(parents=True,exist_ok=True)
rows=[]
for line in (base/'vendor/biber/modules.txt').read_text().splitlines():
 if not line.strip() or line.lstrip().startswith('#'):continue
 name,version,*_=line.split();rows.append((name.replace('::','-'),version,None))
rows += [('perl','5.38.2','https://www.cpan.org/src/5.0/perl-5.38.2.tar.gz'),('biber','2.22','https://codeload.github.com/plk/biber/tar.gz/refs/tags/v2.22'),('libxml2','2.9.14','https://download.gnome.org/sources/libxml2/2.9/libxml2-2.9.14.tar.xz'),('emperl','327812babf4e9be6332919295097573852889fb1','https://codeload.github.com/haukex/emperl5/tar.gz/327812babf4e9be6332919295097573852889fb1')]
def resolve(row):
 name,version,url=row
 if not url:
  module=name.replace('-', '::')
  url=json.loads(subprocess.check_output(['curl','-fsSL','--retry','3','https://fastapi.metacpan.org/v1/download_url/'+module+'?version==='+version]))['download_url']
 blob=subprocess.check_output(['curl','-fsSL','--retry','3',url])
 suffix='.tar.xz' if url.endswith('.xz') else '.tar.gz';filename=name+'-'+version+suffix
 (dest/filename).write_bytes(blob)
 return {'name':name,'version':version,'url':url,'archive':filename,'sha256':hashlib.sha256(blob).hexdigest(),'bytes':len(blob)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:locked=list(pool.map(resolve,rows))
(base/'sources.lock.json').write_text(json.dumps({'schema':1,'sources':locked},indent=2)+'\n');print('Locked',len(locked),'archives')
