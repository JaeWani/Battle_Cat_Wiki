// Synthetic prefix fixture only. This is not the user's attached SAVE_DATA or a complete playable save.
import {createHash} from 'node:crypto';
export function saveFixture({region='kr',version=150500,cats=[{id:0,level:20,plus:15,form:1},{id:25,level:50,plus:1,form:2}]}={}){
 const bytes=[],i32=v=>{const b=Buffer.alloc(4);b.writeInt32LE(v);bytes.push(...b);},u16=v=>{const b=Buffer.alloc(2);b.writeUInt16LE(v);bytes.push(...b);},zero=n=>bytes.push(...Array(n).fill(0));
 i32(version);zero(3);zero(8+24+8+12);if(region!=='jp')zero(1);
 zero(32);zero(24);zero(1);zero(16);
 bytes.push(15);zero(15*40);zero(132);
 for(let n=0;n<10;n++)i32(0);
 for(let n=0;n<10;n++)i32(n===0?48:0);
 for(let chapter=0;chapter<10;chapter++)for(let stage=0;stage<51;stage++)i32(chapter===0&&stage<48?1:0);
 for(let chapter=0;chapter<10;chapter++)for(let stage=0;stage<49;stage++)i32(chapter===0&&stage<48?3:0);
 i32(3);zero(12);const total=40;i32(total);
 for(let id=0;id<total;id++)i32(cats.some(c=>c.id===id)?1:0);
 i32(total);for(let id=0;id<total;id++){const c=cats.find(c=>c.id===id);u16(c?.plus||0);u16((c?.level||1)-1);}
 i32(total);for(let id=0;id<total;id++)i32(cats.find(c=>c.id===id)?.form||0);
 const prefix=Buffer.from(bytes),sentinel=Buffer.from('TEST-ONLY-NOT-A-REAL-TRANSFER-CODE'),body=Buffer.concat([prefix,sentinel]);
 return signFixture(body,region);
}
export function signFixture(body,region='kr'){const hash=createHash('md5').update('battlecats'+(region==='jp'?'':region)).update(body).digest('hex');return Buffer.concat([body,Buffer.from(hash)]);}
