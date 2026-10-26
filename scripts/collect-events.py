"""Collect factual KR event periods and short titles from public PONOS notices.
No game account, authentication credentials, full article mirroring, or inferred dates.
Only dates explicitly written as a period are admitted to the event calendar.
"""
import concurrent.futures, hashlib, html, json, os, re, sys, tempfile, shutil
import urllib.request, urllib.parse
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE='https://nyanko-announcement.ponosgames.com/v1/notices'
VERSION=os.environ.get('BATTLE_CATS_KR_NOTICE_VERSION','150500')
KST=timezone(timedelta(hours=9))
class Node:
    def __init__(self,tag='',attrs=(),parent=None): self.tag=tag;self.attrs=dict(attrs);self.children=[];self.parent=parent
    def all(self):
        yield self
        for child in self.children:
            if isinstance(child,Node): yield from child.all()
    def text(self):
        if self.tag in ['script','style']:return ''
        return ' '.join(c.text() if isinstance(c,Node) else c for c in self.children)
    def find(self,tag=None,cls=None):
        return [n for n in self.all() if (not tag or n.tag==tag) and (not cls or cls in n.attrs.get('class','').split())]
    def ancestor(self,tag):
        p=self.parent
        while p and p.tag!=tag:p=p.parent
        return p
class Parser(HTMLParser):
    VOID={'img','br','hr','meta','input','link','source','wbr','area','base','embed','param','track','col'}
    def __init__(self,text):
        super().__init__(convert_charrefs=True);self.root=Node();self.current=self.root;self.feed(text)
    def handle_starttag(self,tag,attrs):
        n=Node(tag,attrs,self.current);self.current.children.append(n)
        if tag not in self.VOID:self.current=n
    def handle_startendtag(self,tag,attrs): self.handle_starttag(tag,attrs);self.handle_endtag(tag)
    def handle_endtag(self,tag):
        if tag in self.VOID:return
        n=self.current
        while n.parent and n.tag!=tag:n=n.parent
        if n.parent:self.current=n.parent
    def handle_data(self,s):self.current.children.append(s)
def clean(text):return ' '.join(html.unescape(text).split())
def get(url,limit=3_000_000):
    p=urllib.parse.urlparse(url)
    if p.scheme!='https' or p.hostname not in {'nyanko-announcement.ponosgames.com','nyanko-webview.ponosgames.com','ponosgames.com','ponos.s3.amazonaws.com','ponos.s3.dualstack.ap-northeast-1.amazonaws.com'}:raise ValueError('Unexpected source host')
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'BattleCatWiki/0.1 (+https://github.com/JaeWani/Battle_Cat_Wiki)'}),timeout=18) as res:
        if urllib.parse.urlparse(res.url).hostname!=p.hostname:raise ValueError('Unexpected redirect')
        data=res.read(limit+1)
        if len(data)>limit:raise ValueError('Source too large')
        return data

def period(text):
    # Preserve supplied minutes. End is exclusive one minute after the announced last minute.
    pat=r'(?P<y>20\d{2})\s*년\s*(?P<m>\d{1,2})\s*월\s*(?P<d>\d{1,2})\s*일\s*\(\s*(?P<h>\d{1,2}):(?P<min>\d{2})\s*\)\s*[~～〜]\s*(?:(?P<ey>20\d{2})\s*년\s*)?(?P<em>\d{1,2})\s*월\s*(?P<ed>\d{1,2})\s*일\s*\(\s*(?P<eh>\d{1,2}):(?P<emin>\d{2})\s*\)'
    m=re.search(pat,text)
    if not m:return None
    v={k:int(x) if x is not None else None for k,x in m.groupdict().items()}
    year=v['ey'] or v['y']+(1 if v['em']<v['m'] else 0)
    start=datetime(v['y'],v['m'],v['d'],v['h'],v['min'],tzinfo=KST)
    last=datetime(year,v['em'],v['ed'],v['eh'],v['emin'],tzinfo=KST)
    if last<start:return None
    return {'startAt':start.isoformat(),'endAt':(last+timedelta(minutes=1)).isoformat(),'announcedEndAt':last.isoformat()}

