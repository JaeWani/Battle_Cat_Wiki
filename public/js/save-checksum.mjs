// RFC 1321 algorithm. Used only for the game's legacy checksum, never authentication.
const shifts=[[7,12,17,22],[5,9,14,20],[4,11,16,23],[6,10,15,21]];
const constants=Uint32Array.from({length:64},(_,i)=>Math.floor(Math.abs(Math.sin(i+1))*4294967296));
export function md5(input){
 const n=input.length,bytes=new Uint8Array(Math.ceil((n+9)/64)*64);bytes.set(input);bytes[n]=128;
 const view=new DataView(bytes.buffer);view.setUint32(bytes.length-8,(n*8)>>>0,true);view.setUint32(bytes.length-4,Math.floor(n/536870912),true);
 let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;
 for(let offset=0;offset<bytes.length;offset+=64){
  let a=a0,b=b0,c=c0,d=d0;
  for(let i=0;i<64;i++){
   let f,g;const round=i>>>4;
   if(round===0){f=(b&c)|(~b&d);g=i;}else if(round===1){f=(d&b)|(~d&c);g=(5*i+1)%16;}else if(round===2){f=b^c^d;g=(3*i+5)%16;}else{f=c^(b|~d);g=(7*i)%16;}
   const sum=(a+f+constants[i]+view.getUint32(offset+g*4,true))>>>0,s=shifts[round][i%4],next=(b+((sum<<s)|(sum>>>(32-s))))>>>0;
   a=d;d=c;c=b;b=next;
  }
  a0=(a0+a)>>>0;b0=(b0+b)>>>0;c0=(c0+c)>>>0;d0=(d0+d)>>>0;
 }
 const result=new Uint8Array(16),rv=new DataView(result.buffer);[a0,b0,c0,d0].forEach((v,i)=>rv.setUint32(i*4,v,true));return Array.from(result,v=>v.toString(16).padStart(2,'0')).join('');
}
