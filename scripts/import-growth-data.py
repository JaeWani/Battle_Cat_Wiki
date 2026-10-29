"""Build auditable growth recipes and official KR reward destinations.
Usage: python scripts/import-growth-data.py SOURCE_DIRECTORY
SOURCE_DIRECTORY contains pinned cat.tsv, units_scheme.json, reward.tsv, titem.tsv.
Only official reward text identifies destinations; no drop probability is invented.
"""
import csv,gzip,hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def build(source):
 meta=json.loads((ROOT/'public/data/meta.json').read_text())
 def table(name):return list(csv.DictReader((source/name).open(),delimiter='\t'))
 expected={'cat.tsv':'01d857c799cad788fdeb1602287b164d431023c8','units_scheme.json':'0ccdab2291758aca6aa5101cf5a1722f68d63b0e','reward.tsv':'03e6eee30b8dd8ecc4385bc6f539335469c1062a','titem.tsv':'27403bc9fb65b1fc94225d9e0b2416997fba8c8a'}
 assert meta['commit']=='4baf8c1b468230a14f9350d646f60d888e3fe75d','Review source pin before updating'
 for name,digest in expected.items():
  blob=(source/name).read_bytes();assert hashlib.sha1(('blob '+str(len(blob))+'\0').encode()+blob).hexdigest()==digest,f'Wrong pinned source: {name}'
 units=table('cat.tsv');rewards=table('reward.tsv');translations=table('titem.tsv');scheme=json.loads((source/'units_scheme.json').read_text());materials={'xp':{'id':'xp','name':'XP'}};out=[]
 def material(ident):
  row=next(r for r in rewards if int(r['id'])==ident);original=row['reward'];names={r['kr'] for r in translations if original in [r['tw'],r['jp']] and r['kr']}
  return {'id':str(ident),'name':next(iter(names)) if len(names)==1 else original,'originalName':original}
 for ident,row in enumerate(units):
  recipes={}
  for form,key in [(2,'evol_require'),(3,'evol4_require')]:
   if not row[key]:continue
   costs={}
   for entry in row[key].split('|'):
    count,item=map(int,entry.split('!'));assert count>0
    name='xp' if item==0 else str(item);costs[name]=costs.get(name,0)+count
    if name not in materials:materials[name]=material(item)
   recipes[str(form)]=costs
  xp=list(map(int,row['xp_curve'].split('|'))) if '|' in row['xp_curve'] else scheme['xp_curves'].get(row['xp_curve'])
  out.append({'id':ident,'maxBaseLevel':int(row['max_base_level'] or 50),'forms':int(row['form_count']),'recipes':recipes,'xpCurve':xp})
 official=json.loads((ROOT/'public/data/stages.json').read_text());destinations=[]
 for m in official['maps']:
  if not m.get('koreanTextVerified'):continue
  for s in m['stages']:
   text=s.get('rewards','');found=[]
   for key,v in materials.items():
    # Exact Korean material names in official rewards; seeds and fruits remain distinct.
    if (key=='xp' and 'XP' in text) or (key!='xp' and v['name'] in text):found.append(key)
   if found:destinations.append({'mapCode':m['code'],'mapName':m['name'],'stageKey':s['key'],'stageName':s['name'],'energy':s.get('energy'),'materials':found,'rewardText':text,'sourceUrl':m['sourceUrl'],'verifiedAt':m['verifiedAt']})
 data={'schemaVersion':1,'source':{'repository':meta['repository'],'commit':meta['commit'],'region':'JP/TW','files':{n:hashlib.sha256((source/n).read_bytes()).hexdigest()for n in ['cat.tsv','units_scheme.json','reward.tsv','titem.tsv']},'note':'도감과 같은 고정 버전 자료. 한국판 수록·밸런스 차이가 있을 수 있습니다. 레벨업은 기본 레벨 50까지의 XP만 산정하며 캣츠아이·해방 조건·본능 비용은 포함하지 않습니다.'},'xpMultipliers':scheme['xp_multipliers'][:5],'materials':list(materials.values()),'units':out,'destinations':destinations,'scheduleLinks':[{'mapCode':'S250','noticeTitle':'종말의 배틀 그라운드','noticeId':'14482'},{'mapCode':'V000','noticeTitle':'풍운 냥코탑','noticeId':'14348'}]}
 (ROOT/'public/data/growth.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');blob=(ROOT/'public/data/growth.json').read_bytes();(ROOT/'artwork/growth.json.gz').write_bytes(gzip.compress(blob,mtime=0));print(f'{len(out)} units, {sum(bool(u["recipes"])for u in out)} recipes, {len(materials)} resources, {len(destinations)} official reward destinations')
if __name__=='__main__':build(Path(sys.argv[1]))
