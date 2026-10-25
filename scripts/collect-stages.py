"""Import stage metadata ONLY from PONOS first-party Korean stage pages.
No community TSVs, enemy-name mappings, spawn-time/quantity/倍率 estimates.
"""
import argparse, asyncio, hashlib, importlib.util, json, re, sys
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
    if not name:raise ValueError('Official map name not published')
    if name in ['ダミー','더미','DUMMY']:raise ValueError('Official placeholder map')
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
        resource=next(((key,value[0]) for key,value in fields.items() if key.startswith('필요 ')),(None,None))
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
        stages.append({'key':f'{code}-{index}','index':index,'name':clean(names[0].text()),'namePublished':bool(clean(names[0].text())),'energy':int(cost) if cost and cost.isdigit() else None,'costLabel':resource[0],'costText':resource[1],'difficulty':difficulty,'stars':int(re.search(r'\d+',difficulty).group()) if difficulty and re.search(r'\d+',difficulty) else None,'rewards':reward,'enemies':enemies,'enemyListPublished':enemy_block is not None,'sourceUrl':url,'baseDisplayOnly':True})
    if not stages:raise ValueError('No official stages found')
    return {'code':code,'name':name,'sourceUrl':url,'stages':stages,'baseDisplayOnly':True,'koreanTextVerified':bool(re.search('[가-힣]',name+' '.join(s['name'] for s in stages)))}

