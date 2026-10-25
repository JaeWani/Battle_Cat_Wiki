import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculate,levelMultiplier,statsAt,strikesToKill,searchUnits} from '../public/js/engine.mjs';
const load=f=>JSON.parse(readFileSync(new URL(`../public/data/${f}.json`,import.meta.url)));
const cats=load('cats'),enemies=load('enemies'),meta=load('meta');
const opts={level:30,magnification:100,curves:meta.levelCurves,treasure:true,traitTreasures:true,critical:false};
const cat=()=>({...cats[0],hp:100,attacks:[10,0,0],abilityMask:4,abilities:{},trait:0,maxLevel:200,curve:0});
const enemy=()=>({...enemies[0],hp:100,attacks:[10,0,0],abilityMask:4,abilities:{},trait:256});
test('level curves include the initial .8 and change increment after level 60',()=>{
  assert.equal(levelMultiplier(1,meta.levelCurves[0]),1);
  assert.equal(levelMultiplier(20,meta.levelCurves[0]),4.8);
  assert.equal(levelMultiplier(30,meta.levelCurves[0]),6.8);
  assert.equal(levelMultiplier(70,meta.levelCurves[0]),13.8);
});
test('special growth curve is not replaced by a generic level multiplier',()=>{
  assert.equal(levelMultiplier(30,meta.levelCurves[5]),10.8);
  assert.equal(levelMultiplier(50,meta.levelCurves[5]),40.8);
});
test('known Cat level 20 with max Empire treasure has 1200 HP and 95 attack',()=>{
  const r=statsAt(cats.find(c=>c.key==='0-0'),{...opts,level:20});
  assert.equal(r.hp,1200);assert.equal(r.attack,95);
});
test('known Awakened Bahamut level 30 uses 85k, 3.4k, 5.1k strikes',()=>{
  const r=statsAt(cats.find(c=>c.key==='25-2'),opts);
  assert.equal(r.hp,25500);assert.deepEqual(r.attacks,[85000,3400,5100]);
});
test('treasure off preserves level-scaled base stats',()=>{
  const r=statsAt(cats.find(c=>c.key==='0-0'),{...opts,level:20,treasure:false});
  assert.equal(r.hp,480);assert.equal(r.attack,38);
});
test('enemy magnification applies to both HP and each individual strike',()=>{
  const r=statsAt({...enemy(),attacks:[10,20,0]},{magnification:250});
  assert.equal(r.hp,250);assert.deepEqual(r.attacks,[25,50,0]);
});
test('multi-hit calculation accounts for the lethal strike inside the animation',()=>{
  assert.deepEqual(strikesToKill(150,[100,10,20]),{hits:4,rounds:2,lastIndex:0});
  assert.deepEqual(strikesToKill(130,[100,10,20]),{hits:3,rounds:1,lastIndex:2});
  assert.deepEqual(strikesToKill(200,[100,10,20]),{hits:4,rounds:2,lastIndex:0});
  assert.deepEqual(strikesToKill(260,[100,10,20]),{hits:6,rounds:2,lastIndex:2});
});
test('zero damage returns no possible kill and does not divide by zero',()=>{
  assert.equal(strikesToKill(100,[0,0]).hits,Infinity);
});
test('very large hit counts are calculated without per-hit loops',()=>{
  assert.equal(strikesToKill(1e12,[1]).hits,1e12);
});
test('input rejects empty, negative, fractional levels, NaN, and levels beyond max',()=>{
  for(const level of ['',0,-1,1.5,NaN,Infinity,201])assert.throws(()=>statsAt(cat(),{...opts,level}),RangeError);
  for(const magnification of ['',0,-1,NaN,Infinity,1e6+1])assert.throws(()=>statsAt(enemy(),{magnification}),RangeError);
  assert.doesNotThrow(()=>statsAt(enemy(),{magnification:12.5}));
});
test('normal attacks on metal deal 1 per hit; forced critical is actual conditional damage',()=>{
  const c=cat(),e={...enemy(),trait:8};c.abilities={4:50};
  const normal=calculate(c,e,{...opts,level:1,treasure:false});
  const critical=calculate(c,e,{...opts,level:1,treasure:false,critical:true});
  assert.equal(normal.kill.hits,100);assert.deepEqual(normal.outgoing,[1]);
  assert.deepEqual(critical.outgoing,[20]);assert.equal(critical.kill.hits,5);
});
test('100% critical applies even in normal mode',()=>{
  const c=cat();c.abilities={4:100};assert.deepEqual(calculate(c,{...enemy(),trait:8},{...opts,level:1,treasure:false}).outgoing,[20]);
});
test('crit applies only to ability-enabled multi-hit components',()=>{
  const c={...cat(),attacks:[10,10,10],abilityMask:2,abilities:{4:100}};
  const r=calculate(c,{...enemy(),trait:8},{...opts,level:1,treasure:false});
  assert.deepEqual(r.outgoing,[1,20,1]);
});
test('massive damage on matching trait honors treasure only on treasure traits',()=>{
  const c={...cat(),trait:1,abilities:{28:null}};
  assert.equal(calculate(c,{...enemy(),trait:1},{...opts,level:1,treasure:false}).attackFactor,4);
  assert.equal(calculate(c,{...enemy(),trait:1},{...opts,level:1,treasure:false,traitTreasures:false}).attackFactor,3);
  assert.equal(calculate(c,enemy(),{...opts,level:1,treasure:false}).attackFactor,1);
  c.trait=256;assert.equal(calculate(c,enemy(),{...opts,level:1,treasure:false}).attackFactor,3);
});
test('strong against increases attack and reduces incoming damage',()=>{
  const c={...cat(),trait:1,abilities:{25:null}};
  const r=calculate(c,{...enemy(),trait:1},{...opts,level:1,treasure:false});
  assert.deepEqual(r.outgoing,[18]);assert.deepEqual(r.incoming,[4]);
  assert.equal(r.death.hits,25);
});
test('resistant with treasure reduces damage by five',()=>{
  const c={...cat(),trait:1,abilities:{26:null}};
  assert.deepEqual(calculate(c,{...enemy(),trait:1},{...opts,level:1,treasure:false}).incoming,[2]);
});
test('target-only cannot attack nonmatching trait',()=>{
  const c={...cat(),trait:1,abilities:{24:null}};
  const r=calculate(c,enemy(),{...opts,level:1,treasure:false});
  assert.equal(r.canAttack,false);assert.equal(r.kill.hits,Infinity);
});
test('behemoth slayer supplies attack and resistance factors',()=>{
  const c={...cat(),abilities:{18:[10,30]}};
  const r=calculate(c,{...enemy(),trait:1|8192},{...opts,level:1,treasure:false});
  assert.equal(r.attackFactor,2.5);assert.equal(r.defenseFactor,.6);
});
test('an enemy with no attacks cannot cause a direct-hit death',()=>{
  assert.equal(calculate(cat(),{...enemy(),attacks:[0,0,0]},opts).death.hits,Infinity);
});
test('shield, barrier, revive, and suicide are explicit calculation limitations',()=>{
  const c={...cat(),abilities:{37:null}},e={...enemy(),abilities:{38:[1000],39:[1000,100],35:[1,120,100]}};
  const r=calculate(c,e,opts);assert.equal(r.bodyOnly,true);
  assert.ok(r.notes.some(n=>n.includes('배리어')));assert.ok(r.notes.some(n=>n.includes('실드')));assert.ok(r.notes.some(n=>n.includes('부활')));assert.ok(r.notes.some(n=>n.includes('1회 공격')));
});
test('search normalizes spaces, supports Japanese/English, filters all matching traits',()=>{
  assert.ok(searchUnits(cats,'각성의고양이무트').some(u=>u.key==='25-2'));
  assert.ok(searchUnits(cats,'Awakened Bahamut').some(u=>u.key==='25-2'));
  const red=searchUnits(enemies,'',1);assert.ok(red.length>0);assert.ok(red.every(u=>u.trait&1));
  const mixed=searchUnits([{...enemy(),trait:1|4}], '',4);assert.equal(mixed.length,1);
  assert.equal(searchUnits(enemies,'doesnotexist987654').length,0);
});
test('translation match by source name keeps Teacher Bun Bun separate from Mooth',()=>{
  const bun=enemies.find(u=>u.nameJP==='ぶんぶん先生'),moth=enemies.find(u=>u.nameJP==='ガガガガ');
  assert.equal(bun.id,24);assert.equal(bun.name,'맴매 선생');assert.equal(bun.hp,99999);
  assert.equal(moth.id,22);assert.equal(moth.name,'나나나난나방');assert.equal(moth.hp,5000);
});
test('full imported dataset is calculable at a valid representative level',()=>{
  for(const c of cats){const r=calculate(c,enemies[0],{...opts,level:Math.min(30,c.maxLevel)});assert.ok(r.ally.hp>0);assert.ok(!Number.isNaN(r.kill.hits));}
  for(const e of enemies){const r=calculate(cats[0],e,opts);assert.ok(r.foe.hp>0);assert.ok(!Number.isNaN(r.death.hits));}
});
