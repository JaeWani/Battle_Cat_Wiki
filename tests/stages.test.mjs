import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryOf,filterMaps,schedulesFor} from '../public/js/stages.mjs';
const maps=[{code:'V000',name:'풍운 냥코탑',stages:[{name:'1층'},{name:'50층'}]},{code:'N000',name:'전설의 시작',stages:[{name:'대지를 흔들다'}]},{code:'S406',name:'대천사 개복치 대강림',stages:[{name:'대성어 결전 신난도'}]}];
test('stage search combines category and individual stage name',()=>{
  assert.deepEqual(filterMaps(maps,{category:'special',query:'50층'}),[maps[0]]);
  assert.deepEqual(filterMaps(maps,{category:'legend',query:'50층'}),[]);
  assert.deepEqual(filterMaps(maps,{category:'special',special:'advent'}),[maps[2]]);
});
test('unknown source family cannot silently become a known category',()=>{
  assert.equal(categoryOf({code:'UNKNOWN'}),'unclassified');
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
