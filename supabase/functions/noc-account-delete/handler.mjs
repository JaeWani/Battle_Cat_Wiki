// Shared runtime handler: imported by the Edge Function and tested in Node.
const origin='https://jaewani.github.io';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
export function createDeletionHandler(createAdmin){
 return async req=>{
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply(405,{error:'POST required'});
  if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply(403,{error:'Origin denied'});
  const token=req.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!token)return reply(401,{error:'로그인이 필요해요.'});
  try{
   const admin=createAdmin();
   const {data,error:authError}=await admin.auth.getUser(token);
   const user=data?.user;
   if(authError||!user)return reply(401,{error:'로그인 상태를 다시 확인해 주세요.'});
   const {data:pending,error:pendingError}=await admin.rpc('noc_deletion_pending',{member_id:user.id});
   if(pendingError)throw pendingError;
   if(!pending)return reply(403,{error:'회원탈퇴 요청을 먼저 확인해 주세요.'});
   const bucket=admin.storage.from('community-images'),files=[];
   async function collect(prefix){
    for(let offset=0;;offset+=100){
     const {data,error}=await bucket.list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
     if(error)throw error;
     for(const item of data||[]){const path=prefix+'/'+item.name;if(item.id)files.push(path);else await collect(path);}
     if(!data||data.length<100)break;
    }
   }
   await collect(user.id);
   for(let i=0;i<files.length;i+=100){const {error}=await bucket.remove(files.slice(i,i+100));if(error)throw error;}
   const {error}=await admin.auth.admin.deleteUser(user.id,false);
   if(error)throw error;
   return reply(200,{ok:true});
  }catch(error){
   // Do not log tokens, email, attachment paths or error messages containing private data.
   console.error('Account cleanup failed',error instanceof Error?error.name:'unknown');
   return reply(503,{error:'정리 작업이 완료되지 않았어요. 탈퇴 화면에서 다시 시도하거나 운영자에게 문의해 주세요.'});
  }
 };
}
