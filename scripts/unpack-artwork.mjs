/** Restore untouched PNG originals from the versioned archive. No image processing. */
import {readFile,readdir,mkdir,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url),art=new URL('artwork/',root);
const parts=(await readdir(art)).filter(n=>/^original-pngs\.tar\.gz\.part-\d{3}$/.test(n)).sort();
if(!parts.length)throw new Error('Original artwork archive is missing.');
const buffer=Buffer.concat(await Promise.all(parts.map(p=>readFile(new URL(p,art)))));
const expected=(await readFile(new URL('archive.sha256',art),'utf8')).trim();
if(createHash('sha256').update(buffer).digest('hex')!==expected)throw new Error('Artwork archive checksum mismatch.');
const temp=join(tmpdir(),`battle-cat-artwork-${process.pid}.tar.gz`);
await mkdir(new URL('public/',root),{recursive:true});
try{
  await writeFile(temp,buffer);
  const result=spawnSync('tar',['-xzf',temp,'-C',fileURLToPath(new URL('public/',root))],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error('Could not restore original images.');
}finally{await rm(temp,{force:true});}
console.log(`Restored original PNGs from ${parts.length} archive parts; SHA-256 verified.`);
