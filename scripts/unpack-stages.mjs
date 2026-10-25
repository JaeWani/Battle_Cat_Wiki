/** Restore the full official snapshot and original PNGs without modifying image bytes. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url),art=new URL('artwork/',root);
const hashes=JSON.parse(await readFile(new URL('official-stages.sha256.json',art),'utf8'));
const files={};
for(const name of ['official-stage-data.json.gz','official-stage-icons.tar.gz']){
  const bytes=await readFile(new URL(name,art));
  if(createHash('sha256').update(bytes).digest('hex')!==hashes[name])throw new Error(`Official stage archive hash mismatch: ${name}`);
  files[name]=bytes;
}
const iconPath=fileURLToPath(new URL('official-stage-icons.tar.gz',art));
const listing=spawnSync('tar',['-tzf',iconPath],{encoding:'utf8'});
if(listing.status!==0||listing.stdout.trim().split('\n').some(p=>!/^stage-assets\/enemy-\d+\.png$/.test(p)))throw new Error('Invalid official icon archive paths');
await mkdir(new URL('public/data/',root),{recursive:true});
await writeFile(new URL('public/data/stages.json',root),gunzipSync(files['official-stage-data.json.gz']));
const extraction=spawnSync('tar',['-xzf',iconPath,'-C',fileURLToPath(new URL('public/',root))],{stdio:'inherit'});
if(extraction.error)throw extraction.error;
if(extraction.status!==0)throw new Error('Official stage icons could not be restored');
console.log('Restored full official stage snapshot and untouched PONOS PNGs; archive hashes verified.');
