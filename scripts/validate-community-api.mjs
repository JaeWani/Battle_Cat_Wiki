import assert from 'node:assert/strict';
import {COMMUNITY_CONFIG as config} from '../public/js/community-config.mjs';
async function rpc(action,payload={}){
 const response=await fetch(config.url+'/rest/v1/rpc/noc_api',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({action,payload}),signal:AbortSignal.timeout(20000)});
 return {response,data:await response.json()};
}
const boards=await rpc('boards');assert(boards.response.ok);assert.equal(boards.data.length,4);
const settings=await rpc('site_settings');assert(settings.response.ok);assert.equal(typeof settings.data.registration_open,'boolean');
const character=await rpc('character',{key:'c25-2'});assert(character.response.ok);assert.equal(typeof character.data.count,'number');
for(const action of ['create_post','admin','request_deletion','game_profile','save_game_profile','delete_game_profile']){
 const result=await rpc(action,{board:'free',confirm:'회원탈퇴'});assert(!result.response.ok,'Unauthenticated action allowed: '+action);
}
const deletion=await fetch(config.url+'/functions/v1/noc-account-delete',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});assert.equal(deletion.status,401);
const sdk=await fetch(config.sdkURL,{signal:AbortSignal.timeout(20000)});assert(sdk.ok,'Pinned browser SDK unavailable');assert((await sdk.text()).includes('createClient'),'SDK export missing');
console.log('Verified live public reads, registration setting, anonymous write/admin/deletion rejection, Edge authentication, and pinned browser SDK availability.');

const authSettings=await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.publishableKey},signal:AbortSignal.timeout(20000)});assert(authSettings.ok);console.log('Google OAuth configured:',Boolean((await authSettings.json()).external.google));
