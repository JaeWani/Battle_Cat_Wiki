"""Join the pinned MIT game dataset to official map/stage identifiers.
The official snapshot stays unchanged. Unmatched rows are explicitly unavailable.
Usage: python3 scripts/build-stage-battles.py /path/to/battlecatsinfo/data
"""
import csv, hashlib, json, re, sys
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PREFIXES=['N','S','C','CH','E','T','V','R','M','NA','B','A','H','CA','Q','L','ND','SR','G','P']
COMMIT='4baf8c1b468230a14f9350d646f60d888e3fe75d'
def parse_line(line):
    fields=line.split(',')
    if len(fields)<8:raise ValueError('Incomplete enemy line')
    mags=fields[7].split('+')
    hp=int(mags[0] or '2s',36)
    atk=int((mags[1] if len(mags)>1 else mags[0]) or '2s',36)
    if hp<=0 or atk<=0:raise ValueError('Invalid magnification')
    return {'enemyId':int(fields[0],36),'hpPercent':hp,'attackPercent':atk,'crownApplies':len(fields[6])!=2}
def encode(v):return (json.dumps(v,ensure_ascii=False,separators=(',',':'))+'\n').encode()
def build(source):
    maps={int(r['id'],36):r for r in csv.DictReader((source/'map.tsv').open(),delimiter='\t')}
    stages={int(r['id'],36):r for r in csv.DictReader((source/'stage.tsv').open(),delimiter='\t')}
    official=json.loads((ROOT/'public/data/stages.json').read_text())
    families=defaultdict(dict);covered=0;unavailable=[];variants=0
    for m in official['maps']:
        prefix=re.match('[A-Z]+',m['code'])[0];number=int(m['code'][len(prefix):]);group=PREFIXES.index(prefix)
        mr=maps.get(group*1000+number)
        out={'crowns':[int(x) for x in mr['stars'].split(',')] if mr and mr['stars'] else [100],'stages':{}}
        for s in m['stages']:
            stage_id=group*1000000+number*1000+s['index'];r=stages.get(stage_id)
            row={'gameStageId':stage_id,'status':'missing-game-stage','enemies':[]}
            if r:
                lines=[parse_line(x) for x in r['enemy_lines'].split('|') if x]
                game_ids={x['enemyId'] for x in lines};official_ids={int(x['iconCode']) for x in s['enemies']}
                if official_ids<=game_ids:
                    unique={tuple(x.values()):x for x in lines}
                    row.update(status='available',enemies=list(unique.values()));covered+=1;variants+=len(unique)
                else:row['status']='enemy-list-mismatch'
            if row['status']!='available':unavailable.append({'stageKey':s['key'],'reason':row['status']})
            out['stages'][str(s['index'])]=row
        families[prefix][m['code']]=out
    dest=ROOT/'public/data/stage-battles';dest.mkdir(exist_ok=True)
    for prefix,m in families.items():(dest/(prefix+'.json')).write_bytes(encode({'schemaVersion':1,'maps':m}))
    report={'schemaVersion':1,'source':{'repository':'https://github.com/battlecatsinfo/battlecatsinfo.github.io','commit':COMMIT,'files':{name:hashlib.sha256((source/name).read_bytes()).hexdigest() for name in ['map.tsv','stage.tsv']},'license':'MIT','region':'JP/TW','magnificationUnit':'percent','treasureAssumption':'Alien crystal maximum; account treasure modifiers are not included.'},'totalStages':sum(len(m['stages']) for m in official['maps']),'coveredStages':covered,'enemyVariants':variants,'unavailable':unavailable}
    (ROOT/'public/data/stage-battle-audit.json').write_bytes(encode(report));print(json.dumps({k:v for k,v in report.items() if k not in ['source','unavailable']}), 'unavailable',len(unavailable))
if __name__=='__main__':build(Path(sys.argv[1]))
