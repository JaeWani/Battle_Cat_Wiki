import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {categoryOf} from '../public/js/stages.mjs';
const data=JSON.parse(await readFile('public/data/stages.json','utf8'));
assert.equal(data.officialOnly,true);assert.equal(data.region,'KR');assert(data.maps.length>0);
const official=/^https:\/\/ponosgames\.com\/information\/appli\/battlecats\/stage\/kr\/[A-Z]{1,2}\d{3}\.html$/;
const imageURL=/^https:\/\/ponosgames\.com\/information\/appli\/battlecats\/stage\/kr\/img\/enemy\/enemy_icon_\d+\.png$/;
const images=new Map();
for(const i of data.images){
  assert(imageURL.test(i.sourceUrl));assert.equal(i.processing,'none');assert(/^stage-assets\/enemy-\d+\.png$/.test(i.path));
  const bytes=await readFile(`public/${i.path}`);assert.equal(createHash('sha256').update(bytes).digest('hex'),i.sha256);images.set(i.iconCode,i);
}
const codes=new Set();let count=0;
for(const map of data.maps){
  assert(!codes.has(map.code));codes.add(map.code);assert(official.test(map.sourceUrl));assert(Number.isFinite(Date.parse(map.verifiedAt)));assert.notEqual(categoryOf(map),'unclassified');
  for(const [index,s] of map.stages.entries()){
    assert.equal(s.index,index);assert.equal(s.sourceUrl,map.sourceUrl);assert(s.name);assert(s.energy===null||Number.isInteger(s.energy));assert(s.baseDisplayOnly);
    assert.equal(new Set(s.enemies.map(e=>e.iconCode)).size,s.enemies.length);
    for(const e of s.enemies){assert.equal(images.get(e.iconCode)?.path,e.image);assert.equal(images.get(e.iconCode)?.sourceUrl,e.sourceUrl);for(const k of ['name','magnification','spawnCount','spawnTime'])assert.equal(e[k],null);}
    count++;
  }
}
console.log(`Verified ${data.maps.length} official maps, ${count} stages, ${images.size} original PONOS icons.`);
