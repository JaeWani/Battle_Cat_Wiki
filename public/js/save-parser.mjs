import {md5} from './save-checksum.mjs';
export const MAX_SAVE_BYTES=8*1024*1024;
const MIN_VERSION=120000,MAX_VERSION=150599,MAX_CATS=4096;
export class SaveParseError extends Error{constructor(code,message){super(message);this.name='SaveParseError';this.code=code;}}
function fail(code,message){throw new SaveParseError(code,message);}
class Reader{
 constructor(bytes){this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);this.offset=0;}
 skip(n){if(!Number.isSafeInteger(n)||n<0||this.offset+n>this.view.byteLength)fail('TRUNCATED','파일이 잘렸거나 지원하지 않는 형식입니다.');this.offset+=n;}
 int(){const p=this.offset;this.skip(4);return this.view.getInt32(p,true);}
 short(){const p=this.offset;this.skip(2);return this.view.getUint16(p,true);}
 byte(){const p=this.offset;this.skip(1);return this.view.getUint8(p);}
 count(max){const n=this.int();if(n<0||n>max)fail('COUNT','배열 크기가 올바르지 않습니다.');return n;}
 ints(n){const result=[];for(let i=0;i<n;i++)result.push(this.int());return result;}
}
export function formatGameVersion(v){return [Math.floor(v/10000),Math.floor(v/100)%100,v%100].join('.');}
export function parseSave(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(bytes.length>MAX_SAVE_BYTES)fail('SIZE','8MB 이하의 SAVE_DATA 파일을 선택해 주세요.');
 if(bytes.length<4600)fail('SIZE','SAVE_DATA 파일이 너무 작거나 지원하지 않는 형식입니다.');
 const body=bytes.subarray(0,-32),tail=new TextDecoder('ascii').decode(bytes.subarray(-32));
 if(!/^[0-9a-f]{32}$/.test(tail))fail('CHECKSUM','SAVE_DATA 끝의 검사값을 확인할 수 없습니다. JSON이나 압축파일 대신 원본 SAVE_DATA를 선택해 주세요.');
 let region=null;const encoder=new TextEncoder();
 for(const cc of ['kr','jp','en','tw']){
  const salt=encoder.encode('battlecats'+(cc==='jp'?'':cc)),salted=new Uint8Array(salt.length+body.length);salted.set(salt);salted.set(body,salt.length);
  if(md5(salted)===tail){region=cc;break;}
 }
 if(!region)fail('CHECKSUM','파일 검사값이 일치하지 않습니다. 손상된 파일이나 지원하지 않는 형식은 불러올 수 없습니다.');
 const r=new Reader(body),gameVersion=r.int();
 if(gameVersion<MIN_VERSION||gameVersion>MAX_VERSION)fail('VERSION','현재 읽기 범위는 12.0.0~15.5.x입니다. 이 버전의 형식은 추가 확인이 필요합니다.');
 // Read-only prefix layout: settings/resources/timestamps are skipped, not exported.
 r.skip(3);r.skip(8+24+8+12);if(region!=='jp')r.skip(1);
 r.skip(8*4);r.skip(6*4);r.skip(1);r.skip(4*4);
 const slots=r.byte();if(slots<1||slots>100)fail('LAYOUT','편성 슬롯 구조를 확인할 수 없습니다.');r.skip(slots*10*4);
 r.skip(33*4); // Stamp block, fixed-length.
 r.skip(10*4);const chapterProgress=r.ints(10);
 const clears=Array.from({length:10},()=>r.ints(51)),treasures=Array.from({length:10},()=>r.ints(49));
 for(let i=0;i<10;i++){
  if(chapterProgress[i]<0||chapterProgress[i]>51||clears[i].some(v=>v<0||v>100000000)||treasures[i].some(v=>v<0||v>3))fail('LAYOUT','챕터 정보 구조가 올바르지 않습니다.');
 }
 r.skip(r.count(4096)*4); // Enemy guide, discarded.
 const total=r.count(MAX_CATS);if(total<1)fail('LAYOUT','캐릭터 목록이 없습니다.');
 const unlocked=r.ints(total);if(unlocked.some(v=>v!==0&&v!==1))fail('LAYOUT','보유 캐릭터 상태를 확인할 수 없습니다.');
 if(r.count(MAX_CATS)!==total)fail('LAYOUT','레벨 목록 크기가 일치하지 않습니다.');
 const levels=Array.from({length:total},()=>({plus:r.short(),level:r.short()+1}));
 if(r.count(MAX_CATS)!==total)fail('LAYOUT','진화 목록 크기가 일치하지 않습니다.');
 const forms=r.ints(total),cats=[];
 for(let id=0;id<total;id++){
  if(!unlocked[id])continue;
  const {level,plus}=levels[id],form=forms[id];
  if(level<1||level>200||plus>1000||form<0||form>3)fail('VALUE','지원 범위를 벗어난 레벨 또는 진화 정보입니다.');
  cats.push({id,form,level,plus});
 }
 // Internal chapter index 3 is not one of the nine main chapters.
 const progress=[0,1,2,4,5,6,7,8,9].map(i=>({progress:chapterProgress[i],cleared:clears[i].slice(0,48).filter(v=>v>0).length,gold:treasures[i].slice(0,48).filter(v=>v===3).length}));
 return {schemaVersion:1,gameVersion,region,cats,progress};
}