async def collect(refresh=False):
    try:import aiohttp
    except ImportError:raise RuntimeError('Run python3 -m pip install -r requirements-stages.txt first')
    from datetime import timedelta
    config=json.loads((ROOT/'config/official-stage-sources.json').read_text())
    cache=ROOT/'.openai/stage-cache';cache.mkdir(parents=True,exist_ok=True)
    now=datetime.now(timezone.utc).isoformat();semaphore=asyncio.Semaphore(4)
    failures=[];maps=[];done=0
    previous_path=ROOT/'public/data/stages.json'
    previous=json.loads(previous_path.read_text()) if previous_path.exists() else {'maps':[],'images':[]}
    old_images={i['iconCode']:i for i in previous.get('images',[])}
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=25),connector=aiohttp.TCPConnector(limit=4),headers={'User-Agent':'BattleCatWiki/0.1 (+https://github.com/JaeWani/Battle_Cat_Wiki)'},trust_env=True) as client:
        async def fetch(url,limit):
            async with semaphore:
                async with client.get(url,allow_redirects=False) as response:
                    if response.status==429:raise RuntimeError('Rate limited by PONOS; collection stopped')
                    if response.status!=200:return None,response.status
                    chunks=[];size=0
                    async for chunk in response.content.iter_chunked(65536):
                        size+=len(chunk)
                        if size>limit:raise ValueError('Official response too large')
                        chunks.append(chunk)
                    return b''.join(chunks),200
        async def read(url):
            nonlocal done
            if not re.fullmatch(re.escape(HOST)+r'[A-Z]{1,2}\d{3}\.html',url):raise ValueError('Unexpected stage URL')
            code=url.rsplit('/',1)[-1][:-5];html=cache/(code+'.html');meta=cache/(code+'.json')
            try:
                raw=None;verified=now
                if not refresh and html.exists() and meta.exists():
                    entry=json.loads(meta.read_text());candidate=html.read_bytes()
                    age=datetime.now(timezone.utc)-datetime.fromisoformat(entry['verifiedAt'])
                    if entry['sourceUrl']==url and age<timedelta(hours=24) and hashlib.sha256(candidate).hexdigest()==entry['sha256']:
                        raw=candidate;verified=entry['verifiedAt']
                if raw is None:
                    raw,status=await fetch(url,3_000_000)
                    if raw is None:
                        failures.append({'code':code,'sourceUrl':url,'reason':f'HTTP {status}','checkedAt':now});return
                    html.write_bytes(raw)
                    meta.write_text(json.dumps({'sourceUrl':url,'verifiedAt':now,'sha256':hashlib.sha256(raw).hexdigest()}))
                m=parse_stage_page(raw,url);m['verifiedAt']=verified;m['sourceSha256']=hashlib.sha256(raw).hexdigest();maps.append(m)
            except RuntimeError:raise
            except Exception as error:failures.append({'code':code,'sourceUrl':url,'reason':type(error).__name__+': '+str(error)[:150],'checkedAt':now})
            finally:
                done+=1
                if done%100==0:print(f'Checked {done}/{len(config["sources"])} pages; verified {len(maps)}; unavailable {len(failures)}',flush=True)
        await asyncio.gather(*(read(url) for url in config['sources']))
        print(f'Verified {len(maps)} official map pages; downloading original enemy icons.',flush=True)
        if not maps:raise ValueError('No official stage pages could be verified')
        failed_urls={f['sourceUrl'] for f in failures}
        for m in previous['maps']:
            if m['sourceUrl'] in failed_urls:m['refreshFailed']=True;maps.append(m)
        icons={e['iconCode']:e for m in maps for s in m['stages'] for e in s['enemies']}
        assets=ROOT/'public/stage-assets';assets.mkdir(exist_ok=True)
        async def download(item):
            code,e=item;old=old_images.get(code);path=assets/f'enemy-{code}.png';meta=cache/f'icon-{code}.json'
            if old is None and meta.exists():old=json.loads(meta.read_text())
            if not re.fullmatch(re.escape(HOST)+r'img/enemy/enemy_icon_\d+\.png',e['sourceUrl']):raise ValueError('Unexpected image URL')
            raw=path.read_bytes() if old and old.get('sha256') and old['sourceUrl']==e['sourceUrl'] and path.exists() else None
            if raw is None or hashlib.sha256(raw).hexdigest()!=old['sha256']:
                raw,status=await fetch(e['sourceUrl'],1_000_000)
                if raw is None:return {'iconCode':code,'path':None,'sourceUrl':e['sourceUrl'],'sha256':None,'processing':'none','availability':'unavailable','httpStatus':status,'checkedAt':now,'copyright':'© PONOS Corp. 및 각 권리자'}
            if not raw.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError(f'Not an original PNG: {code}')
            path.write_bytes(raw)
            result={'iconCode':code,'path':f'stage-assets/enemy-{code}.png','sourceUrl':e['sourceUrl'],'sha256':hashlib.sha256(raw).hexdigest(),'processing':'none','availability':'available','copyright':'© PONOS Corp. 및 각 권리자'}
            meta.write_text(json.dumps(result));return result
        manifest=await asyncio.gather(*(download(item) for item in icons.items()))
        missing_icons={i['iconCode'] for i in manifest if i['availability']=='unavailable'}
        for m in maps:
            for stage in m['stages']:
                for enemy in stage['enemies']:
                    if enemy['iconCode'] in missing_icons:enemy['image']=None
    maps.sort(key=lambda m:(m['code'] not in ['V000','S250'],m['code']))
    report=[]
    for family in config['families']:
        prefix=family['prefix'];verified=[m for m in maps if re.match(r'[A-Z]+',m['code']).group()==prefix]
        rejected=[f for f in failures if re.match(r'[A-Z]+',f['code']).group()==prefix]
        report.append({**family,'verifiedMaps':len(verified),'stageCount':sum(len(m['stages']) for m in verified),'koreanMaps':sum(m.get('koreanTextVerified',True) for m in verified),'unavailableCount':len(rejected),'failureReasons':sorted(set(f['reason'] for f in rejected))})
    result={'schemaVersion':2,'region':'KR','collectedAt':now,'sourceType':'PONOS first-party stage HTML','officialOnly':True,'coverage':'공개 목록에서 발견한 후보 경로를 전수 확인한 결과입니다. 전체 게임 목록이나 한국판 출시·현재 개방 여부를 보장하지 않으며, 공식 안내 미확인 계열은 수집 현황에 표시합니다.','limitations':{'enemyNames':'공식 페이지 미기재','magnifications':'공식 페이지 미기재','spawnCounts':'공식 페이지 미기재','spawnTimes':'공식 페이지 미기재','schedules':'PONOS 공식 공지의 제목과 맵 이름이 정확히 일치하는 경우에만 연결'},'candidateCount':len(config['sources']),'familyReport':report,'sourceFailures':sorted(failures,key=lambda f:f['code']),'maps':maps,'images':sorted(manifest,key=lambda i:i['iconCode'])}
    temp=previous_path.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');temp.replace(previous_path)
    print(f'Collected {len(maps)} official maps, {sum(len(m["stages"]) for m in maps)} stages, {len(icons)} official enemy icons; {len(failures)} unavailable pages.',flush=True)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true',help='Revalidate cached official HTML instead of reusing a <24h cache');args=parser.parse_args()
    try:asyncio.run(collect(args.refresh))
    except Exception as error:
        print(f'Official stage collection failed: {type(error).__name__}: {error}. Existing snapshot retained.',file=sys.stderr);sys.exit(1)
