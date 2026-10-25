import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../public/',import.meta.url);
const data=JSON.parse(await readFile(new URL('data/events.json',root),'utf8'));
assert.equal(data.region,'KR');assert.equal(data.timezone,'Asia/Seoul');assert.ok(Number.isFinite(Date.parse(data.collectedAt)));
assert.ok(Array.isArray(data.events)&&data.events.length>0);const ids=new Set(),scheduleKeys=new Set();
for(const e of data.events){
  assert.ok(!ids.has(e.id));ids.add(e.id);
  assert.equal(e.region,'KR');assert.ok(e.title.trim());assert.ok(['event','gacha','reward'].includes(e.category));
  const url=new URL(e.sourceUrl);assert.equal(url.protocol,'https:');assert.equal(url.hostname,'nyanko-announcement.ponosgames.com');
  if(e.period){
    const {startAt,endAt,announcedEndAt}=e.period;
    assert.ok([startAt,endAt,announcedEndAt].every(t=>Number.isFinite(Date.parse(t))&&t.endsWith('+09:00')));
    assert.ok(Date.parse(endAt)>Date.parse(startAt));assert.equal(Date.parse(endAt)-Date.parse(announcedEndAt),60000);
  }
  if(e.period||e.recurrence){const key=e.title+JSON.stringify(e.period||e.recurrence);assert.ok(!scheduleKeys.has(key));scheduleKeys.add(key);}
  if(e.image){
    assert.ok(/^event-assets\/notice-\d+\.(png|jpg)$/.test(e.image.path));
    const source=new URL(e.image.sourceUrl);assert.equal(source.hostname,'nyanko-webview.ponosgames.com');assert.equal(source.search,'');
    const raw=await readFile(new URL(e.image.path,root));assert.equal(createHash('sha256').update(raw).digest('hex'),e.image.sha256);assert.equal(e.image.processing,'none');
  }
}
console.log(`Validated ${data.events.length} first-party KR notices and original banner checksums.`);
