import {initGrowthPlanner} from './growth-planner.mjs?v=simple-1';
import {escapeHTML as esc} from './community-model.mjs?v=google-only-1';
import {readGameProfile,storeGameProfile,removeGameProfile,storeProfileAvatar} from './community.mjs?v=simple-1';
import {formatGameVersion,MAX_SAVE_BYTES} from './save-parser.mjs';
import {groupCharacters,importTalentChoices,talentSummary} from './game-profile-model.mjs';
import {initProfileEditor} from './profile-editor.mjs';
const $=s=>document.querySelector(s),rarities=['기본','EX','레어','슈퍼 레어','울트라 슈퍼 레어','레전드 레어'];
const regions={kr:'한국판',jp:'일본판',en:'영문판',tw:'대만판'};
import {avatarChoices,resolveAvatar} from './avatar-model.mjs';
import {initAvatarPicker} from './profile-avatar.mjs';
let growthPlanner=null;
let avatarCatalog=[],avatarPicker=null;
let groups=[],optionsPromise=null,editor=null,loading=false,loadError=false;
let catalog=[],unitMap=new Map(),tab='cats',query='',rarity='all',saved=null,staged=null,omitted=0,expected=null,busy=false,worker=null,timer=null,job=0,accountGeneration=0,loadedFor=null,status='',consent=false;
let account={id:null,signedIn:false,nickname:'',status:null,posts:[],notificationCount:0,avatarKey:'c0-0'};
const date=v=>new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
async function ensureGroups(){
 if(!catalog.length)throw new Error('도감 자료를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
 if(!optionsPromise)optionsPromise=fetch('data/profile-options.json').then(r=>{if(!r.ok)throw new Error('본능 자료를 불러오지 못했습니다.');return r.json();}).catch(e=>{optionsPromise=null;throw e;});
 groups=groupCharacters(catalog,await optionsPromise);return groups;
}
const sourceLabel=()=>saved?.source==='manual'?'직접 입력':saved?.source==='mixed'?'가져오기 + 직접 입력':'가져온 데이터';
function rows(){return (saved?.cats||[]).map(s=>({...s,unit:unitMap.get(s.id+'-'+s.form)}));}
function statusText(message){status=message;const e=$('#my-game-status');if(e)e.textContent=message;}
function renderInventory(){
 const target=$('#my-inventory');if(!target)return;
 const items=rows().filter(s=>(rarity==='all'||s.unit?.rarity===Number(rarity))&&(s.unit?.name||'#'+s.id).toLowerCase().includes(query.toLowerCase()));
 $('#my-result-count').textContent='등록된 캐릭터 '+items.length+'종';
 target.innerHTML=items.length?items.map(s=>'<button class="my-cat" '+(s.unit?'data-detail="'+esc(s.unit.key)+'" data-kind="cat"':'disabled')+'><span class="my-cat-rarity r'+(s.unit?.rarity??0)+'">'+esc(rarities[s.unit?.rarity]||'도감 미등록')+'</span><div class="my-cat-art">'+(s.unit?'<img src="'+esc(s.unit.image)+'" alt="" loading="lazy">':'<span>#'+s.id+'</span>')+'</div><strong>'+esc(s.unit?.name||'미등록 캐릭터 #'+s.id)+'</strong><span class="my-cat-level">Lv. <b>'+s.level+'</b>'+(s.plus?' <em>+ '+s.plus+'</em>':'')+'</span><span class="my-saved-talent">'+esc(talentSummary(s,groups.find(g=>g.id===s.id)?.talents||[]))+'</span><span class="my-cat-foot">'+(s.form+1)+'진화</span></button>').join(''):'<div class="my-empty"><h3>'+(saved?'검색 결과 없음':'등록된 게임 데이터 없음')+'</h3><p>'+(saved?'검색어 또는 희귀도를 변경해 주세요.':'직접 캐릭터를 등록하거나 SAVE_DATA를 가져와 주세요.')+'</p>'+(!saved?'<button class="text-button" data-profile="manual">캐릭터 직접 설정 →</button><button class="text-button" data-profile="import">데이터 가져오기 →</button>':'')+'</div>';
}
function renderBody(){
 const target=$('#my-body');if(!target)return;
 if(tab==='cats'){
  target.innerHTML='<div class="my-collection-title"><h2>보유 캐릭터</h2><span class="my-example-label">'+(saved?sourceLabel():'미등록')+'</span></div><div class="my-toolbar"><label class="searchbox"><span aria-hidden="true">⌕</span><input id="my-search" type="search" placeholder="보유 캐릭터 이름 검색" aria-label="보유 캐릭터 이름 검색" value="'+esc(query)+'"></label><select id="my-rarity" aria-label="보유 캐릭터 희귀도"><option value="all">전체 희귀도</option>'+rarities.map((r,i)=>'<option value="'+i+'" '+(rarity===String(i)?'selected':'')+'>'+r+'</option>').join('')+'</select></div><div class="my-list-caption"><span id="my-result-count"></span></div><div class="my-cat-grid" id="my-inventory"></div>';renderInventory();
 }else if(tab==='growth'){
  growthPlanner?.render(target);
 }else if(tab==='progress'){
  target.innerHTML='<div class="my-collection-title"><h2>메인 챕터 진행</h2><span class="my-example-label">'+(saved?sourceLabel():'미등록')+'</span></div><div class="my-progress-grid">'+['세계편','미래편','우주편'].map((name,i)=>'<article><h3>'+name+'</h3>'+[0,1,2].map(n=>{const p=saved&&saved.progressKnown!==false?saved.progress[i*3+n]:null;return '<div class="my-chapter-row"><strong>'+(n+1)+'장</strong><span>'+(p?p.cleared+' / 48 클리어':'—')+'</span><small>'+(p?'최고급 보물 '+p.gold+' / 48':'데이터 없음')+'</small></div>';}).join('')+'</article>').join('')+'</div><p class="my-section-note">가져온 파일 기준입니다. 캐릭터 직접 설정은 진행 기록을 바꾸지 않습니다.</p>';
 }else{
  target.innerHTML='<div class="my-collection-title"><h2>내 활동</h2><button class="text-button" data-noc="account">내 활동 · 알림 →</button></div>'+(account.signedIn&&account.posts.length?'<div class="my-activity-list">'+account.posts.slice(0,6).map(p=>'<button data-view="community" data-noc="post" data-id="'+esc(p.id)+'"><span class="my-activity-kind">게시글</span><strong>'+esc(p.title||'제목 없는 글')+'</strong><span>↗</span></button>').join('')+'</div>':'<div class="my-empty"><h3>'+(account.signedIn?'작성한 게시글 없음':'로그인이 필요합니다.')+'</h3><button class="text-button" '+(account.signedIn?'data-view="community"':'data-noc="account"')+'>'+(account.signedIn?'게시판':'Google 로그인')+' →</button></div>');
 }
}
function render(){
 const root=$('#my-profile-root');if(!root)return;
 const avatar=resolveAvatar(account.avatarKey,avatarCatalog);
 const nickname=account.nickname||(account.signedIn?'가입 완료 전':'로그인 전'),total=(saved?.cats||[]).length,highest=total?Math.max(...saved.cats.map(c=>c.level+c.plus)):null;
 root.innerHTML='<p class="my-game-status" id="my-game-status" role="status">'+esc(status)+'</p><div class="my-layout"><aside class="my-sidebar"><div class="my-member-card"><div class="my-member-top"><span class="my-member-status">'+(account.signedIn?'연결됨':'로그인 전')+'</span></div><button type="button" class="my-avatar my-avatar-button" data-avatar-open aria-label="프로필 사진 변경"><img src="'+esc(avatar.image)+'" width="104" height="79" alt="'+esc(avatar.name)+' 프로필 사진"><span>변경</span></button><button type="button" class="text-button my-avatar-change" data-avatar-open>프로필 사진 변경</button><h2>'+esc(nickname)+'</h2><p>'+(account.signedIn?'Google 계정 연결':'Google 계정 미연결')+'</p><button class="my-account-action" data-noc="account">계정 관리 <span>↗</span></button></div></aside>'+
 '<div class="my-main"><section class="my-import-card"><div class="my-import-copy"><h2>게임 데이터</h2><p>'+(saved?esc(regions[saved.region])+' · '+sourceLabel()+(saved.gameVersion?' · '+formatGameVersion(saved.gameVersion):''):'연결된 데이터 없음')+'</p></div><div class="my-import-control"><button class="my-import-button my-manual-button" data-profile="manual" '+(loading?'disabled':'')+'>캐릭터 직접 설정 <span>↗</span></button><button class="my-import-button" data-profile="import">'+(saved?'다시 가져오기':'데이터 가져오기')+' <span>↗</span></button></div></section>'+
 '<div class="my-stat-strip"><div><span>보유 캐릭터</span><strong>'+(saved?total:'—')+'<small>종</small></strong></div><div><span>최고 총 레벨</span><strong>'+(highest??'—')+'<small>Lv.</small></strong></div><div><span>데이터 업데이트</span><strong class="my-update-label">'+(saved?esc(date(saved.updated_at)):'불러오기 전')+'</strong><span class="my-stat-note">자동 동기화 없음</span></div></div>'+
 '<div class="my-game-actions">'+(account.signedIn?'<button class="text-button" data-profile="reload">저장 정보 새로고침</button>':'<button class="text-button" data-noc="account">Google 로그인</button>')+(saved?'<button class="text-button my-delete-game" data-profile="delete">게임 데이터 삭제</button>':'')+'</div>'+
 '<div class="my-tabs" role="tablist" aria-label="내 정보 분류">'+[['cats','보유 캐릭터'],['progress','게임 진행'],['growth','육성 목표'],['activity','내 활동']].map(([id,name])=>'<button id="my-tab-'+id+'" role="tab" aria-selected="'+(tab===id)+'" aria-controls="my-body" tabindex="'+(tab===id?'0':'-1')+'" data-profile-tab="'+id+'" class="'+(tab===id?'active':'')+'">'+name+(id==='cats'&&saved?'<span>'+total+'</span>':'')+'</button>').join('')+'</div><section id="my-body" role="tabpanel" aria-labelledby="my-tab-'+tab+'"></section></div></div>';
 renderBody();
}
function stopWorker(){job++;if(worker)worker.terminate();worker=null;clearTimeout(timer);busy=false;}
function renderImport(){
 const target=$('#my-import-content');if(!target)return;
 const previousCount=saved?.cats.length||0;
 target.innerHTML='<h2 id="my-import-title">게임 데이터 가져오기</h2><p>12.0.0~15.5.x 형식 · 한국판/일본판/영문판/대만판 · 최대 8MB</p><div class="my-upload-placeholder"><strong>SAVE_DATA</strong><input id="my-save-file" type="file" aria-label="SAVE_DATA 파일 선택" '+(busy?'disabled':'')+'><p>원본 파일은 서버로 전송하지 않습니다.</p></div>'+
 (busy?'<p class="my-import-busy" role="status">파일 검사 및 분석 중…</p>':'')+
 (staged?'<div class="my-import-summary"><dl><div><dt>지역 / 버전</dt><dd>'+esc(regions[staged.region])+' / '+formatGameVersion(staged.gameVersion)+'</dd></div><div><dt>저장할 캐릭터</dt><dd>'+staged.cats.length+'종'+(omitted?' · 미등록 형태 '+omitted+'종 제외':'')+'</dd></div><div><dt>기존 데이터</dt><dd>'+previousCount+'종 → '+staged.cats.length+'종으로 교체</dd></div></dl><div class="my-import-sample">'+staged.cats.slice(0,12).map(c=>'<div><span>'+esc(unitMap.get(c.id+'-'+c.form)?.name||'#'+c.id)+'</span><strong>Lv. '+c.level+(c.plus?' + '+c.plus:'')+' · '+(c.form+1)+'진화</strong><small>'+esc(talentSummary(c,groups.find(g=>g.id===c.id)?.talents||[]))+'</small></div>').join('')+'</div><p>보유 캐릭터·레벨·현재 진화·본능·메인 챕터 진행을 저장합니다. '+(staged.talentStatus==='read'?'본능 구간을 확인했습니다. 파일에서 읽은 본능 레벨로 갱신합니다.':'본능 구간을 확인하지 못했습니다. 같은 캐릭터의 기존 본능 기록을 유지하고, 나머지는 미확인으로 저장합니다.')+' 재화·인계 코드·문의 코드·토큰은 저장하지 않습니다.'+(omitted?' 도감에 없는 캐릭터 형태는 저장 대상에서 제외됩니다.':'')+'</p><label class="my-import-consent"><input id="my-import-consent" type="checkbox" '+(consent?'checked':'')+'> 게임 정보의 계정 저장에 동의합니다.</label><button class="text-button" data-noc="policy" data-policy="privacy">개인정보 처리방침</button><div class="my-import-submit">'+(account.status==='active'?'<button class="primary-button" data-profile="save" '+(!consent||busy?'disabled':'')+'>계정에 저장</button>':'<button class="primary-button" data-noc="account">로그인 · 가입 완료</button>')+'<button class="text-button" data-profile="close-import">취소</button></div></div>':'<p class="field-help">분석 후 저장할 내용을 확인할 수 있습니다. 계정 저장에는 로그인이 필요합니다.</p>')+'<p id="my-import-error" class="my-import-error" role="alert"></p>';
}
function importError(message){const e=$('#my-import-error');if(e)e.textContent=message;else statusText(message);}
async function analyze(file){
 stopWorker();const ticket=job;staged=null;omitted=0;consent=false;
 if(!file)return;
 if(file.size>MAX_SAVE_BYTES){renderImport();importError('8MB 이하의 SAVE_DATA 파일을 선택해 주세요.');return;}
 busy=true;renderImport();
 try{
  await ensureGroups();if(ticket!==job)return;
  const buffer=await file.arrayBuffer();if(ticket!==job)return;
  worker=new Worker(new URL('./save-worker.mjs',import.meta.url),{type:'module'});
  timer=setTimeout(()=>{if(ticket!==job)return;stopWorker();renderImport();importError('분석 시간이 초과됐습니다. 파일을 확인하고 다시 시도해 주세요.');},10000);
  worker.onmessage=({data})=>{
   if(ticket!==job)return;stopWorker();
   if(!data.ok){renderImport();importError(data.error);return;}
   const known=data.data.cats.filter(c=>unitMap.has(c.id+'-'+c.form));omitted=data.data.cats.length-known.length;
   if(omitted&&known.length===0){renderImport();importError('도감에 등록된 캐릭터 형태가 없습니다. 이 파일의 버전과 도감 자료를 확인해 주세요.');return;}
   staged=importTalentChoices({...data.data,cats:known},saved,groups);expected=saved?.updated_at||null;renderImport();
  };
  worker.onerror=()=>{if(ticket!==job)return;stopWorker();renderImport();importError('분석 모듈을 실행하지 못했습니다. 새로고침 후 다시 시도해 주세요.');};
  worker.postMessage(buffer,[buffer]);
 }catch{if(ticket===job){stopWorker();renderImport();importError('파일을 읽을 수 없습니다. 다시 선택해 주세요.');}}
}
async function reload(){
 const ticket=++accountGeneration,id=account.id;
 if(!account.signedIn){saved=null;loading=false;loadError=false;render();return;}
 loading=true;loadError=false;render();
 try{const result=await readGameProfile();if(ticket!==accountGeneration||id!==account.id)return;saved=result;status='';}catch(error){if(ticket===accountGeneration){loadError=true;status=error.message;}}finally{if(ticket===accountGeneration){loading=false;render();}}
}
function selectTab(next){
 tab=next;for(const b of $('#profile-view').querySelectorAll('[data-profile-tab]')){const active=b.dataset.profileTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
 $('#my-body').setAttribute('aria-labelledby','my-tab-'+tab);renderBody();$('#my-tab-'+tab).focus();
}
export function updateProfileCatalog(cats,enemies=[]){avatarCatalog=avatarChoices(cats,enemies);catalog=cats;unitMap=new Map(catalog.map(c=>[c.id+'-'+c.form,c]));render();ensureGroups().then(render).catch(e=>statusText(e.message));}
export function initProfile(){
 growthPlanner=initGrowthPlanner({getSaved:()=>saved,getAccount:()=>account,getCatalog:()=>catalog});
 avatarPicker=initAvatarPicker({getChoices:()=>avatarCatalog,getAccount:()=>account,onSave:async key=>{await storeProfileAvatar(key);status='프로필 사진을 저장했습니다.';render();}});
 editor=initProfileEditor({getSaved:()=>saved,getGroups:async()=>{if(loading||loadError)throw new Error('저장된 정보를 먼저 새로고침해 주세요.');return ensureGroups();},getAccount:()=>account,onSave:async(snapshot,expected)=>{const id=account.id;const result=await storeGameProfile(snapshot,expected);if(id!==account.id)throw new Error('계정이 변경되었습니다. 다시 로그인해 주세요.');saved=result;status='캐릭터 설정을 저장했습니다.';render();}});
 render();
 document.addEventListener('noc:account-state',e=>{
  const changed=account.id!==e.detail.id;account=e.detail;
  if(changed){growthPlanner.reset();avatarPicker.reset();editor.reset();loading=false;loadError=false;accountGeneration++;stopWorker();staged=null;saved=null;loadedFor=null;status='';$('#my-import-dialog')?.close();}
  render();if(account.signedIn&&loadedFor!==account.id){loadedFor=account.id;reload();}
 });
 document.addEventListener('click',async e=>{
  const action=e.target.closest('[data-profile]')?.dataset.profile;
  try{
   if(action==='manual'){await editor.open();}
   if(action==='import'){if(loading||loadError)throw new Error('저장된 정보를 먼저 새로고침해 주세요.');staged=null;consent=false;renderImport();$('#my-import-dialog').showModal();}
   if(action==='close-import')$('#my-import-dialog').close();
   if(action==='reload')await reload();
   if(action==='save'){
    if(!staged||!consent||busy)return;
    const id=account.id;if(!id||account.status!=='active')throw new Error('로그인과 가입 완료가 필요합니다.');
    const snapshot=staged;busy=true;renderImport();
    try{const result=await storeGameProfile(snapshot,expected);if(id!==account.id)return;saved=result;status='게임 데이터를 저장했습니다.';$('#my-import-dialog').close();render();}
    finally{busy=false;if($('#my-import-dialog').open)renderImport();}
   }
   if(action==='delete'&&saved&&confirm('계정에 저장한 게임 데이터를 삭제할까요? 회원 계정과 게임 원본은 유지됩니다.')){
    const id=account.id;await removeGameProfile(saved.updated_at);if(id!==account.id)return;saved=null;status='저장된 게임 데이터를 삭제했습니다.';render();
   }
  }catch(error){if($('#my-import-dialog').open)importError(error.message);else statusText(error.message);}
  const target=e.target.closest('[data-profile-tab]');if(target)selectTab(target.dataset.profileTab);
 });
 document.addEventListener('change',e=>{
  if(e.target.id==='my-save-file'){const file=e.target.files[0];e.target.value='';analyze(file);}
  if(e.target.id==='my-import-consent'){consent=e.target.checked;const save=$('[data-profile="save"]');if(save)save.disabled=!consent||busy;}
  if(e.target.id==='my-rarity'){rarity=e.target.value;renderInventory();}
 });
 $('#profile-view').addEventListener('input',e=>{if(e.target.id==='my-search'){query=e.target.value;renderInventory();}});
 $('#profile-view').addEventListener('keydown',e=>{
  if(!e.target.matches('[data-profile-tab]')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const tabs=[...$('#profile-view').querySelectorAll('[data-profile-tab]')].map(b=>b.dataset.profileTab),index=tabs.indexOf(tab);selectTab(e.key==='Home'?tabs[0]:e.key==='End'?tabs.at(-1):tabs[(index+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length]);
 });
 $('#my-import-dialog').addEventListener('close',()=>{stopWorker();staged=null;consent=false;});
}
