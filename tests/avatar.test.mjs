import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {avatarChoices,resolveAvatar,filterAvatars,DEFAULT_AVATAR_KEY} from '../public/js/avatar-model.mjs';
const load=name=>JSON.parse(readFileSync(new URL('../public/data/'+name+'.json',import.meta.url)));
const cats=load('cats'),enemies=load('enemies'),choices=avatarChoices(cats,enemies);
test('avatar catalog includes every ally evolution and enemy with distinct namespaces',()=>{
 assert.equal(choices.length,cats.length+enemies.length);assert.equal(new Set(choices.map(c=>c.avatarKey)).size,choices.length);
 assert.equal(resolveAvatar('c25-2',choices).name,'각성의 고양이 무트');assert.equal(resolveAvatar('e24',choices).kind,'enemy');
 assert.ok(choices.every(c=>c.image.startsWith('assets/')));
});
test('invalid identifiers and arbitrary URLs always resolve to the default bundled image',()=>{
 for(const key of [null,undefined,'c99999-0','https://example.invalid','<img>','../secret'])assert.equal(resolveAvatar(key,choices).avatarKey,DEFAULT_AVATAR_KEY);
 assert.equal(resolveAvatar(null,[]).image,'assets/u/0/0.png');
});
test('avatar search composes category, Korean spaces, original names, ID and evolution',()=>{
 assert.ok(filterAvatars(choices,'cat','각성 의 고양이 무트').some(c=>c.avatarKey==='c25-2'));
 assert.ok(filterAvatars(choices,'cat','ネコ').length);assert.ok(filterAvatars(choices,'enemy','e24').some(c=>c.avatarKey==='e24'));
 assert.ok(filterAvatars(choices,'enemy','').every(c=>c.kind==='enemy'));assert.equal(filterAvatars(choices,'cat','NO SUCH AVATAR').length,0);
});
