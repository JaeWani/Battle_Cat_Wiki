import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {kstDay,shiftDay,onDay,eventStatus,isStale,filterEvents,dayWindow} from '../public/js/events.mjs';
const event={id:'1',title:'공식 뽑기 일정',category:'gacha',period:{startAt:'2026-10-23T11:00:00+09:00',endAt:'2026-10-26T11:00:00+09:00',announcedEndAt:'2026-10-26T10:59:00+09:00'}};
test('KST day rolls over at UTC 15:00, irrespective of the browser timezone',()=>{
 assert.equal(kstDay('2026-10-24T14:59:59Z'),'2026-10-24');assert.equal(kstDay('2026-10-24T15:00:00Z'),'2026-10-25');
 assert.equal(shiftDay('2026-12-31',1),'2027-01-01');assert.equal(shiftDay('2026-03-01',-1),'2026-02-28');
});
test('calendar uses date overlap; an exclusive midnight end is absent on the next day',()=>{
 assert.equal(onDay(event,'2026-10-22'),false);assert.equal(onDay(event,'2026-10-23'),true);assert.equal(onDay(event,'2026-10-26'),true);assert.equal(onDay(event,'2026-10-27'),false);
 assert.equal(onDay({...event,period:{...event.period,endAt:'2026-10-26T00:00:00+09:00'}},'2026-10-26'),false);
});
test('live status honors exact start and announced final minute',()=>{
 assert.equal(eventStatus(event,'2026-10-23T10:59:59+09:00'),'upcoming');assert.equal(eventStatus(event,'2026-10-23T11:00:00+09:00'),'ongoing');assert.equal(eventStatus(event,'2026-10-26T10:59:59+09:00'),'ongoing');assert.equal(eventStatus(event,'2026-10-26T11:00:00+09:00'),'ended');
});
test('publication date is not treated as an event period',()=>{
 const e={title:'기간 불명',publishedOn:'2026-10-25',period:null,recurrence:null};assert.equal(onDay(e,'2026-10-25'),false);assert.equal(eventStatus(e,'2026-10-25T12:00:00+09:00'),'notice');
});
test('recurring weekends are opening days with unknown hours, not claimed to be live',()=>{
 const e={period:null,publishedOn:'2026-10-24',recurrence:{frequency:'weekly',weekdays:[0,6],timeKnown:false}};
 assert.equal(onDay(e,'2026-10-25'),true);assert.equal(onDay(e,'2026-10-26'),false);assert.equal(onDay(e,'2026-10-18'),false);assert.equal(eventStatus(e,'2026-10-25T12:00:00+09:00'),'recurring');
});
test('monthly recurrence is independent of browser timezone',()=>{
 const e={period:null,recurrence:{frequency:'monthly',monthDays:[22]}};assert.equal(onDay(e,'2026-10-22'),true);assert.equal(onDay(e,'2026-10-23'),false);
});
test('category and text search compose with selected calendar day',()=>{
 assert.equal(filterEvents([event],{day:'2026-10-25',category:'gacha',query:'공식'}).length,1);assert.equal(filterEvents([event],{day:'2026-10-25',category:'event'}).length,0);
});
test('stale data is marked after 36h and invalid timestamps are stale',()=>{
 assert.equal(isStale('2026-10-23T00:00:00Z','2026-10-24T12:00:00Z'),false);assert.equal(isStale('2026-10-23T00:00:00Z','2026-10-24T12:00:01Z'),true);assert.equal(isStale('not a date'),true);
});
test('invalid calendar dates are rejected',()=>{
 assert.throws(()=>dayWindow('2026-02-31'));assert.throws(()=>dayWindow('2026-01-01<script>'));
});
test('real official-notice snapshot has explicit current periods and no duplicate recurring cards',()=>{
 const data=JSON.parse(readFileSync(new URL('../public/data/events.json',import.meta.url)));
 assert.equal(data.region,'KR');assert.ok(data.events.some(e=>e.period));assert.ok(data.events.filter(e=>e.title==='종말의 배틀 그라운드').length<=1);
 for(const e of data.events){assert.ok(e.sourceUrl.startsWith('https://nyanko-announcement.ponosgames.com/'));if(e.image)assert.ok(e.image.sourceUrl.startsWith('https://nyanko-webview.ponosgames.com/'));}
});
