import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryOf,filterMaps,schedulesFor,hydrateStageGroup,specialOf} from '../public/js/stages.mjs';
const maps=[{code:'V000',name:'풍운 냥코탑',stages:[{name:'1층'},{name:'50층'}]},{code:'N000',name:'전설의 시작',stages:[{name:'대지를 흔들다'}]},{code:'S406',name:'대천사 개복치 대강림',stages:[{name:'대성어 결전 신난도'}]}];
test('stage search combines category and individual stage name',()=>{
  assert.deepEqual(filterMaps(maps,{category:'special',query:'50층'}),[maps[0]]);
  assert.deepEqual(filterMaps(maps,{category:'legend',query:'50층'}),[]);
  assert.deepEqual(filterMaps(maps,{category:'special',special:'advent'}),[maps[2]]);
});
test('unknown source family cannot silently become a known category',()=>{
  assert.equal(categoryOf({code:'UNKNOWN'}),'unclassified');
});
test('multi-letter source families remain distinct and language filtering is explicit',()=>{
  for(const [code,category] of [['NA000','true-legend'],['ND000','zero-legend'],['CH000','main'],['CA000','collab'],['H000','excavation'],['M000','challenge']])assert.equal(categoryOf({code}),category);
  assert.equal(specialOf({code:'B000',name:'진화의 노랑 개다래 열매'}),'catamin');
  const untranslated={code:'C000',name:'原文',koreanTextVerified:false,stages:[]};
  assert.deepEqual(filterMaps([untranslated],{koreanOnly:true}),[]);
  assert.deepEqual(filterMaps([untranslated]),[untranslated]);
});
test('lazy stage groups hydrate official icon provenance and preserve missing images',()=>{
  const group={maps:[{code:'N000',sourceUrl:'official-map',stages:[{index:0,enemyCodes:['000','645']}]}]};
  const icons=[{iconCode:'000',sourceUrl:'official-png',path:'original.png'},{iconCode:'645',sourceUrl:'official-unavailable-png',path:null}];
  const stage=hydrateStageGroup(group,icons)[0].stages[0];
  assert.equal(stage.sourceUrl,'official-map');assert.equal(stage.enemies[0].image,'original.png');assert.equal(stage.enemies[1].image,null);assert.equal(stage.enemies[1].sourceUrl,'official-unavailable-png');assert.equal(stage.enemies[0].magnification,null);
  assert.throws(()=>hydrateStageGroup(group,icons.slice(0,1)),/Unknown official enemy icon/);
});
test('calendar association requires KR event and exact normalized map name',()=>{
  const good={title:'풍운 냥코탑 개최!',region:'KR',category:'event',period:{}};
  const records=[good,{...good,title:'풍운 냥코탑 도전 미션'},{...good,title:'이계 냥코탑'},{...good,region:'JP'},{...good,category:'gacha'},{...good,period:null}];
  assert.deepEqual(schedulesFor(maps[0],records),[good]);
});
test('recurrence does not need invented exact dates to associate',()=>{
  const weekly={title:'풍운 냥코탑',region:'KR',category:'event',recurrence:{frequency:'weekly',timeKnown:false}};
  assert.deepEqual(schedulesFor(maps[0],[weekly]),[weekly]);
  assert.equal(weekly.period,undefined);
});
