// Isolated UI adapter. Password security is tested against PostgreSQL separately.
const user={id:'58000000-0000-4000-8000-000000000001'},posts=new Map(),comments=new Map();let listener;
const now=()=>new Date().toISOString(),copy=p=>({...p,password:undefined});
const fixture=globalThis.nocFixture={calls:[],signedIn:true,posts,comments,changeAccount(){this.signedIn=false;listener?.('SIGNED_OUT',null);}};
export function createClient(){return {
 auth:{onAuthStateChange(fn){listener=fn;},async getSession(){return {data:{session:fixture.signedIn?{user}:null}};},async signOut(){fixture.changeAccount();return {}; }},
 storage:{from(){return {async createSignedUrl(){return {data:{signedUrl:''}};},async remove(){return {};}};}},
 async rpc(_,{action,payload:p={}}){
  fixture.calls.push({action,...p});let data;
  if(action==='site_settings')data={registration_open:true};
  else if(action==='me')data={id:user.id,nickname:'UI 테스트',status:'active',notifications:[],appeals:[],posts:[...posts.values()].map(copy)};
  else if(action==='list_posts')data=[...posts.values()].filter(p=>p.status==='published').map(p=>({...copy(p),excerpt:p.body,comment_count:comments.size,image_count:0}));
  else if(action==='post')data=copy(posts.get(p.id));
  else if(action==='comments')data=[...comments.values()].filter(c=>c.post_id===p.post_id).map(copy);
  else if(action==='create_post'){const id=crypto.randomUUID();posts.set(id,{id,author_id:user.id,nickname:'UI 테스트',board:p.board,title:'',body:'',images:[],status:'draft',created_at:now(),password:p.password,password_set:true});data={id};}
  else if(action==='comment'){const id=crypto.randomUUID();comments.set(id,{id,author_id:user.id,nickname:'UI 테스트',post_id:p.post_id,body:p.body,password:p.password,password_set:true,created_at:now()});data={id};}
  else{
   const target=(action.includes('comment')?comments:posts).get(p.id);
   if(target?.password!==p.password)return {data:{ok:false,error:'비밀번호가 일치하지 않습니다.'}};
   if(action==='save_post'){Object.assign(target,{title:p.title,body:p.body,status:'published'});data={id:p.id};}
   else if(action==='edit_comment'){target.body=p.body;data={id:p.id};}
   else if(action==='delete_comment'){comments.delete(p.id);data={ok:true};}
   else if(action==='delete_post'){target.status='deleted';data={ok:true};}
   else if(action==='check_content_password')data={ok:true};
   else throw new Error('Unsupported fixture action '+action);
  }
  return {data,error:null};
 }
};}
