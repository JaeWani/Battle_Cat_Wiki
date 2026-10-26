import {POLICY_VERSION,PRIVACY_HTML,TERMS_HTML} from './community-policy.mjs?v=privacy-r2';
import {COMMUNITY_CONFIG as config} from './community-config.mjs?v=privacy-r2';
import {AUTH_PROVIDERS,BOARD_NAMES,escapeHTML as esc,validPost,safeImagePath,ratingLabel} from './community-model.mjs?v=google-only-1';
const $=s=>document.querySelector(s),date=v=>new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'});
let client,ready,session=null,me=null,providers={},siteSettings={registration_open:false,contact_email:""},inputCallback=null,requestId=0,charRequest=0;
const state={board:'all',query:'',page:0,screen:'list',post:null,editor:null};
const postQuery=new URLSearchParams(location.search).get('post');
function showMessage(message,error=false){const el=$('#community-message');el.hidden=false;el.classList.toggle('noc-error',error);el.textContent=message;}
function failure(error){showMessage(error?.message||'요청을 처리하지 못했어요. 다시 시도해 주세요.',true);}
async function api(action,payload={}){await ready;if(!client)throw new Error('로그인 서비스를 불러오지 못했어요. 새로고침해 주세요.');const {data,error}=await client.rpc('noc_api',{action,payload});if(error)throw new Error(error.message);return data;}
function accountTitle(){const b=$('#noc-account-button');if(b)b.textContent=session?(me?.nickname||'가입 완료하기'):'로그인';$('#noc-admin-button').hidden=!me?.role;}
async function refreshMe(){
 me=session?await api('me'):null;accountTitle();
 if($('#noc-account-dialog')?.open)renderAccount();
 const panel=$('#character-community');if(panel)renderCharacterCommunity(panel.dataset.characterKey,panel);
}
function memberRequired(){if(!session||me?.status!=='active'){renderAccount();$('#noc-account-dialog').showModal();throw new Error(!session?'로그인 후 이용할 수 있어요.':'회원 가입 또는 계정 상태를 확인해 주세요.');}}
function boardButtons(){$('#noc-boards').innerHTML=Object.entries(BOARD_NAMES).map(([id,name])=>'<button data-noc="board" data-board="'+id+'" aria-pressed="'+(state.board===id)+'" class="'+(state.board===id?'active':'')+'">'+name+'</button>').join('');}
function setPostURL(id){const url=new URL(location.href);if(id)url.searchParams.set('post',id);else url.searchParams.delete('post');history.replaceState(null,'',url);}
function listView(){state.screen='list';state.post=null;setPostURL(null);renderFeed();}
async function renderFeed(){
 const ticket=++requestId;boardButtons();$('#noc-feed').innerHTML='<p class="noc-loading" role="status">게시글을 불러오는 중…</p>';
 try{
  const rows=await api('list_posts',{board:state.board,query:state.query,page:state.page});if(ticket!==requestId)return;
  const hasNext=rows.length>20;
  $('#noc-feed').innerHTML='<div class="noc-feed-heading"><h2>'+BOARD_NAMES[state.board]+'</h2><span>최근 작성순</span></div>'+
   (rows.length?rows.slice(0,20).map(p=>'<article class="noc-post-card"><div><span class="tag">'+BOARD_NAMES[p.board]+'</span><small>'+date(p.created_at)+'</small></div><button class="noc-post-title" data-noc="post" data-id="'+p.id+'">'+esc(p.title)+'</button><p>'+esc(p.excerpt)+'</p><footer><span>'+esc(p.nickname)+'</span><span>댓글 '+p.comment_count+(p.image_count?' · 사진 '+p.image_count:'')+'</span></footer></article>').join(''):'<div class="stage-empty"><h2>아직 게시글이 없어요.</h2><p>첫 번째 출진 이야기를 남겨보세요.</p><button class="text-button" data-noc="compose">글쓰기 →</button></div>')+
   '<div class="pagination"><button data-noc="page" data-page="'+(state.page-1)+'" '+(state.page===0?'disabled':'')+'>← 이전</button><span>'+(state.page+1)+'페이지</span><button data-noc="page" data-page="'+(state.page+1)+'" '+(!hasNext?'disabled':'')+'>다음 →</button></div>';
 }catch(error){if(ticket!==requestId)return;$('#noc-feed').innerHTML='<div class="stage-empty"><h2>게시판 연결을 확인해 주세요.</h2><p>'+esc(error.message)+'</p><button class="text-button" data-noc="list">다시 불러오기 →</button></div>';}
}
function commentMarkup(rows){
 return rows.slice(0,20).map(c=>'<article class="noc-comment"><div><strong>'+esc(c.nickname)+'</strong><small>'+date(c.created_at)+'</small></div><p>'+esc(c.body)+'</p><div class="noc-text-actions">'+(session?.user.id===c.author_id?'<button data-noc="edit-comment" data-id="'+c.id+'">수정</button><button data-noc="delete-comment" data-id="'+c.id+'">삭제</button>':'')+(session?'<button data-noc="report" data-target="comment" data-id="'+c.id+'">신고</button>':'')+'</div></article>').join('')||'<p class="field-help">아직 댓글이 없어요.</p>';
}
function commentForm(target,id){return '<form class="noc-comment-form" data-target="'+target+'" data-id="'+esc(id)+'"><label>댓글<textarea name="body" maxlength="2000" rows="3" required placeholder="서로를 존중하며 의견을 남겨주세요."></textarea></label><button class="primary-button" type="submit">댓글 등록</button></form>';}
async function signedImages(paths,author,id){
 const safe=paths.filter(p=>safeImagePath(p,author,id));
 const results=await Promise.all(safe.map(async path=>{const {data,error}=await client.storage.from('community-images').createSignedUrl(path,300);return error?null:{path,url:data.signedUrl};}));
 return results.filter(Boolean);
}
async function showPost(id){
 const ticket=++requestId;state.screen='post';state.post=id;setPostURL(id);$('#noc-feed').innerHTML='<p role="status">게시글을 불러오는 중…</p>';
 try{
  const [p,comments]=await Promise.all([api('post',{id}),api('comments',{post_id:id,page:0})]);if(ticket!==requestId)return;
  const images=await signedImages(p.images,p.author_id,p.id);if(ticket!==requestId)return;
  $('#noc-feed').innerHTML='<article class="noc-post-detail"><button class="text-button" data-noc="list">← 목록으로</button><span class="tag">'+BOARD_NAMES[p.board]+'</span><h2>'+esc(p.title)+'</h2><p class="noc-meta">'+esc(p.nickname)+' · '+date(p.created_at)+(p.status!=='published'?' · '+esc(p.status):'')+'</p><div class="noc-body">'+esc(p.body)+'</div><div class="noc-post-images">'+images.map(i=>'<a href="'+esc(i.url)+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(i.url)+'" alt="게시글 첨부 이미지" loading="lazy"></a>').join('')+'</div><div class="noc-text-actions">'+(session?.user.id===p.author_id&&['published','draft'].includes(p.status)?'<button data-noc="edit-post" data-id="'+p.id+'">수정</button><button data-noc="delete-post" data-id="'+p.id+'">삭제</button>':'')+(session&&p.status==='published'?'<button data-noc="report" data-target="post" data-id="'+p.id+'">신고</button>':'')+'</div></article><section class="noc-comments"><h3>댓글</h3><div id="noc-post-comments" data-page="0">'+commentMarkup(comments)+'</div><button class="text-button" data-noc="more-comments" data-target="post" data-id="'+id+'" '+(comments.length<=20?'hidden':'')+'>댓글 더 보기 →</button>'+commentForm('post',id)+'</section>';
 }catch(error){if(ticket===requestId){$('#noc-feed').innerHTML='<p class="noc-error">'+esc(error.message)+'</p><button class="text-button" data-noc="list">목록으로 →</button>';}}
}
async function startEditor(id){
 memberRequired();let p;
 if(id){p=await api('post',{id});if(p.author_id!==session.user.id)throw new Error('내 게시글만 수정할 수 있어요.');}
 else{const board=state.board==='all'?'free':state.board;const draft=await api('create_post',{board});p={...draft,board,title:'',body:'',images:[],author_id:session.user.id};}
 state.screen='edit';state.editor=p;
 $('#noc-feed').innerHTML='<form id="noc-editor"><button class="text-button" type="button" data-noc="list">← 목록으로</button><h2>출진 이야기 작성</h2><p class="field-help">'+BOARD_NAMES[p.board]+' · 본문에는 HTML이 실행되지 않아요.</p><label>제목<input name="title" value="'+esc(p.title)+'" minlength="2" maxlength="100" required></label><label>본문<textarea name="body" rows="12" minlength="2" maxlength="20000" required>'+esc(p.body)+'</textarea></label><label>사진 첨부<input type="file" id="noc-image-input" accept="image/jpeg,image/png,image/webp" multiple></label><p class="field-help">총 3장 · 업로드 시 WebP로 변환 · 장당 최대 500KB · 원본 파일은 장당 8MB 이하</p><div id="noc-editor-images"></div><div class="noc-form-actions"><button class="primary-button" type="submit">게시하기</button><button type="button" class="text-button" data-noc="list">작성 중단</button></div></form>';
 await renderEditorImages();
}
async function renderEditorImages(){
 if(!state.editor)return;const p=await api('post',{id:state.editor.id});state.editor.images=p.images;const images=await signedImages(p.images,p.author_id,p.id);
 if(!$('#noc-editor-images'))return;
 $('#noc-editor-images').innerHTML=images.map(i=>'<figure><img src="'+esc(i.url)+'" alt="첨부 사진 미리보기"><button type="button" data-noc="remove-image" data-path="'+esc(i.path)+'">사진 삭제</button></figure>').join('');
}
async function imageBlob(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('8MB 이하의 JPG·PNG·WebP만 첨부할 수 있어요.');
 const image=await createImageBitmap(file);
 try{
  if(image.width*image.height>24000000)throw new Error('이미지 해상도가 너무 커요.');
  const scale=Math.min(1,1600/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [.82,.65,.45,.3]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob?.type==='image/webp'&&blob.size<=config.maxImageBytes)return blob;}
  throw new Error('압축 후에도 500KB를 초과해요. 더 작은 사진을 선택해 주세요.');
 }finally{image.close();}
}
async function uploadImages(files){
 memberRequired();if(!state.editor)throw new Error('게시글부터 작성해 주세요.');
 if(state.editor.images.length+files.length>3)throw new Error('이미지는 총 3장까지 첨부할 수 있어요.');
 for(const file of files){const blob=await imageBlob(file),path=session.user.id+'/'+state.editor.id+'/'+crypto.randomUUID()+'.webp';const {error}=await client.storage.from('community-images').upload(path,blob,{contentType:'image/webp',upsert:false});if(error)throw new Error(error.message);}
 await renderEditorImages();showMessage('사진을 첨부했어요. 게시하기를 눌러 글을 저장해 주세요.');
}
function inputDialog(title,description,initial,callback){
 inputCallback=callback;$('#noc-input-title').textContent=title;$('#noc-input-description').textContent=description;$('#noc-input-value').value=initial||'';$('#noc-input-dialog').showModal();
}
function policy(kind){
 const privacy=kind==='privacy';
 $('#noc-policy-content').innerHTML='<h2 id="noc-policy-title">'+(privacy?'개인정보 처리방침':'이용약관')+'</h2><p class="noc-meta">2026년 10월 26일 · 버전 '+POLICY_VERSION+'</p><p><a href="'+(privacy?'privacy.html':'terms.html')+'" target="_blank" rel="noopener noreferrer">독립 페이지로 열기 ↗</a></p>'+(privacy?PRIVACY_HTML:TERMS_HTML);$('#noc-policy-dialog').showModal();
}
function renderAccount(){
 let body='<h2 id="noc-account-title">냥작사 회원</h2>';
 if(!session){
  body+='<p>구글 계정으로 로그인하고 이야기를 나눠보세요.</p><p class="noc-warning">Google로 계속하면 가입 완료 전에도 계정 식별자·이메일·기본 프로필이 Supabase 인증 시스템에 저장됩니다. 주 저장 국가는 싱가포르이며 국외 지원·로그 처리가 추가로 발생할 수 있어요.</p><div class="noc-text-actions"><button class="text-button" data-noc="policy" data-policy="privacy">개인정보 처리방침 읽기</button><button class="text-button" data-noc="policy" data-policy="terms">이용약관 읽기</button></div><div class="noc-oauth-buttons">'+AUTH_PROVIDERS.map(provider=>'<button class="noc-oauth" data-noc="login" data-provider="'+provider+'" '+(!providers[provider]?'disabled':'')+'>'+'Google'+'로 계속하기</button>').join('')+'</div>';
  if(!providers.google)body+='<p class="noc-warning">로그인 제공자 연결을 준비 중이에요. 운영자가 Google 인증 설정을 마치면 이용할 수 있어요.</p>';
 }else if(!me||me.status==='pending'){
  body+='<h3>가입 마무리</h3><form id="noc-onboard"><label>닉네임<input name="nickname" minlength="2" maxlength="20" required autocomplete="nickname"></label><label class="noc-checkbox"><input name="age" type="checkbox" required> 만 14세 이상입니다.</label><label class="noc-checkbox"><input name="terms" type="checkbox" required> 이용약관에 동의합니다.</label><button type="button" class="text-button" data-noc="policy" data-policy="terms">이용약관 읽기 →</button><label class="noc-checkbox"><input name="privacy" type="checkbox" required> 개인정보 처리방침를 확인했습니다.</label><button type="button" class="text-button" data-noc="policy" data-policy="privacy">개인정보 처리방침 읽기 →</button><button class="primary-button" type="submit" '+(!siteSettings.registration_open&&!me?.role?'disabled':'')+'>가입 완료</button></form>';
  if(!siteSettings.registration_open&&!me?.role)body+='<p class="noc-warning">보관·파기 기준은 적용됐어요. 공급자의 추가 국외 처리 국가·경로 확인 등 가입 개방 준비를 진행 중이에요.</p>';
  body+=(me?.role?'<p class="noc-warning">운영자 비공개 테스트 계정이에요. 일반 가입이 닫혀 있어도 가입을 완료하고 운영 관리 기능을 확인할 수 있어요.</p>':'')+'<p class="field-help">가입하지 않을 경우 로그인 계정도 삭제할 수 있어요.</p><button class="noc-danger" data-noc="withdraw">로그인 계정 삭제</button><button class="text-button" data-noc="logout">로그아웃</button>';
 }else if(me.status==='deleting'){
  body+='<p>회원탈퇴 정리를 진행 중이에요. 정리가 완료되기 전까지 글을 작성할 수 없어요.</p><button class="primary-button" data-noc="finish-deletion">탈퇴 정리 다시 시도</button>';
 }else{
  body+='<h3>'+esc(me.nickname)+'</h3><p class="noc-meta">'+(me.role?'운영진 · ':'')+(me.status==='suspended'?'이용 제한 상태':'정상 이용 중')+'</p><div class="noc-text-actions"><button data-noc="nickname">닉네임 변경</button><button data-noc="appeal">문의·이의제기</button><button data-noc="logout">로그아웃</button></div><h3>내 알림</h3>'+
   (me.notifications.length?'<ul class="noc-notifications">'+me.notifications.map(n=>'<li><span>'+esc(n.message)+'</span><small>'+date(n.created_at)+(n.seen?'':' · 새 알림')+'</small></li>').join('')+'</ul><button class="text-button" data-noc="seen">읽음 처리</button>':'<p class="field-help">아직 알림이 없어요.</p>')+
   '<h3>내 게시글 · 임시저장</h3><ul class="noc-my-posts">'+me.posts.map(p=>'<li><button data-noc="'+(p.status==='draft'?'edit-post':'post')+'" data-id="'+p.id+'">'+esc(p.title||'제목 없는 임시저장')+'</button><small>'+esc(p.status)+'</small></li>').join('')+'</ul><h3>문의 처리 내역</h3>'+
   (me.appeals.map(a=>'<article class="noc-comment"><p>'+esc(a.message)+'</p><p class="field-help">'+esc(a.answer||'답변 대기 중')+'</p></article>').join('')||'<p class="field-help">문의 내역이 없어요.</p>')+
   '<details class="noc-withdraw"><summary>회원탈퇴</summary><p>작성한 글·댓글은 삭제 상태로 전환되고 별점, 첨부파일과 인증 계정을 정리합니다. 신고·운영 기록은 공개되지 않는 별도 기록으로 남을 수 있어요.</p><button class="noc-danger" data-noc="withdraw">회원탈퇴 요청</button></details>';
 }
 $('#noc-account-content').innerHTML=body;
}
async function finishDeletion(){
 await ready;const {data,error}=await client.functions.invoke('noc-account-delete',{body:{}});
 if(error||!data?.ok)throw new Error(data?.error||'탈퇴 정리가 완료되지 않았어요. 다시 시도해 주세요.');
 await client.auth.signOut({scope:'local'});session=null;me=null;accountTitle();renderAccount();showMessage('회원탈퇴가 완료됐어요.');renderFeed();
}
async function adminWorkspace(){
 memberRequired();if(!me.role)throw new Error('운영자 권한이 필요해요.');
 const result=await api('admin');state.screen='admin';$('#noc-account-dialog').close();
 $('#noc-feed').innerHTML='<button class="text-button" data-noc="list">← 게시판으로</button><h2>운영 관리</h2><p class="field-help">신고 원문 열람과 운영 조치는 비공개 감사 기록에 남습니다.</p><h3>신고 접수</h3>'+
  (result.reports.map(r=>'<article class="noc-admin-case"><span class="tag">'+esc(r.status)+'</span><strong>'+esc(r.target_type)+' · '+esc(r.target_id)+'</strong><p>'+esc(r.reason)+'</p><details><summary>접수 당시 내용</summary><p class="noc-body">'+esc(r.snapshot.title||'')+'\n'+esc(r.snapshot.body||'')+'</p></details><div class="noc-text-actions"><button data-noc="moderate" data-target="'+r.target_type+'" data-id="'+r.target_id+'" data-status="hidden">숨김</button><button data-noc="moderate" data-target="'+r.target_type+'" data-id="'+r.target_id+'" data-status="published">복구</button><button data-noc="moderate" data-target="report" data-id="'+r.id+'" data-status="resolved">신고 처리 완료</button><button data-noc="moderate" data-target="report" data-id="'+r.id+'" data-status="dismissed">신고 기각</button>'+(me.role==='owner'&&r.snapshot.author_id?'<button data-noc="moderate" data-target="member" data-id="'+r.snapshot.author_id+'" data-status="suspended">작성자 이용 제한</button><button data-noc="moderate" data-target="member" data-id="'+r.snapshot.author_id+'" data-status="active">작성자 제한 해제</button>':'')+'</div><p class="field-help">'+esc(r.resolution||'')+'</p></article>').join('')||'<p class="field-help">접수된 신고가 없어요.</p>')+
  '<h3>문의·이의제기</h3>'+(result.appeals.map(a=>'<article class="noc-admin-case"><strong>'+esc(a.nickname||'탈퇴한 회원')+' · '+esc(a.status)+'</strong><p>'+esc(a.message)+'</p><p>'+esc(a.answer||'')+'</p><button class="text-button" data-noc="moderate" data-target="appeal" data-id="'+a.id+'">답변하기 →</button></article>').join('')||'<p class="field-help">접수된 문의가 없어요.</p>')+
  '<h3>최근 운영·접근 기록</h3><ul class="noc-audit">'+result.audit.map(a=>'<li>'+date(a.created_at)+' · '+esc(a.action)+'<small>'+esc(a.target_id||'')+'</small></li>').join('')+'</ul>';
}
export async function renderCharacterCommunity(key,element){
 if(!element)return;const ticket=++charRequest;element.dataset.characterKey=key;element.innerHTML='<p class="field-help">캐릭터 평가를 불러오는 중…</p>';
 try{
  const [rating,comments]=await Promise.all([api('character',{key}),api('comments',{character_key:key,page:0})]);
  if(ticket!==charRequest||!element.isConnected)return;
  element.innerHTML='<div class="stage-section-heading"><h3>사령부 캐릭터 평가</h3><span>'+esc(ratingLabel(rating.average,rating.count))+'</span></div><p class="field-help">진화 형태별 평가 · 실제 전투 성능은 레벨과 상황에 따라 달라요.</p><div class="noc-rating-buttons" aria-label="별점 선택">'+[1,2,3,4,5].map(n=>'<button data-noc="rate" data-key="'+key+'" data-stars="'+n+'" aria-label="'+n+'점" aria-pressed="'+(rating.mine===n)+'" class="'+(rating.mine===n?'selected':'')+'">'+n+'점</button>').join('')+(rating.mine?'<button data-noc="rate" data-key="'+key+'" data-stars="">평가 취소</button>':'')+'</div><div id="noc-character-comments" data-page="0">'+commentMarkup(comments)+'</div><button class="text-button" data-noc="more-comments" data-target="character" data-id="'+key+'" '+(comments.length<=20?'hidden':'')+'>댓글 더 보기 →</button>'+commentForm('character',key);
 }catch(error){if(element.isConnected&&ticket===charRequest)element.innerHTML='<p class="field-help">'+esc(error.message)+'</p>';}
}
async function refreshComments(){
 if(state.screen==='post'&&state.post)await showPost(state.post);
 const panel=$('#character-community');if(panel)await renderCharacterCommunity(panel.dataset.characterKey,panel);
}
function bindEvents(){
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-noc]');if(!button)return;const action=button.dataset.noc;
  try{
   if(action==='policy'){policy(button.dataset.policy);return;}
   if(action==='account'){await ready;await refreshMe();renderAccount();$('#noc-account-dialog').showModal();return;}
   if(action==='login'){
    if(!AUTH_PROVIDERS.includes(button.dataset.provider))throw new Error('구글 로그인만 지원해요.');
    if(!providers[button.dataset.provider])throw new Error('로그인 제공자 연결 설정이 아직 완료되지 않았어요.');
    const url=new URL(location.href);url.search='';url.hash='community';
    const {error}=await client.auth.signInWithOAuth({provider:button.dataset.provider,options:{redirectTo:url.href}});if(error)throw error;return;
   }
   if(action==='logout'){const {error}=await client.auth.signOut();if(error)throw error;session=null;await refreshMe();return;}
   if(action==='board'){state.board=button.dataset.board;state.page=0;listView();return;}
   if(action==='list'){listView();return;}
   if(action==='page'){state.page=Number(button.dataset.page);await renderFeed();return;}
   if(action==='post'){$('#noc-account-dialog').close();await showPost(button.dataset.id);return;}
   if(action==='compose'||action==='edit-post'){$('#noc-account-dialog').close();await startEditor(button.dataset.id);return;}
   if(action==='remove-image'){
    memberRequired();if(!safeImagePath(button.dataset.path,session.user.id,state.editor.id))throw new Error('첨부 경로를 확인해 주세요.');
    const {error}=await client.storage.from('community-images').remove([button.dataset.path]);if(error)throw error;await renderEditorImages();return;
   }
   if(action==='delete-post'){
    memberRequired();inputDialog('게시글 삭제','삭제하려면 아래에 삭제를 입력해 주세요.','',async value=>{
     if(value!=='삭제')throw new Error('삭제를 입력해 주세요.');const p=await api('post',{id:button.dataset.id});await api('delete_post',{id:p.id});
     if(p.images.length){const {error}=await client.storage.from('community-images').remove(p.images);if(error)showMessage('글은 삭제됐지만 사진 정리는 다시 확인해야 해요.',true);}
     listView();
    });return;
   }
   if(action==='report'){memberRequired();inputDialog('신고 접수','신고 사유를 5자 이상 입력해 주세요. 개인정보는 적지 마세요.','',async reason=>{await api('report',{target:button.dataset.target,id:button.dataset.id,reason});showMessage('신고를 접수했어요.');});return;}
   if(action==='edit-comment'){memberRequired();const body=button.closest('.noc-comment').querySelector('p').textContent;inputDialog('댓글 수정','2,000자 이내로 수정해 주세요.',body,async value=>{await api('edit_comment',{id:button.dataset.id,body:value});await refreshComments();});return;}
   if(action==='delete-comment'){memberRequired();inputDialog('댓글 삭제','삭제하려면 삭제를 입력해 주세요.','',async value=>{if(value!=='삭제')throw new Error('삭제를 입력해 주세요.');await api('delete_comment',{id:button.dataset.id});await refreshComments();});return;}
   if(action==='rate'){memberRequired();await api('rate',{key:button.dataset.key,stars:button.dataset.stars?Number(button.dataset.stars):null});await refreshComments();return;}
   if(action==='more-comments'){
    const target=button.dataset.target==='post'?$('#noc-post-comments'):$('#noc-character-comments'),page=Number(target.dataset.page)+1;
    const rows=await api('comments',button.dataset.target==='post'?{post_id:button.dataset.id,page}:{character_key:button.dataset.id,page});target.insertAdjacentHTML('beforeend',commentMarkup(rows));target.dataset.page=page;button.hidden=rows.length<=20;return;
   }
   if(action==='nickname'){memberRequired();inputDialog('닉네임 변경','2~20자로 입력해 주세요.',me.nickname,async value=>{await api('nickname',{nickname:value});await refreshMe();});return;}
   if(action==='seen'){await api('notifications_seen');await refreshMe();return;}
   if(action==='appeal'){inputDialog('문의·이의제기','처리 대상과 사유를 알려주세요. 비밀번호 등 민감한 정보는 입력하지 마세요.','',async value=>{await api('appeal',{message:value});await refreshMe();});return;}
   if(action==='admin'){await adminWorkspace();return;}
   if(action==='moderate'){inputDialog('운영 조치','조치 사유를 5자 이상 입력해 주세요. 대상 회원에게 알림으로 전달됩니다.','',async reason=>{await api('moderate',{target:button.dataset.target,id:button.dataset.id,status:button.dataset.status,reason});await adminWorkspace();});return;}
   if(action==='withdraw'){inputDialog('회원탈퇴','게시글·댓글 삭제 처리와 평점 제거 후 첨부파일·인증 계정을 정리합니다. 계속하려면 회원탈퇴를 입력해 주세요.','',async value=>{await api('request_deletion',{confirm:value});await refreshMe();await finishDeletion();});return;}
   if(action==='finish-deletion'){await finishDeletion();return;}
  }catch(error){failure(error);}
 });
 document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.matches('#noc-onboard,#noc-editor,#noc-input-form,.noc-comment-form'))return;event.preventDefault();
  const button=form.querySelector('button[type=submit]');if(button.disabled)return;button.disabled=true;
  try{
   if(form.id==='noc-input-form'){const callback=inputCallback;if(callback){await callback($('#noc-input-value').value.trim());$('#noc-input-dialog').close();}}
   else if(form.id==='noc-onboard'){
    if(!siteSettings.registration_open&&!me?.role)throw new Error('정식 가입 안내를 준비 중이에요.');
    await api('onboard',{nickname:form.elements.nickname.value,age_confirmed:form.elements.age.checked,terms_accepted:form.elements.terms.checked,privacy_accepted:form.elements.privacy.checked,policy_version:POLICY_VERSION});await refreshMe();showMessage('가입이 완료됐어요.');
   }else if(form.id==='noc-editor'){
    memberRequired();const values=validPost(form.elements.title.value,form.elements.body.value);const result=await api('save_post',{id:state.editor.id,...values});state.editor=null;await showPost(result.id);await refreshMe();
   }else{memberRequired();await api('comment',{body:form.elements.body.value,...(form.dataset.target==='post'?{post_id:form.dataset.id}:{character_key:form.dataset.id})});form.reset();await refreshComments();}
  }catch(error){failure(error);let target=form.querySelector('.noc-inline-error');if(!target){target=document.createElement('p');target.className='noc-inline-error';target.setAttribute('role','alert');form.append(target);}target.textContent=error.message;}
  finally{if(button.isConnected)button.disabled=false;}
 });
 $('#noc-image-input')?.addEventListener('change',()=>{});
 document.addEventListener('change',async event=>{if(event.target.id!=='noc-image-input')return;const input=event.target;input.disabled=true;try{await uploadImages([...input.files]);}catch(error){failure(error);}finally{input.disabled=false;input.value='';}});
 let timer;$('#noc-search').addEventListener('input',event=>{clearTimeout(timer);state.query=event.target.value;state.page=0;timer=setTimeout(()=>{state.screen='list';renderFeed();},250);});
}
export function initCommunity(){
 boardButtons();bindEvents();
 ready=(async()=>{
  const sdk=await import(config.sdkURL);client=sdk.createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange((event,nextSession)=>{session=nextSession;setTimeout(()=>refreshMe().catch(failure),0);});
  const {data,error}=await client.auth.getSession();if(error)throw error;session=data.session;
  try{const response=await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.publishableKey}});if(response.ok)providers=(await response.json()).external||{};}catch{/* Provider availability stays disabled until verified. */}
  return client;
 })();
 ready.then(async()=>{siteSettings=await api("site_settings");await refreshMe();if(postQuery&&/^[0-9a-f-]{36}$/.test(postQuery))await showPost(postQuery);else await renderFeed();}).catch(failure);
}
