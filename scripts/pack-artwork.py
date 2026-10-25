"""Repackage original PNGs after a data import, preserving image bytes."""
import hashlib, subprocess, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
art=root/'artwork';art.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory() as td:
    archive=Path(td)/'original.tar.gz'
    subprocess.run(['tar','--sort=name','--mtime=UTC 2026-01-01','--owner=0','--group=0','--numeric-owner','-czf',str(archive),'-C',str(root/'public'),'assets'],check=True)
    data=archive.read_bytes()
    for old in art.glob('original-pngs.tar.gz.part-*'): old.unlink()
    chunk=524288
    for i,start in enumerate(range(0,len(data),chunk)):
        (art/f'original-pngs.tar.gz.part-{i:03}').write_bytes(data[start:start+chunk])
    (art/'archive.sha256').write_text(hashlib.sha256(data).hexdigest()+'\n')
    print(f'Packaged {len(data)} bytes of original PNGs.')
