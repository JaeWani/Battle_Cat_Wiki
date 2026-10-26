import {escapeHTML as esc} from './community-model.mjs?v=google-only-1';
const $=s=>document.querySelector(s);
const rarities=['기본','EX','레어','슈퍼 레어','울트라 슈퍼 레어','레전드 레어'];
const samples=[{id:0,level:20,plus:10},{id:1,level:20,plus:15},{id:2,level:20,plus:8},{id:25,level:30,plus:0},{id:43,level:40,plus:1},{id:269,level:50,plus:0},{id:6,level:20,plus:12},{id:7,level:20,plus:9}];
let catalog=[],preview=true,tab='cats',query='',rarity='all',account={signedIn:false,nickname:'',status:null,posts:[],notificationCount:0};
function rows(){return preview?samples.map(s=>({...s,unit:catalog.find(c=>c.id===s.id&&c.form===0)})).filter(s=>s.unit):[];}
function renderInventory(){
 const target=$('#my-inventory');if(!target)return;
 const items=rows().filter(s=>(rarity==='all'||s.unit.rarity===Number(rarity))&&s.unit.name.toLowerCase().includes(query.toLowerCase()));
 $('#my-result-count').textContent=preview?'예시 캐릭터 '+items.length+'종':'등록된 캐릭터 0종';
 target.innerHTML=items.length?items.map(s=>'<button class="my-cat" data-detail="'+esc(s.unit.key)+'" data-kind="cat"><span class="my-cat-rarity r'+s.unit.rarity+'">'+esc(rarities[s.unit.rarity]||'기타')+'</span><div class="my-cat-art"><img src="'+esc(s.unit.image)+'" alt="" loading="lazy"></div><strong>'+esc(s.unit.name)+'</strong><span class="my-cat-level">Lv. <b>'+s.level+'</b>'+(s.plus?' <em>+ '+s.plus+'</em>':'')+'</span><span class="my-cat-foot">1진화 <span>도감 보기 ↗</span></span></button>').join(''):'<div class="my-empty"><img src="assets/u/0/0.png" width="104" height="79" alt=""><h3>'+(preview?'검색 결과가 없어요.':'아직 부대를 불러오지 않았어요.')+'</h3><p>'+(preview?'다른 이름이나 희귀도로 찾아보세요.':'SAVE_DATA 가져오기를 연결하면 보유 캐릭터가 여기에 모여요.')+'</p>'+(!preview?'<button class="text-button" data-profile="preview">완성 화면 미리보기 →</button>':'')+'</div>';
}
function renderBody(){
 const target=$('#my-body');if(!target)return;
 if(tab==='cats'){
  target.innerHTML='<div class="my-collection-title"><div><h2>나의 냥코 도감 <span class="my-mini">MY COLLECTION</span></h2><p>함께 출진할 냥코를 찾아보세요.</p></div><span class="my-example-label">'+(preview?'예시 데이터':'불러오기 전')+'</span></div><div class="my-toolbar"><label class="searchbox"><span aria-hidden="true">⌕</span><input id="my-search" type="search" placeholder="보유 캐릭터 이름 검색" aria-label="보유 캐릭터 이름 검색" value="'+esc(query)+'"></label><select id="my-rarity" aria-label="보유 캐릭터 희귀도"><option value="all">전체 희귀도</option>'+rarities.map((r,i)=>'<option value="'+i+'" '+(rarity===String(i)?'selected':'')+'>'+r+'</option>').join('')+'</select></div><div class="my-list-caption"><span id="my-result-count"></span><span>캐릭터를 누르면 도감으로 연결돼요</span></div><div class="my-cat-grid" id="my-inventory"></div>';
  renderInventory();
 }else if(tab==='progress'){
  target.innerHTML='<div class="my-collection-title"><div><h2>게임 진행 현황</h2><p>챕터별 진행 상태를 모아볼 공간이에요.</p></div><span class="my-example-label">'+(preview?'예시 데이터':'불러오기 전')+'</span></div><div class="my-progress-grid">'+['세계편','미래편','우주편'].map((name,i)=>'<article><span class="small-label">CHAPTER 0'+(i+1)+'</span><h3>'+name+'</h3><div class="my-progress-steps">'+[1,2,3].map(n=>'<span class="'+(preview&&(i===0||n===1)?'filled':'')+'">'+n+'장</span>').join('')+'</div><p>'+(preview?(i===0?'3장까지 클리어 · 예시':'1장 클리어 · 예시'):'연결된 진행 정보가 없어요.')+'</p></article>').join('')+'</div><p class="my-section-note">진행 정보의 실제 가져오기는 세이브 분석 기능을 연결한 뒤 제공할 예정이에요.</p>';
 }else{
  target.innerHTML='<div class="my-collection-title"><div><h2>커뮤니티 활동</h2><p>내가 남긴 출진 이야기를 다시 확인해요.</p></div><button class="text-button" data-noc="account">내 활동 · 알림 →</button></div>'+
  (account.signedIn&&account.posts.length?'<div class="my-activity-list">'+account.posts.slice(0,6).map(p=>'<button data-view="community" data-noc="post" data-id="'+esc(p.id)+'"><span class="my-activity-kind">게시글</span><strong>'+esc(p.title||'제목 없는 글')+'</strong><span>↗</span></button>').join('')+'</div>':'<div class="my-empty"><h3>'+(account.signedIn?'아직 작성한 글이 없어요.':'로그인하고 이야기를 남겨보세요.')+'</h3><p>커뮤니티 활동은 실제 로그인한 계정의 기록만 표시해요.</p><button class="text-button" '+(account.signedIn?'data-view="community"':'data-noc="account"')+'>'+(account.signedIn?'게시판 둘러보기':'Google로 로그인')+' →</button></div>');
 }
}
function render(){
 const root=$('#my-profile-root');if(!root)return;
 const nickname=account.nickname||(account.signedIn?'가입을 마무리해 주세요':'나의 냥코 사령부');
 root.innerHTML='<div class="my-preview-notice"><span class="my-preview-dot"></span><p><strong>디자인 미리보기</strong> '+(preview?'게임 수치와 보유 캐릭터는 예시예요. 계정에 저장되지 않아요.':'가져오기 전의 빈 화면을 보고 있어요.')+'</p><button data-profile="preview">'+(preview?'빈 화면 보기':'예시 화면 보기')+' <span aria-hidden="true">↔</span></button></div>'+
 '<div class="my-layout"><aside class="my-sidebar"><div class="my-member-card"><div class="my-member-top"><span class="small-label">NOC MEMBER</span><span class="my-member-status">'+(account.signedIn?'연결됨':'로그인 전')+'</span></div><div class="my-avatar"><img src="assets/u/0/0.png" width="104" height="79" alt="기본 프로필 고양이"></div><h2>'+esc(nickname)+'</h2><p>'+(account.signedIn?'오늘도 즐거운 출진 되세요.':'나만의 부대와 기록을 한곳에.')+'</p><button class="my-account-action" data-noc="account">'+(account.signedIn?'계정 · 닉네임 관리':'Google로 로그인')+' <span>↗</span></button></div><div class="my-side-links"><button data-view="calculator">전투 계산기 <span>↗</span></button><button data-view="cats">전체 아군 도감 <span>↗</span></button><button data-noc="account">내 활동 · 알림 <span>'+(account.notificationCount||'↗')+'</span></button></div><div class="my-side-note"><span class="small-label">YOUR DATA, YOUR CONTROL</span><p>게임 데이터를 가져와도<br>게임 원본에는 손대지 않아요.</p><button data-noc="policy" data-policy="privacy">개인정보 처리방침 ↗</button></div></aside>'+
 '<div class="my-main"><section class="my-import-card"><div class="my-import-copy"><span class="my-serial">PERSONAL OPERATIONS / 01</span><h2>나의 부대를,<br>이곳으로.</h2><p>보유 냥코와 레벨을 한 번에.<br>SAVE_DATA로 시작하는 나만의 작전 기록.</p><button class="my-import-button" data-profile="import">데이터 불러오기 <span>↗</span></button><span class="my-import-note">현재는 화면 미리보기 · 파일 처리 준비 중</span></div><div class="my-file-visual" aria-hidden="true"><span class="my-file-badge">LOCAL FILE</span><div class="my-file-paper"><span>NOC / GAME RECORD</span><img src="assets/u/0/0.png" width="104" height="79" alt=""><strong>SAVE_DATA</strong><div class="my-file-lines"><i></i><i></i><i></i></div></div><span class="my-file-caption">한 파일로 모으는 나의 냥코</span></div></section>'+
 '<div class="my-stat-strip"><div><span>보유 캐릭터</span><strong>'+(preview?'8':'—')+'<small>종</small></strong><span class="my-stat-note">'+(preview?'미리보기 예시':'아직 연결되지 않았어요')+'</span></div><div><span>최고 캐릭터 레벨</span><strong>'+(preview?'50':'—')+'<small>Lv.</small></strong><span class="my-stat-note">'+(preview?'미리보기 예시':'데이터를 불러와 주세요')+'</span></div><div><span>데이터 업데이트</span><strong class="my-update-label">불러오기 전</strong><span class="my-stat-note">파일 연결 기능 준비 중</span></div></div>'+
 '<div class="my-tabs" role="tablist" aria-label="내 정보 분류">'+[['cats','보유 캐릭터'],['progress','게임 진행'],['activity','커뮤니티 활동']].map(([id,name])=>'<button id="my-tab-'+id+'" role="tab" aria-selected="'+(tab===id)+'" aria-controls="my-body" tabindex="'+(tab===id?'0':'-1')+'" data-profile-tab="'+id+'" class="'+(tab===id?'active':'')+'">'+name+(id==='cats'&&preview?'<span>8</span>':'')+'</button>').join('')+'</div><section id="my-body" role="tabpanel" aria-labelledby="my-tab-'+tab+'"></section>'+
 '<p class="my-bottom-note">냥코 작전 사령부는 PONOS의 공식 서비스가 아닙니다. 게임 이미지 © PONOS 및 각 권리자</p></div></div>';
 renderBody();
}
export function updateProfileCatalog(cats){catalog=cats;render();}
export function initProfile(){
 render();
 document.addEventListener('noc:account-state',e=>{account=e.detail;render();});
 $('#profile-view').addEventListener('click',e=>{
  const action=e.target.closest('[data-profile]')?.dataset.profile;
  if(action==='preview'){preview=!preview;render();$('#profile-view [data-profile="preview"]')?.focus();}
  if(action==='import')$('#my-import-dialog').showModal();
  if(action==='close-import')$('#my-import-dialog').close();
  const target=e.target.closest('[data-profile-tab]');if(target)selectTab(target.dataset.profileTab);
 });
 document.addEventListener('click',e=>{if(e.target.closest('[data-profile="close-import"]'))$('#my-import-dialog').close();});
 $('#profile-view').addEventListener('input',e=>{if(e.target.id==='my-search'){query=e.target.value;renderInventory();}});
 $('#profile-view').addEventListener('change',e=>{if(e.target.id==='my-rarity'){rarity=e.target.value;renderInventory();}});
 $('#profile-view').addEventListener('keydown',e=>{
  if(!e.target.matches('[data-profile-tab]')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const tabs=['cats','progress','activity'],index=tabs.indexOf(tab);
  selectTab(e.key==='Home'?'cats':e.key==='End'?'activity':tabs[(index+(e.key==='ArrowRight'?1:2))%3]);
 });
 function selectTab(next){tab=next;for(const b of $('#profile-view').querySelectorAll('[data-profile-tab]')){const active=b.dataset.profileTab===tab;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}$('#my-body').setAttribute('aria-labelledby','my-tab-'+tab);renderBody();$('#my-tab-'+tab).focus();}
}
