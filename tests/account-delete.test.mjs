import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeletionHandler} from '../supabase/functions/noc-account-delete/handler.mjs';
const uid='30000000-0000-4000-8000-000000000001';
function fixture(options={}){
 const calls=[];
 const bucket={
  async list(prefix,{offset}){calls.push(['list',prefix,offset]);if(options.listError)return {error:new Error('private detail')};
   if(options.pages)return {data:options.pages[prefix]?.[offset]||[]};
   return {data:[]};},
  async remove(paths){calls.push(['remove',paths]);return {error:options.removeError?new Error('private detail'):null};}
 };
 const admin={
  auth:{async getUser(){calls.push(['auth']);if(options.authThrows)throw new Error('private detail');return {data:{user:options.invalid?null:{id:uid}}};},
   admin:{async deleteUser(id,soft){calls.push(['delete',id,soft]);return {error:options.deleteError?new Error('private detail'):null};}}},
  async rpc(name,payload){calls.push(['pending',name,payload]);return {data:options.pending!==false,error:options.rpcError?new Error('private detail'):null};},
  storage:{from(name){calls.push(['bucket',name]);return bucket;}}
 };
 return {calls,handler:createDeletionHandler(()=>admin)};
}
const request=(headers={},method='POST')=>new Request('https://example.invalid/delete',{method,headers:{Authorization:'Bearer test-only-token',Origin:'https://jaewani.github.io',...headers}});
test('unauthenticated and wrong-origin requests never reach Auth',async()=>{
 for(const req of [new Request('https://example.invalid',{method:'POST'}),request({Origin:'https://evil.invalid'})]){
  const {calls,handler}=fixture();const r=await handler(req);assert.ok([401,403].includes(r.status));assert.equal(calls.length,0);
 }
});
test('preflight and unsupported methods never touch account data',async()=>{
 const {calls,handler}=fixture();assert.equal((await handler(request({},'OPTIONS'))).status,200);assert.equal((await handler(request({},'GET'))).status,405);assert.equal(calls.length,0);
});
test('invalid token cannot enumerate or delete files',async()=>{
 const {calls,handler}=fixture({invalid:true});assert.equal((await handler(request())).status,401);assert.deepEqual(calls,[['auth']]);
});
test('a deletion request is mandatory',async()=>{
 const {calls,handler}=fixture({pending:false});assert.equal((await handler(request())).status,403);assert.ok(!calls.some(c=>c[0]==='bucket'));
 assert.deepEqual(calls[1],['pending','noc_deletion_pending',{member_id:uid}]);
});
test('paginated nested files are removed in batches before hard Auth deletion',async()=>{
 const first=Array.from({length:100},(_,i)=>({name:i+'.webp',id:String(i)}));
 const {calls,handler}=fixture({pages:{[uid]:{0:[{name:'post',id:null}]},[uid+'/post']:{0:first,100:[{name:'last.webp',id:'last'}]}}});
 assert.equal((await handler(request())).status,200);
 const removes=calls.filter(c=>c[0]==='remove');
 assert.equal(removes.length,2);assert.equal(removes[0][1].length,100);assert.equal(removes[1][1][0],uid+'/post/last.webp');
 assert.ok(removes.every(c=>c[1].every(p=>p.startsWith(uid+'/'))));assert.deepEqual(calls.at(-1),['delete',uid,false]);
});
test('empty-storage pending accounts can be deleted',async()=>{
 const {calls,handler}=fixture();const response=await handler(request());assert.deepEqual(await response.json(),{ok:true});assert.deepEqual(calls.at(-1),['delete',uid,false]);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
});
for(const error of ['authThrows','rpcError','listError','removeError','deleteError']){
 test(error+' is recoverable and does not leak private details',async()=>{
  const pages={[uid]:{0:[{name:'test.webp',id:'file'}]}};
  const {calls,handler}=fixture({[error]:true,pages});const response=await handler(request());
  assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private detail'));
  if(error!=='deleteError')assert.ok(!calls.some(c=>c[0]==='delete'));
 });
}
