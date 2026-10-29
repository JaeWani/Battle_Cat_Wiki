import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validGoal,validPlan,requirements,goalCost,destinationStatus,activityCandidates} from '../public/js/growth-model.mjs';
const data=JSON.parse(readFileSync(new URL('../public/data/growth.json',import.meta.url)));
const goal=(id=32)=>({id,currentLevel:29,currentForm:1,targetLevel:30,targetForm:2});
const now=new Date('2026-10-29T05:00:00Z'),fresh={region:'KR',collectedAt:'2026-10-29T04:00:00Z',events:[]};
const dest={mapCode:'V000'},event={id:'test',region:'KR',category:'event',title:'풍운 냥코탑',period:{startAt:'2026-10-28T00:00:00+09:00',endAt:'2026-10-30T00:00:00+09:00'}};
test('growth source matches the catalog pin and official reward statements',()=>{
 const meta=JSON.parse(readFileSync(new URL('../public/data/meta.json',import.meta.url)));assert.equal(data.source.commit,meta.commit);assert.equal(data.units.length,882);
 for(const d of data.destinations){assert.match(d.sourceUrl,/^https:\/\/ponosgames.com\/information\/appli\/battlecats\/stage\/kr\//);for(const id of d.materials)assert.ok(d.rewardText.includes(data.materials.find(m=>m.id===id).name));}
 const u=data.units[32];assert.deepEqual(u.recipes['2'],{xp:500000,35:2,36:4,37:1,39:1,40:1});
});
test('multiple goals share one stock allocation; XP excludes plus levels',()=>{
 const plan={version:1,goals:[goal(30),goal(32)],stock:{xp:600000,35:2}};
 const r=requirements(plan,data,{cats:[{id:32,level:30,plus:20,form:1}]});
 assert.equal(r.goals[1].costs.xp,500000);assert.equal(r.materials.find(m=>m.id==='35').missing,2);
 assert.equal(r.materials.find(m=>m.id==='xp').missing,r.goals[0].costs.xp+500000-600000);
});
test('completed goals do not charge again and account progress updates costs',()=>{
 assert.deepEqual(goalCost(goal(),data,{cats:[{id:32,level:40,form:2}]}).costs,{});
 assert.equal(goalCost(goal(),data,{cats:[{id:32,level:40,form:2}]}).done,true);
 const g={...goal(),currentForm:2,targetForm:2};assert.deepEqual(goalCost(g,data,{cats:[{id:32,level:30,form:0}]}).costs,{});
});
test('missing costs never mean free evolution, or confirmed readiness',()=>{
 assert.equal(goalCost({...goal(0),currentLevel:10,targetLevel:20},data).complete,false);
 const result=goalCost({...goal(75),currentLevel:49,targetLevel:60,currentForm:2,targetForm:3},data);assert.equal(result.complete,false);assert.ok(result.notes.some(n=>n.includes('51')));
 assert.equal(goalCost({...goal(),targetLevel:40,targetForm:1},data).complete,false);
});
test('plan validation rejects invalid quantities, targets and duplicate goals',()=>{
 for(const bad of [{...goal(),targetLevel:28},{...goal(),targetForm:8},{...goal(),id:9999},{...goal(),currentLevel:2.5}])assert.throws(()=>validGoal(bad,data));
 for(const stock of [{xp:-1},{xp:1.5},{xp:1e13}])assert.throws(()=>validPlan({version:1,goals:[],stock},data));
 assert.throws(()=>validPlan({version:1,goals:[goal(),goal()],stock:{}},data));
 assert.throws(()=>validPlan({version:1,goals:Array(25).fill(goal()),stock:{}},data));
 const raw={version:1,goals:[goal()],stock:{xp:1,unknown:99}};assert.deepEqual(validPlan(raw,data).stock,{xp:1});
});
test('schedule uses reviewed exact links and does not infer from keywords',()=>{
 assert.equal(destinationStatus(dest,data,{...fresh,events:[event]},now).code,'ongoing');
 assert.equal(destinationStatus({mapCode:'S001'},data,{...fresh,events:[event]},now).code,'unknown');
 assert.equal(destinationStatus(dest,data,{...fresh,events:[{...event,title:'風雲 '+event.title}]},now).code,'unknown');
 assert.equal(destinationStatus(dest,data,{...fresh,events:[{...event,category:'gacha'}]},now).code,'unknown');
 assert.equal(destinationStatus(dest,data,{...fresh,events:[{...event,region:'JP'}]},now).code,'unknown');
});
test('ended, upcoming, stale and malformed dates cannot be presented as ongoing',()=>{
 const snapshot={...fresh,events:[event]};assert.equal(destinationStatus(dest,data,snapshot,new Date('2026-10-30T00:00:00+09:00')).code,'ended');
 assert.equal(destinationStatus(dest,data,snapshot,new Date('2026-10-27T00:00:00+09:00')).code,'stale');
 assert.equal(destinationStatus(dest,data,{...fresh,collectedAt:'2026-10-25T00:00:00Z',events:[event]},now).code,'stale');
 assert.equal(destinationStatus(dest,data,{...snapshot,collectionErrors:['network']},now).code,'stale');
 assert.equal(destinationStatus(dest,data,{...snapshot,events:[{...event,period:{startAt:'bad',endAt:'bad'}}]},now).code,'unknown');
 assert.equal(destinationStatus(dest,data,{...snapshot,events:[{...event,period:{startAt:'2026-10-30T00:00:00+09:00',endAt:'2026-10-31T00:00:00+09:00'}}]},now).code,'upcoming');
});
test('recurring dates have no current-open claim, and expired collection loses trust',()=>{
 const recurring={...event,title:'종말의 배틀 그라운드',period:null,recurrence:{frequency:'weekly',weekdays:[0,6],timeKnown:false}};
 assert.equal(destinationStatus({mapCode:'S250'},data,{...fresh,events:[recurring]},now).code,'other-day');
 const weekend=new Date('2026-10-31T03:00:00Z');assert.equal(destinationStatus({mapCode:'S250'},data,{...fresh,collectedAt:weekend.toISOString(),events:[recurring]},weekend).code,'day');
 assert.ok(activityCandidates('xp',data,fresh,now).length>0);assert.equal(activityCandidates('not-a-material',data,fresh,now).length,0);
});
