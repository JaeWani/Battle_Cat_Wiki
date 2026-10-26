import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {POLICY_VERSION,PRIVACY_HTML,TERMS_HTML} from '../public/js/community-policy.mjs';
test('standalone legal pages use the same text as the app',()=>{
 for(const [name,html] of [['privacy',PRIVACY_HTML],['terms',TERMS_HTML]]){
  const page=readFileSync(new URL('../public/'+name+'.html',import.meta.url),'utf8');
  assert.ok(page.includes(html));assert.ok(page.includes(POLICY_VERSION));
 }
});
test('onboarding sends the displayed policy version',()=>{
 const source=readFileSync(new URL('../public/js/community.mjs',import.meta.url),'utf8');
 assert.ok(source.includes('policy_version:POLICY_VERSION'));
});
