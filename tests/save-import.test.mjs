import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {md5} from '../public/js/save-checksum.mjs';
import {parseSave,MAX_SAVE_BYTES} from '../public/js/save-parser.mjs';
import {saveFixture,signFixture} from './helpers/save-fixture.mjs';
test('legacy checksum matches independent Node implementation across padding boundaries',()=>{
 for(const n of [0,1,3,55,56,63,64,65,1000,70000]){const b=randomBytes(n);assert.equal(md5(b),createHash('md5').update(b).digest('hex'));}
});
for(const region of ['kr','jp','en','tw'])test(region+' prefix extracts character levels, forms and chapter summaries',()=>{
 const result=parseSave(saveFixture({region}));
 assert.equal(result.region,region);assert.equal(result.gameVersion,150500);
 assert.deepEqual(result.cats,[{id:0,form:1,level:20,plus:15},{id:25,form:2,level:50,plus:1}]);
 assert.equal(result.progress.length,9);assert.deepEqual(result.progress[0],{progress:48,cleared:48,gold:48});
 assert.deepEqual(Object.keys(result).sort(),['schemaVersion','gameVersion','region','cats','progress'].sort());
 assert.ok(!JSON.stringify(result).includes('TEST-ONLY'));
});
test('tampered data cannot pass checksum',()=>{const b=saveFixture();b[100]^=1;assert.throws(()=>parseSave(b),{code:'CHECKSUM'});});
test('unknown versions fail closed',()=>assert.throws(()=>parseSave(saveFixture({version:160000})),{code:'VERSION'}));
test('unsupported values do not silently clamp or overwrite',()=>assert.throws(()=>parseSave(saveFixture({cats:[{id:0,level:201,plus:0,form:0}]})),{code:'VALUE'}));
test('invalid declared sizes cannot allocate unbounded lists',()=>{
 const b=saveFixture(),body=Buffer.from(b.subarray(0,-32));
 // Non-JP header 133 bytes, lineup count+600 bytes, stamp 132 and story 4080.
 body.writeInt32LE(0x7fffffff,133+1+600+132+4080);
 assert.throws(()=>parseSave(signFixture(body)),{code:'COUNT'});
});
test('JSON, truncation, oversized and damaged suffix inputs fail',()=>{
 for(const b of [Buffer.from('{}'),saveFixture().subarray(0,100),new Uint8Array(MAX_SAVE_BYTES+1)])assert.throws(()=>parseSave(b));
 const b=saveFixture();b[b.length-1]=65;assert.throws(()=>parseSave(b),{code:'CHECKSUM'});
});