def collect():
    now=datetime.now(timezone.utc)
    params={'platform':'google','clientVersion':VERSION,'countryCode':'ko','clearedStageJapan':'300','clearedStageFuture':'300','clearedUniverse':'300'}
    base_url=BASE+'?'+urllib.parse.urlencode(params)
    candidates={}
    # Two recent notice pages plus the official index's featured notices.
    for page in [1,2]:
        url=base_url+f'&page={page}'
        doc=Parser(get(url).decode('utf-8')).root
        for a in doc.find('a'):
            href=a.attrs.get('href','');found=re.search(r'notices/(\d+)',href)
            if not found:continue
            ident=found.group(1);source=urllib.parse.urljoin(BASE,href)
            titles=a.find(cls='newstitle');dates=a.find(cls='newsdate');tag=a.find(cls='newstag')
            if ident not in candidates:candidates[ident]={'id':ident,'sourceUrl':source,'title':'','publishedOn':None,'category':'event'}
            if titles:
                candidates[ident].update(title=clean(titles[0].text()),publishedOn=clean(dates[0].text()).replace('.','-') if dates else None,category='gacha' if tag and '뽑기' in clean(tag[0].text()) else 'event')
        if page==1 and not candidates:raise ValueError('No KR notices found; source markup may have changed')
    errors=[]
    staging=tempfile.TemporaryDirectory(prefix='battle-cat-events-');image_dir=Path(staging.name)
    def detail(entry):
        try:
            doc=Parser(get(entry['sourceUrl']).decode('utf-8')).root
            title=doc.find('h1')
            if title:entry['title']=clean(title[0].text())
            if not entry['title']:raise ValueError('Missing title')
            if '뽑기' in entry['title']:entry['category']='gacha'
            elif any(s in entry['title'] for s in ['로그인','선물','배포']):entry['category']='reward'
            content=doc.find(cls='content')
            if not content:raise ValueError('Notice body missing')
            body=clean(content[0].text())
            blocks=[clean(n.text()) for n in content[0].find(cls='block')]
            main=next((b for b in blocks if '개최 기간' in b and period(b)),None)
            p=period(main) if main else period(body)
            entry['period']=p
            # The schedule is a factual extraction, not a reproduction of the article.
            entry['periodSource']='공식 공지 개최 기간' if p else None
            entry['recurrence']=None
            if not p and '매주 토요일, 일요일 각각 개최' in body:
                entry['recurrence']={'frequency':'weekly','weekdays':[0,6],'timeKnown':False,'label':'매주 토요일 · 일요일 · 시간은 공지 확인'}
            if not p and re.search(r'매월\s*22일\s*한정',body+' '+entry['title']):
                entry['recurrence']={'frequency':'monthly','monthDays':[22],'timeKnown':False,'label':'매월 22일 · 시간은 공지 확인'}
            entry['source']='PONOS 한국판 공식 공지';entry['region']='KR';entry['verifiedAt']=now.isoformat()
            # Only first-party original banners; no transformations or generated replacements.
            imgs=content[0].find('img')
            entry['image']=None
            if imgs:
                src=imgs[0].attrs.get('src','')
                try:
                    raw=get(src,2_000_000)
                    ext='png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else 'jpg' if raw.startswith(b'\xff\xd8') else None
                    if not ext:raise ValueError('Unsupported banner format')
                    path=f'event-assets/notice-{entry["id"]}.{ext}'
                    (image_dir/Path(path).name).write_bytes(raw)
                    entry['image']={'path':path,'sourceUrl':urllib.parse.urlunsplit((*urllib.parse.urlsplit(src)[:3],'','')),'sha256':hashlib.sha256(raw).hexdigest(),'copyright':'© PONOS Corp. 및 각 권리자','processing':'none'}
                except Exception as error:entry['imageError']=type(error).__name__
            return entry
        except Exception as error:
            errors.append({'id':entry['id'],'reason':type(error).__name__})
            return None
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        entries=[e for e in executor.map(detail,list(candidates.values())) if e]
    if errors:raise ValueError(f'{len(errors)} official notice requests failed; refusing to replace the complete snapshot')
    if not entries or not any(e['period'] for e in entries):raise ValueError('No explicit KR event periods found')
    entries.sort(key=lambda e:e['publishedOn'] or '',reverse=True)
    # A recurring event can be announced again each week. Keep its latest notice once.
    unique=[];seen=set()
    for entry in entries:
        key=(entry['title'],json.dumps(entry['period'] or entry['recurrence'],sort_keys=True))
        if (entry['period'] or entry['recurrence']) and key in seen:continue
        seen.add(key);unique.append(entry)
    entries=unique
    result={'schemaVersion':1,'region':'KR','timezone':'Asia/Seoul','collectedAt':now.isoformat(),'sourceUrl':base_url,'sourceLabel':'PONOS 한국판 공식 공지','clientVersion':VERSION,'coverage':'공식 공지에서 확인한 대표 개최 기간과 반복 개최일. 전체 인게임 일정이나 미발표 일정은 포함하지 않습니다.','collectionErrors':errors,'events':entries}
    (ROOT/'public/event-assets').mkdir(exist_ok=True)
    for entry in entries:
        if entry['image']:shutil.copyfile(image_dir/Path(entry['image']['path']).name,ROOT/'public'/entry['image']['path'])
    staging.cleanup()
    (ROOT/'public/data/events.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Collected {len(entries)} official notices, {sum(bool(e["period"]) for e in entries)} explicit periods, {sum(bool(e["recurrence"]) for e in entries)} recurring schedules; {len(errors)} detail errors.')
if __name__=='__main__':
    try:collect()
    except Exception as error:
        print(f'Event collection failed: {type(error).__name__}: {error}. Existing snapshot preserved.',file=sys.stderr)
        sys.exit(1)
