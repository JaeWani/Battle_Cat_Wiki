// Bounded extraction of the version-delimited 8.0 talent section.
// Format reference: BCSFE-Python 85fb94c, save.py / nyanko_club.py / cat.py.
// Unrelated earlier sections are not decoded. Accept only one structurally valid
// 77 -> gold pass -> talents -> 80000 -> 80200 -> 80300 chain, never a lone marker.
export function readSaveTalents(bytes,start,total){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),candidates=[];
 let attempts=0;
 for(let position=start;position+124<=bytes.length;position++){
  if(view.getInt32(position,true)!==77)continue;
  if(++attempts>2048)return {talentStatus:'unavailable',talents:null};
  let p=position+4;
  const skip=n=>{if(n<0||p+n>bytes.length)throw new Error('bounds');p+=n;};
  const int=()=>{const at=p;skip(4);return view.getInt32(at,true);};
  const bool=()=>{const at=p;skip(1);if(view.getUint8(at)>1)throw new Error('boolean');};
  const count=max=>{const n=int();if(n<0||n>max)throw new Error('count');return n;};
  try{
   skip(76);skip(count(4096)*8);skip(8);bool();bool();
   const size=count(total),result=new Map();
   for(let n=0;n<size;n++){
    const id=int();if(id<0||id>=total||result.has(id))throw new Error('cat');
    const number=count(16),talents=[],seen=new Set();
    for(let t=0;t<number;t++){
     const ability=int(),level=int();
     if(ability<1||ability>255||seen.has(ability)||level<0||level>10)throw new Error('talent');
     seen.add(ability);talents.push({id:ability,level});
    }
    result.set(id,talents);
   }
   const np=int();if(np<0)throw new Error('np');bool();if(int()!==80000)throw new Error('marker');
   bool();skip(2+2+2);if(int()!==80200)throw new Error('marker');
   skip(1);bool();if(int()!==80300)throw new Error('marker');
   candidates.push(result);if(candidates.length>1)return {talentStatus:'unavailable',talents:null};
  }catch{/* Unrecognized/corrupt sections never become zero-level talents. */}
 }
 return candidates.length===1?{talentStatus:'read',talents:candidates[0]}:{talentStatus:'unavailable',talents:null};
}
