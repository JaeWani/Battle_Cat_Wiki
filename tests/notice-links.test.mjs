import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicNoticeURL} from '../public/js/notice-links.mjs';
test('public notice links discard stale device time while preserving Korean notice context',()=>{
 const input='https://nyanko-announcement.ponosgames.com/v1/notices/14474?clientTime=1&countryCode=ko&timeDifference=1&clientVersion=150500&platform=google';
 const url=new URL(publicNoticeURL(input));assert.equal(url.searchParams.has('clientTime'),false);assert.equal(url.searchParams.has('timeDifference'),false);
 assert.equal(url.searchParams.get('countryCode'),'ko');assert.equal(url.searchParams.get('clientVersion'),'150500');assert.equal(url.pathname,'/v1/notices/14474');
 assert.equal(publicNoticeURL(publicNoticeURL(input)),publicNoticeURL(input));
});
test('index links are cleaned; unrelated URLs keep their parameters',()=>{
 assert.equal(publicNoticeURL('https://nyanko-announcement.ponosgames.com/v1/notices?clientTime=0&timeDifference=1'),'https://nyanko-announcement.ponosgames.com/v1/notices');
 const external='https://example.com/?clientTime=1&timeDifference=9';assert.equal(publicNoticeURL(external),external);
});
