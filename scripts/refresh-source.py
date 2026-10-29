"""Refresh packaging-only source changes without rebuilding identical engine bytes."""
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

root = Path(__file__).resolve().parent.parent
provenance = json.loads((root / 'assets/provenance.json').read_text())
source = root / 'assets' / provenance['source']['name']
assert hashlib.sha256(source.read_bytes()).hexdigest() == provenance['source']['sha256'], 'Previous source archive integrity failed'
manifest = json.loads((root / 'assets/manifest.json').read_text())
assert provenance['runtime'] == manifest['id'], 'Runtime changed; perform a full build'
tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
tracked = [p for p in tracked if p and p != 'CLAUDE.md']
with tarfile.open(source, 'r:gz') as archive:
    original = {m.name.removeprefix('./'): (m, archive.extractfile(m).read() if m.isfile() else None) for m in archive.getmembers()}
for name in tracked:
    if name.startswith('engine/') and name != 'engine/source-bundle.sh':
        assert name in original and original[name][1] == (root / name).read_bytes(), f'Engine changed: {name}; perform a full build'
# All dependency source payloads remain byte-for-byte unchanged. Replace only the
# project-owned source trees, assembled from tracked files, never local reports.
entries = {n: (m, b) for n, (m, b) in original.items() if n not in ('sdk-source', 'engine') and not n.startswith(('sdk-source/', 'engine/')) and n not in ('', '.')}
for name in tracked:
    content = (root / name).read_bytes()
    destinations = ['sdk-source/' + name]
    if name.startswith('engine/'):
        destinations.append(name)
    for dest in destinations:
        info = tarfile.TarInfo(dest)
        info.size = len(content)
        info.mode = 0o755 if (root / name).stat().st_mode & 0o111 else 0o644
        entries[dest] = (info, content)
link = tarfile.TarInfo('sdk-source/CLAUDE.md')
link.type = tarfile.SYMTYPE
link.linkname = 'AGENTS.md'
entries[link.name] = (link, None)
out = root / 'local-evaluation/distribution' / source.name
out.parent.mkdir(parents=True, exist_ok=True)
with out.open('wb') as raw, gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as compressed, tarfile.open(fileobj=compressed, mode='w|') as archive:
    for name, (info, content) in sorted(entries.items()):
        info.name = './' + name
        info.uid = info.gid = info.mtime = 0
        info.uname = info.gname = ''
        info.pax_headers = {}
        archive.addfile(info, io.BytesIO(content) if content is not None else None)
print(out)
