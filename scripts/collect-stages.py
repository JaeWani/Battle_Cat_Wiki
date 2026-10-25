"""Import stage metadata ONLY from PONOS first-party Korean stage pages.
No community TSVs, enemy-name mappings, spawn-time/quantity/倍率 estimates.
"""
import concurrent.futures, hashlib, importlib.util, json, re, sys, tempfile, shutil
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('official_events',ROOT/'scripts/collect-events.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
Parser,clean,get=base.Parser,base.clean,base.get
HOST='https://ponosgames.com/information/appli/battlecats/stage/kr/'

def visible_text(node):
    # Player-specific hidden state labels are not factual drop-reward metadata.
    if any(c in node.attrs.get('class','').split() for c in ['drop','nodrop']):return ''
    return ' '.join(visible_text(c) if isinstance(c,base.Node) else c for c in node.children)
def parse_stage_page(raw,url):
    if not re.fullmatch(r'https://ponosgames\.com/information/appli/battlecats/stage/kr/[A-Z]{1,2}\d{3}\.html',url):raise ValueError('Nonofficial stage URL')
    doc=Parser(raw.decode('utf-8-sig')).root
    title=doc.find('h2')
    if not title:raise ValueError('Missing official map title')
    name=clean(title[0].text());code=url.rsplit('/',1)[-1][:-5]
    stages=[]
    for block in doc.find('div'):
        match=re.fullmatch(r'stage(\d+)_block',block.attrs.get('id',''))
        if not match:continue
        index=int(match.group(1));names=block.find(cls='stage')
        if not names:raise ValueError('Missing stage name')
        fields={}
        for row in block.find('tr'):
            th=row.find('th');td=row.find('td')
            if th and td:fields[clean(th[0].text())]=(clean(visible_text(td[0])),td[0])
        cost=fields.get('필요 통솔력',(None,None))[0]
        difficulty=fields.get('난이도',(None,None))[0]
        reward=fields.get('드롭 보상',(None,None))[0]
        enemy_block=next((n for n in block.find('div') if n.attrs.get('id')==f'stage{index}_enemy_list_1'),None)
        enemies=[]
        if enemy_block:
            seen=set()
            for image in enemy_block.find('img'):
                source=urllib.parse.urljoin(url,image.attrs.get('src',''))
                m=re.fullmatch(r'https://ponosgames\.com/information/appli/battlecats/stage/kr/img/enemy/enemy_icon_(\d+)\.png',source)
                if not m:continue  # Never turn unknown/placeholder icons into enemy records.
                icon=m.group(1)
                if icon in seen:continue
                seen.add(icon);enemies.append({'iconCode':icon,'sourceUrl':source,'image':f'stage-assets/enemy-{icon}.png','name':None,'magnification':None,'spawnCount':None,'spawnTime':None})
        stages.append({'key':f'{code}-{index}','index':index,'name':clean(names[0].text()),'energy':int(cost) if cost and cost.isdigit() else None,'difficulty':difficulty,'stars':int(re.search(r'\d+',difficulty).group()) if difficulty and re.search(r'\d+',difficulty) else None,'rewards':reward,'enemies':enemies,'enemyListPublished':enemy_block is not None,'sourceUrl':url,'baseDisplayOnly':True})
    if not stages:raise ValueError('No official stages found')
    return {'code':code,'name':name,'sourceUrl':url,'stages':stages,'baseDisplayOnly':True}

def collect():
    config=json.loads((ROOT/'config/official-stage-sources.json').read_text())
    now=datetime.now(timezone.utc).isoformat();failures=[]
    def read(url):
        try:
            m=parse_stage_page(get(url),url);m['verifiedAt']=now;return m
        except Exception as error:
            failures.append({'sourceUrl':url,'reason':type(error).__name__});return None
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        maps=[m for m in pool.map(read,config['sources']) if m]
    print(f'Verified {len(maps)} map pages; downloading official enemy icons.',flush=True)
    if not maps:raise ValueError('No official stage pages could be verified')
    previous_path=ROOT/'public/data/stages.json'
    previous=json.loads(previous_path.read_text()) if previous_path.exists() else {'maps':[],'images':[]}
    if failures:
        failed_urls={f['sourceUrl'] for f in failures}
        for m in previous['maps']:
            if m['sourceUrl'] in failed_urls:maps.append(m)
    # Each official icon is downloaded once. Do not use the community image archive.
    icons={e['iconCode']:e for m in maps for s in m['stages'] for e in s['enemies']}
    old_images={i['iconCode']:i for i in previous.get('images',[])}
    with tempfile.TemporaryDirectory(prefix='official-stages-') as folder:
        temp=Path(folder)
        def download(item):
            code,e=item;old=old_images.get(code);path=ROOT/'public'/e['image']
            # Reuse only unchanged, previously verified PONOS originals.
            raw=path.read_bytes() if old and old['sourceUrl']==e['sourceUrl'] and path.exists() else None
            if raw is None or hashlib.sha256(raw).hexdigest()!=old['sha256']:raw=get(e['sourceUrl'],1_000_000)
            if not raw.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError(f'Not an original PNG: {code}')
            (temp/f'enemy-{code}.png').write_bytes(raw)
            return {'iconCode':code,'path':e['image'],'sourceUrl':e['sourceUrl'],'sha256':hashlib.sha256(raw).hexdigest(),'processing':'none','copyright':'© PONOS Corp. 및 각 권리자'}
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:manifest=list(pool.map(download,icons.items()))
        assets=ROOT/'public/stage-assets';assets.mkdir(exist_ok=True)
        for image in manifest:shutil.copyfile(temp/Path(image['path']).name,ROOT/'public'/image['path'])
    maps.sort(key=lambda m:(m['code'] not in ['V000','S250'],m['code']))
    result={'schemaVersion':1,'region':'KR','collectedAt':now,'sourceType':'PONOS first-party stage HTML','officialOnly':True,'coverage':'설정된 PONOS 한국판 안내 페이지에서 직접 확인한 기본 표시 정보. 게임의 모든 스테이지·성급·출진 조건을 포함하지 않습니다.','limitations':{'enemyNames':'공식 페이지 미기재','magnifications':'공식 페이지 미기재','spawnCounts':'공식 페이지 미기재','spawnTimes':'공식 페이지 미기재','schedules':'PONOS 공식 공지의 제목과 맵 이름이 정확히 일치하는 경우에만 연결'},'sourceFailures':failures,'maps':maps,'images':manifest}
    previous_path.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(f'Collected {len(maps)} official maps, {sum(len(m["stages"]) for m in maps)} stages, {len(icons)} official enemy icons; {len(failures)} unavailable source pages.')
if __name__=='__main__':
    try:collect()
    except Exception as error:
        print(f'Official stage collection failed: {type(error).__name__}: {error}. Existing snapshot retained.',file=sys.stderr);sys.exit(1)
