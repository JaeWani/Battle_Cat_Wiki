import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const root=new URL('../',import.meta.url),data=gunzipSync(await readFile(new URL('artwork/growth.json.gz',root)));
const parsed=JSON.parse(data);if(parsed.schemaVersion!==1||parsed.units.length!==882)throw new Error('Invalid growth archive');
await mkdir(new URL('public/data/',root),{recursive:true});await writeFile(new URL('public/data/growth.json',root),data);
console.log('Restored growth recipes and official reward destinations.');
