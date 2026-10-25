"""Build a small search index, lazy-loaded family files, and original-byte archives."""
from collections import defaultdict
import gzip, hashlib, io, json, re, tarfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def encode(value):return (json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n').encode()
def build():
    raw=(ROOT/'public/data/stages.json').read_bytes();data=json.loads(raw)
    families=defaultdict(list);summaries=[]
    for m in data['maps']:
        prefix=re.match('[A-Z]+',m['code']).group()
        stages=[]
        for s in m['stages']:
            stages.append({**{k:v for k,v in s.items() if k not in ['enemies','sourceUrl']},'enemyCodes':[e['iconCode'] for e in s['enemies']]})
        families[prefix].append({**m,'stages':stages})
        summaries.append({k:m[k] for k in ['code','name','koreanTextVerified']}|{'stages':[{'index':s['index'],'name':s['name']} for s in m['stages']],'detailsPath':f'data/stage-groups/{prefix}.json'})
    dest=ROOT/'public/data/stage-groups';dest.mkdir(exist_ok=True)
    paths=set()
    for prefix,maps in families.items():
        path=dest/(prefix+'.json');path.write_bytes(encode({'schemaVersion':2,'maps':maps}));paths.add(path)
    for stale in dest.glob('*.json'):
        if stale not in paths:stale.unlink()
    totals={'maps':len(data['maps']),'stages':sum(len(m['stages']) for m in data['maps']),'icons':len(data['images']),'koreanMaps':sum(m['koreanTextVerified'] for m in data['maps']),'candidates':data['candidateCount'],'unavailable':len(data['sourceFailures'])}
    index={k:data[k] for k in ['schemaVersion','region','collectedAt','officialOnly','coverage','familyReport']}
    index.update({'totals':totals,'maps':summaries,'images':data['images'],'auditPath':'data/stage-audit.json'})
    (ROOT/'public/data/stage-index.json').write_bytes(encode(index))
    audit={k:data[k] for k in ['collectedAt','candidateCount','coverage','familyReport','sourceFailures']}
    audit['discovery']=json.loads((ROOT/'config/official-stage-sources.json').read_text())['discovery']
    (ROOT/'public/data/stage-audit.json').write_bytes(encode(audit))
    archive=ROOT/'artwork';archive.mkdir(exist_ok=True)
    data_bytes=gzip.compress(raw,mtime=0);(archive/'official-stage-data.json.gz').write_bytes(data_bytes)
    tar=io.BytesIO()
    with tarfile.open(fileobj=tar,mode='w',format=tarfile.USTAR_FORMAT) as out:
        for image in sorted(data['images'],key=lambda i:i['path'] or ''):
            if image.get('availability')=='unavailable':continue
            path=ROOT/'public'/image['path'];original=path.read_bytes()
            if hashlib.sha256(original).hexdigest()!=image['sha256']:raise ValueError('Official PNG checksum mismatch')
            info=tarfile.TarInfo(image['path']);info.size=len(original);info.mode=0o644;info.mtime=0
            out.addfile(info,io.BytesIO(original))
    icons=gzip.compress(tar.getvalue(),mtime=0);(archive/'official-stage-icons.tar.gz').write_bytes(icons)
    (archive/'official-stages.sha256.json').write_bytes(encode({name:hashlib.sha256(value).hexdigest() for name,value in [('official-stage-data.json.gz',data_bytes),('official-stage-icons.tar.gz',icons)]}))
    print(f'Built stage catalog: {totals}; index {len(encode(index)):,} bytes, {len(families)} lazy-loaded families.')
if __name__=='__main__':build()
