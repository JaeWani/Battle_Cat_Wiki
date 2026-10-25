"""Import numerical TSVs and byte-identical game thumbnails; no webpage mirroring.
Usage: python scripts/import-data.py /path/to/data-repo /path/to/img-repo
"""
import csv, hashlib, json, shutil, subprocess, sys, unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DATA, IMAGES = map(Path, sys.argv[1:3])
OUT = ROOT / 'public'
def rows(name):
    return list(csv.DictReader((DATA / 'data' / name).open(encoding='utf-8'), delimiter='\t'))
def sha(repo):
    return subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD'],text=True).strip()
def abilities(text):
    result = {}
    for entry in filter(None, text.split('|')):
        if '@' in entry:
            k,v = entry.split('@',1); result[k] = list(map(int,v.split('!')))
        else:
            k,v = entry.split('&',1); result[k] = int(v) if v else None
    return result
manifest=[]
def image(path):
    src=IMAGES/path
    if not src.is_file(): raise FileNotFoundError(src)
    dest=OUT/'assets'/path; dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(src,dest)
    manifest.append({'path':'assets/'+path,'source':path,'sha256':hashlib.sha256(src.read_bytes()).hexdigest()})
    return 'assets/'+path
def unit(r):
    nums={'hp':'health_point','kb':'knockbacks','speed':'speed','range':'range','attackF':'attack_frequency','atkType':'attack_type','trait':'trait','abilityMask':'ability_enabled','immunity':'immunity'}
    u={k:int(r[v] or 0) for k,v in nums.items()}
    u.update({'attacks':[int(r[f'attack_power_{i}'] or 0) for i in range(1,4)],'preswings':[int(r[f'preswing_{i}'] or 0) for i in range(1,4)],'abilities':abilities(r['ability']),'longStart':list(map(int,r['long_distance_1'].split('|'))) if r['long_distance_1'] else [],'longLength':list(map(int,r['long_distance_2'].split('|'))) if r['long_distance_2'] else []})
    return u
def normalized(s):
    return ''.join(unicodedata.normalize('NFKC',s).split())
def translations(table,forms=False):
    candidates=defaultdict(list)
    for r in table:
        jp=r['jp'].split('|') if forms else [r['jp']]
        kr=r['kr'].split('|') if forms else [r['kr']]
        en=r['en'].split('|') if forms else [r['en']]
        for i,name in enumerate(jp):
            if name: candidates[normalized(name)].append({'kr':kr[i] if i<len(kr) else '', 'en':en[i] if i<len(en) else ''})
    result={}
    for k,values in candidates.items():
        # Do not guess when different records use the same Japanese display name.
        result[k]={lang:next(iter(vals)) if len(vals:=set(v[lang] for v in values if v[lang]))==1 else '' for lang in ['kr','en']}
    return result
names=translations(rows('tcat.tsv'),True); metas=rows('cat.tsv'); forms=defaultdict(int); cats=[]
for r in rows('catstat.tsv'):
    ident=int(r['id']); f=forms[ident]; forms[ident]+=1; meta=metas[ident]; trans=names.get(normalized(r['name_jp']), {'kr':'','en':''})
    eggs=meta['egg_id'].split(',') if meta['egg_id'] else []
    p=f's/{eggs[f]}/{f}.png' if f<len(eggs) else f'u/{ident}/{f}.png'
    kr=trans['kr']; en=trans['en']
    maxlevel=int(meta['max_base_level'] or 50)+int(meta['max_plus_level'] or 0)
    cats.append(dict(unit(r),id=ident,key=f'{ident}-{f}',form=f,name=kr or r['name_jp'] or f'아군 #{ident}',nameJP=r['name_jp'],nameEN=en,koreanName=bool(kr),rarity=int(meta['rarity']),maxLevel=maxlevel,curve=int(meta['level_curve'] or 0),price=int(r['price'] or 0),cooldown=int(r['cd'] or 0),image=image(p)))
ens=translations(rows('tenemy.tsv')); enemies=[]
for r in rows('enemy.tsv'):
    ident=int(r['id']); trans=ens.get(normalized(r['name_jp']), {'kr':'','en':r['name_fandom'].replace('_',' ')})
    enemies.append(dict(unit(r),id=ident,key=str(ident),name=trans['kr'] or r['name_jp'] or f'기타 적 #{ident}',nameJP=r['name_jp'],nameEN=trans['en'],koreanName=bool(trans['kr']),star=int(r['star'] or 0),image=image(f'e/{ident}/0.png')))
scheme=json.loads((DATA/'data/units_scheme.json').read_text()); config=json.loads((DATA/'data/config.json').read_text())
source={'repository':'https://github.com/battlecatsinfo/battlecatsinfo.github.io','commit':sha(DATA),'imagesRepository':'https://github.com/battlecatsinfo/img','imagesCommit':sha(IMAGES),'importedAt':datetime.now(timezone.utc).isoformat(),'japanVersion':config['japan'],'taiwanVersion':config['taiwan'],'note':'일본판/대만판 기반 커뮤니티 데이터. 한국어 이름은 번역표 사용. 한국판 수록 여부 및 밸런스는 다를 수 있음.','catCount':len(metas),'formCount':len(cats),'enemyCount':len(enemies)}
for filename,obj in [('cats.json',cats),('enemies.json',enemies),('meta.json',dict(source,levelCurves=scheme['levelcurves'])),('images-manifest.json',{'repository':source['imagesRepository'],'commit':source['imagesCommit'],'processing':'none; byte-identical copies of source game-art thumbnails; no generated or fan-art substitutes','files':manifest})]:
    (OUT/'data'/filename).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(ROOT/'THIRD_PARTY_LICENSES.txt').write_text('Numerical dataset and calculation references: battlecatsinfo/battlecatsinfo.github.io\n'+source['repository']+'\nCommit: '+source['commit']+'\n\n'+(DATA/'LICENSE').read_text()+'\n\nGame artwork: © PONOS Corp. and respective collaboration rights holders.\nCommunity archive: '+source['imagesRepository']+'\nCommit: '+source['imagesCommit']+'\nArtwork is not relicensed under the software MIT license. This is an unofficial fan tool, not endorsed by PONOS. The archive is not an official PONOS distribution channel; no explicit commercial artwork license is asserted.\n',encoding='utf-8')
shutil.copyfile(ROOT/'THIRD_PARTY_LICENSES.txt',OUT/'THIRD_PARTY_LICENSES.txt')
print(json.dumps(source,ensure_ascii=False,indent=2)); print('Assets:',len(manifest),'Size:',sum((OUT/x['path']).stat().st_size for x in manifest))
