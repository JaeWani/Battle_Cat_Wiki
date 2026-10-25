import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {categoryOf,hydrateStageGroup} from '../public/js/stages.mjs';
const data=JSON.parse(await readFile('public/data/stages.json','utf8'));
assert.equal(data.officialOnly,true);assert.equal(data.region,'KR');assert(data.maps.length>0);
const official=/^https:\/\/ponosgames\.com\/information\/appli\/battlecats\/stage\/kr\/[A-Z]{1,2}\d{3}\.html$/;
const imageURL=/^https:\/\/ponosgames\.com\/information\/appli\/battlecats\/stage\/kr\/img\/enemy\/enemy_icon_\d+\.png$/;
const images=new Map();
for(const i of data.images){
  assert(imageURL.test(i.sourceUrl));assert.equal(i.processing,'none');
  if(i.availability==='unavailable'){assert.equal(i.path,null);assert.equal(i.sha256,null);assert(i.httpStatus>=400);}
  else{assert(/^stage-assets\/enemy-\d+\.png$/.test(i.path));const bytes=await readFile(`public/${i.path}`);assert.equal(createHash('sha256').update(bytes).digest('hex'),i.sha256);}
  images.set(i.iconCode,i);
}
const codes=new Set();let count=0;
for(const map of data.maps){
  assert(!codes.has(map.code));codes.add(map.code);assert(official.test(map.sourceUrl));assert(Number.isFinite(Date.parse(map.verifiedAt)));assert.notEqual(categoryOf(map),'unclassified');assert(/^[a-f0-9]{64}$/.test(map.sourceSha256));assert.equal(typeof map.koreanTextVerified,'boolean');
  for(const [index,s] of map.stages.entries()){
    assert.equal(s.index,index);assert.equal(s.sourceUrl,map.sourceUrl);assert.equal(typeof s.name,'string');assert.equal(s.namePublished,Boolean(s.name));assert(s.energy===null||Number.isInteger(s.energy));assert(s.baseDisplayOnly);
    assert.equal(new Set(s.enemies.map(e=>e.iconCode)).size,s.enemies.length);
    for(const e of s.enemies){assert.equal(images.get(e.iconCode)?.path,e.image);assert.equal(images.get(e.iconCode)?.sourceUrl,e.sourceUrl);for(const k of ['name','magnification','spawnCount','spawnTime'])assert.equal(e[k],null);}
    count++;
  }
}
const index=JSON.parse(await readFile('public/data/stage-index.json','utf8'));
assert.equal(index.totals.maps,data.maps.length);assert.equal(index.totals.stages,count);assert.equal(index.totals.icons,images.size);
assert.equal(index.maps.length,data.maps.length);assert.equal(index.images.length,data.images.length);
const hydrated=new Map();
for(const path of new Set(index.maps.map(m=>m.detailsPath))){
  assert(/^data\/stage-groups\/[A-Z]{1,2}\.json$/.test(path));
  const group=JSON.parse(await readFile(`public/${path}`,'utf8'));
  for(const map of hydrateStageGroup(group,index.images)){assert(!hydrated.has(map.code));hydrated.set(map.code,map);}
}
for(const map of data.maps){
  assert.deepEqual(hydrated.get(map.code),map);
  const summary=index.maps.find(m=>m.code===map.code);assert.equal(summary.name,map.name);assert.deepEqual(summary.stages,map.stages.map(s=>({index:s.index,name:s.name})));
}
assert.equal(index.familyReport.reduce((n,f)=>n+f.candidateCount,0),data.candidateCount);
assert.equal(index.familyReport.reduce((n,f)=>n+f.verifiedMaps,0),data.maps.length);
assert.equal(index.familyReport.reduce((n,f)=>n+f.unavailableCount,0),data.sourceFailures.length);
assert.equal(data.candidateCount,data.maps.length+data.sourceFailures.length);
console.log(`Verified ${data.maps.length} official maps, ${count} stages, ${images.size} icon references; all lazy-loaded groups match the full source snapshot.`);
