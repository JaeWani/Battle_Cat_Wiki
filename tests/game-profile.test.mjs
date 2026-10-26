import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {groupCharacters,createGameDraft,draftCat,validateGameDraft,importTalentChoices,talentSummary} from '../public/js/game-profile-model.mjs';
import {parseSave} from '../public/js/save-parser.mjs';
import {saveFixture,signFixture} from './helpers/save-fixture.mjs';
const cats=JSON.parse(await readFile(new URL('../public/data/cats.json',import.meta.url)));
const options=JSON.parse(await readFile(new URL('../public/data/profile-options.json',import.meta.url)));
const groups=groupCharacters(cats,options),group=groups.find(g=>g.id===9),ability=group.talents[0];
test('every character and evolution is editable; talents have stable ability IDs and bounded levels',()=>{
 assert.equal(groups.length,882);assert.equal(groups.reduce((n,g)=>n+g.forms.length,0),cats.length);
 for(const g of groups){assert.equal(new Set(g.talents.map(t=>t.id)).size,g.talents.length);for(const t of g.talents)assert.ok(t.maxLevel>=1&&t.maxLevel<=10);}
 assert.ok(groups.some(g=>g.talents.some(t=>t.super)));
});
test('manual ownership, form, levels and partial talent information survive snapshot serialization',()=>{
 const draft=createGameDraft(null),c=draftCat(draft,group);c.owned=true;c.form=group.forms.at(-1).form;c.level=50;c.plus=3;c.talents=[{id:ability.id,level:4}];
 const snapshot=validateGameDraft(draft,groups);assert.equal(snapshot.source,'manual');assert.equal(snapshot.gameVersion,null);assert.equal(snapshot.progressKnown,false);
 assert.deepEqual(createGameDraft(snapshot).cats.get(9),{...snapshot.cats[0],owned:true});
 assert.match(talentSummary(c,group.talents),/미확인/);
 c.owned=false;assert.equal(validateGameDraft(draft,groups).cats.length,0);c.owned=true;assert.equal(validateGameDraft(draft,groups).cats[0].talents[0].level,4);
});
test('manual changes keep imported progress and do not mutate the original snapshot',()=>{
 const saved=parseSave(saveFixture()),draft=createGameDraft(saved);draft.cats.get(0).level=30;
 const snapshot=validateGameDraft(draft,groups);assert.equal(saved.cats[0].level,20);assert.deepEqual(snapshot.progress,saved.progress);assert.equal(snapshot.source,'mixed');
});
test('invalid levels and unsupported, duplicate or excessive talents cannot serialize',()=>{
 const draft=createGameDraft(null),c=draftCat(draft,group);c.owned=true;
 for(const value of [NaN,0,1.5,201]){c.level=value;assert.throws(()=>validateGameDraft(draft,groups));}c.level=30;
 for(const talents of [[{id:255,level:1}],[{id:ability.id,level:11}],[{id:ability.id,level:1},{id:ability.id,level:2}]]){c.talents=talents;assert.throws(()=>validateGameDraft(draft,groups));}
});
for(const region of ['kr','jp','en','tw'])test(region+' imports talent IDs and levels from a validated section chain',()=>{
 const parsed=parseSave(saveFixture({region,cats:[{id:9,level:50,plus:0,form:2}],talentRecords:[{id:9,talents:[{id:ability.id,level:4}]}]}));
 assert.equal(parsed.talentStatus,'read');assert.deepEqual(parsed.cats[0].talents,[{id:ability.id,level:4}]);
 const snapshot=importTalentChoices(parsed,null,groups);assert.equal(snapshot.cats[0].talents.find(t=>t.id===ability.id).level,4);
 assert.equal(snapshot.cats[0].talents.filter(t=>t.level===0).length,group.talents.length-1);validateGameDraft(createGameDraft(snapshot),groups);
});
test('missing, damaged and ambiguous talent sections remain unknown and preserve prior records',()=>{
 const raw=saveFixture({cats:[{id:9,level:30,plus:0,form:2}]}),previous={cats:[{id:9,talents:[{id:ability.id,level:6}]}]};
 assert.equal(parseSave(raw).talentStatus,'unavailable');assert.deepEqual(importTalentChoices(parseSave(raw),previous,groups).cats[0].talents,previous.cats[0].talents);
 const full=saveFixture({talentRecords:[{id:9,talents:[{id:ability.id,level:4}]}]}),body=Buffer.from(full.subarray(0,-32));
 const marker=Buffer.alloc(4);marker.writeInt32LE(80200);const at=body.indexOf(marker);body.writeInt32LE(80201,at);
 assert.equal(parseSave(signFixture(body)).talentStatus,'unavailable');
 const good=full.subarray(0,-32),m77=Buffer.alloc(4);m77.writeInt32LE(77);const block=good.subarray(good.indexOf(m77));
 assert.equal(parseSave(signFixture(Buffer.concat([good,block]))).talentStatus,'unavailable');
});
test('zero-count confirmed talent section distinguishes no unlocks from an unknown section',()=>{
 const parsed=parseSave(saveFixture({cats:[{id:9,level:30,plus:0,form:2}],talentRecords:[]}));assert.equal(parsed.talentStatus,'read');
 const snapshot=importTalentChoices(parsed,null,groups);assert.ok(snapshot.cats[0].talents.every(t=>t.level===0));assert.doesNotMatch(talentSummary(snapshot.cats[0],group.talents),/미확인/);
});
