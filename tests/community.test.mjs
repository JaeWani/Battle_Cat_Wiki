import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AUTH_PROVIDERS,characterKey,escapeHTML,validPost,safeImagePath,ratingLabel} from '../public/js/community-model.mjs';
test('character ratings distinguish ally evolution forms and enemy namespaces',()=>{
 assert.equal(characterKey('cat','25-2'),'c25-2');assert.equal(characterKey('enemy','25'),'e25');
 assert.notEqual(characterKey('cat','25-1'),characterKey('cat','25-2'));
 for(const [kind,key] of [['cat','25-8'],['enemy','25<script>'],['unknown','25']])assert.throws(()=>characterKey(kind,key));
});
test('community text stays inert when rendered in HTML',()=>{
 assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
 assert.equal(escapeHTML("Tom & 'Cat'"),'Tom &amp; &#39;Cat&#39;');
});
test('post boundaries and trimming apply before saving',()=>{
 assert.deepEqual(validPost(' 제목 ',' 본문 '),{title:'제목',body:'본문'});
 assert.throws(()=>validPost(' ', '본문'));assert.throws(()=>validPost('제목','x'.repeat(20001)));
});
test('attachments must belong to the exact member and post and cannot be SVG',()=>{
 const u='10000000-0000-4000-8000-000000000001',p='20000000-0000-4000-8000-000000000001',i='30000000-0000-4000-8000-000000000001';
 assert(safeImagePath(u+'/'+p+'/'+i+'.webp',u,p));assert(!safeImagePath(u+'/'+p+'/'+i+'.svg',u,p));
 assert(!safeImagePath(u+'/'+p+'/'+i+'.png',p,u));assert(!safeImagePath(u+'/'+p+'/../../x.png',u,p));
});
test('unrated characters are not presented as zero-star scores',()=>{
 assert.equal(ratingLabel(null,0),'아직 평가가 없어요');assert.equal(ratingLabel(4.333,3),'4.3 / 5 · 3명 평가');
});

test('community sign-in policy permits Google only',()=>{assert.deepEqual(AUTH_PROVIDERS,['google']);assert(Object.isFrozen(AUTH_PROVIDERS));});
