import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {effectiveMagnification,wikiComparison} from '../public/js/stage-battles.mjs';
const read=async p=>JSON.parse(await readFile(new URL('../public/data/'+p,import.meta.url)));
test('separate HP and attack, crown exemption, fractional percentages',()=>{
 assert.deepEqual(effectiveMagnification({hpPercent:250,attackPercent:400,crownApplies:true},130),{hp:325,attack:520});
 assert.deepEqual(effectiveMagnification({hpPercent:50,attackPercent:100,crownApplies:false},200),{hp:50,attack:100});
});
test('every published stage has a coverage outcome and known enemy references',async()=>{
 const official=await read('stage-index.json'),enemies=new Set((await read('enemies.json')).map(e=>e.id));let available=0,missing=0;
 for(const prefix of [...new Set(official.maps.map(m=>m.code.match(/^[A-Z]+/)[0]))]){
  const {maps}=await read('stage-battles/'+prefix+'.json');
  for(const m of official.maps.filter(m=>m.code.startsWith(prefix)&&m.code.match(/^[A-Z]+/)[0]===prefix)){
   assert(maps[m.code].crowns.every(n=>Number.isFinite(n)&&n>0));
   for(const s of m.stages){const r=maps[m.code].stages[s.index];assert(r);
    if(r.status==='available'){available++;assert(r.enemies.length);for(const e of r.enemies){assert(enemies.has(e.enemyId));assert(e.hpPercent>0&&e.attackPercent>0);}}
    else {missing++;assert.equal(r.enemies.length,0);}
   }
  }
 }
 const audit=await read('stage-battle-audit.json');assert.equal(available,audit.coveredStages);assert.equal(missing,audit.unavailable.length);assert.equal(available+missing,audit.totalStages);
});
test('reviewed wiki samples match the game values, without claiming full wiki verification',async()=>{
 const wiki=await read('stage-wiki-checks.json'),group=await read('stage-battles/V.json');
 for(const s of wiki.stages)for(const observation of s.enemies)assert.equal(wikiComparison(group.maps[s.mapCode].stages[s.stageIndex].enemies,observation),'matched');
 assert.equal(wikiComparison([],undefined),'unchecked');
});
