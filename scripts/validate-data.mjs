import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../public/',import.meta.url);
const load=async n=>JSON.parse(await readFile(new URL(`data/${n}.json`,root),'utf8'));
const [cats,enemies,meta,manifest]=await Promise.all(['cats','enemies','meta','images-manifest'].map(load));
assert.equal(new Set(cats.map(u=>u.key)).size,cats.length);
assert.equal(new Set(enemies.map(u=>u.id)).size,enemies.length);
assert.equal(meta.formCount,cats.length);assert.equal(meta.enemyCount,enemies.length);
for(const u of [...cats,...enemies]){
  assert.ok(u.name.trim(),`${u.key}: name missing`);
  for(const field of ['hp','range','attackF','trait','abilityMask'])assert.ok(Number.isFinite(u[field]),`${u.key}: invalid ${field}`);
  assert.ok(u.hp>0);assert.equal(u.attacks.length,3);assert.ok(u.attacks.every(v=>v>=0));
  if(u.form!==undefined){assert.ok(meta.levelCurves[u.curve]);assert.ok(u.maxLevel>=1);}
  assert.ok(/^assets\/[use]\/\d+\/\d+\.png$/.test(u.image));
  assert.ok((await stat(new URL(u.image,root))).size>0);
}
for(const f of manifest.files){
  const data=await readFile(new URL(f.path,root));
  assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256,`Image differs from source: ${f.path}`);
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
}
// Translation tables do not share numerical IDs with the enemy dataset.
assert.equal(enemies.find(u=>u.nameJP==='ぶんぶん先生').name,'맴매 선생');
assert.equal(enemies.find(u=>u.nameJP==='ガガガガ').name,'나나나난나방');
assert.equal(enemies.find(u=>u.id===0).name,'멍뭉이');
assert.equal(cats.find(u=>u.key==='25-2').name,'각성의 고양이 무트');
console.log(`Validated ${cats.length} ally forms, ${enemies.length} enemies, ${manifest.files.length} byte-identical PNGs.`);
