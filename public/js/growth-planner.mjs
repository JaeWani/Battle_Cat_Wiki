import {escapeHTML as esc} from './community-model.mjs?v=google-only-1';
import {publicNoticeURL} from './notice-links.mjs';
import {MAX_GOALS,validGoal,validPlan,requirements,activityCandidates,whole} from './growth-model.mjs';
import {isStale,kstDay} from './events.mjs';
const fmt=n=>n.toLocaleString('ko-KR'),empty=()=>({version:1,goals:[],stock:{}});
function safeSource(value){try{const u=new URL(value);if(u.protocol==='https:'&&['ponosgames.com','nyanko-announcement.ponosgames.com'].includes(u.hostname))return publicNoticeURL(u.href);}catch{}return 'https://battlecats.club/kr/';}
export function initGrowthPlanner({getSaved,getAccount,getCatalog}){
 let dataPromise,data=null,snapshot=null,plan=empty(),key=null,view=null,ticket=0,message='',persistError='';
 const storageKey=()=> 'noc-growth-v1:'+ (getAccount().id||'guest');
 function loadPlan(){const next=storageKey();if(key===next)return;key=next;plan=empty();message='';persistError='';try{const raw=localStorage.getItem(key);if(raw)plan=validPlan(JSON.parse(raw),data);}catch{persistError='저장된 계획을 읽지 못했습니다. 새 계획은 이 화면에서 만들 수 있습니다.';}}
 function save(next){plan=validPlan(next,data);try{localStorage.setItem(key,JSON.stringify(plan));persistError='';}catch{persistError='브라우저 저장에 실패했습니다. 현재 화면에만 유지되며 새로고침하면 사라질 수 있습니다.';}}
 function error(e){const el=view?.querySelector('#growth-feedback');if(el){el.textContent=e.message;el.setAttribute('role','alert');}}
 async function render(element){
  view=element;const current=++ticket;element.innerHTML='<p role="status">육성 자료를 불러오는 중…</p>';
  try{
   if(!dataPromise)dataPromise=fetch('data/growth.json').then(r=>{if(!r.ok)throw new Error('육성 자료를 불러오지 못했습니다.');return r.json();}).catch(e=>{dataPromise=null;throw e;});
   const [dataset,events]=await Promise.all([dataPromise,fetch('data/events.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(()=>null)]);
   if(current!==ticket||!element.isConnected)return;data=dataset;snapshot=events;loadPlan();paint();
  }catch(e){if(current===ticket)element.innerHTML='<p role="alert">'+esc(e.message)+'</p><button type="button" data-growth="retry">다시 시도</button>';}
 }
 function paint(){
  if(!view?.isConnected||key!==storageKey())return;
  const result=requirements(plan,data,getSaved()),catalog=getCatalog(),names=new Map(catalog.map(c=>[c.id+'-'+c.form,c]));
  view.innerHTML=`<section class="growth-panel"><div class="growth-title"><div><h2>목표 육성 · 오늘 할 일</h2><p>필요한 재료를 모으고, 확인된 한국판 일정으로 도전할 곳을 찾으세요.</p></div><span class="tag">${plan.goals.length} / ${MAX_GOALS} 목표</span></div>
  <p class="growth-note">계획·보유 재료는 <strong>이 브라우저에만 저장</strong>됩니다. 로그인 계정별로 구분되며 다른 기기에 자동 동기화되지 않습니다. 캐릭터의 현재 레벨·형태는 내 정보의 저장 데이터를 참고합니다. 재료는 직접 입력하며 게임이나 계정 데이터에서 차감하지 않습니다.</p>
  <p id="growth-feedback" role="${persistError?'alert':'status'}">${esc(persistError||message)}</p>
  <details class="growth-add" ${plan.goals.length?'':'open'}><summary>육성 목표 추가·변경</summary><form id="growth-goal-form"><label>캐릭터 검색<input id="growth-search" type="search" placeholder="이름 또는 ID" autocomplete="off"></label><label>캐릭터<select name="id" id="growth-cat" required></select></label><p id="growth-profile-hint" class="growth-note"></p><div class="growth-fields"><label>현재 기본 레벨<input name="currentLevel" type="number" min="1" max="60" value="1" required></label><label>현재 진화 완료 단계<select name="currentForm"></select></label><label>목표 기본 레벨<input name="targetLevel" type="number" min="1" max="60" value="30" required></label><label>목표 진화 단계<select name="targetForm"></select></label></div><p class="growth-note">플러스 레벨은 XP 육성에 포함하지 않습니다. 현재 선택 형태와 진화 완료 단계가 다르면 현재 단계를 직접 맞춰 주세요. 기존 목표와 같은 캐릭터를 저장하면 목표를 변경합니다.</p><button type="submit" class="primary-button">목표 저장</button></form></details>
  <div class="growth-goals">${result.goals.length?result.goals.map(g=>{const unit=names.get(g.id+'-'+g.targetForm)||catalog.find(c=>c.id===g.id);return `<article class="growth-goal"><img src="${esc(unit?.image||'assets/u/0/0.png')}" alt="" width="70" height="54"><div><strong>${esc(unit?.name||'#'+g.id)}</strong><p>Lv. ${g.current.level} → ${g.targetLevel} · ${g.current.form+1}진화 → ${g.targetForm+1}진화</p><small>${g.fromProfile?'현재 레벨: 계정 정보':'현재 상태: 계획에 직접 입력'} · ${g.done?'목표 도달':'육성 중'}</small>${g.notes.map(n=>'<p class="growth-limit">'+esc(n)+'</p>').join('')}</div><div class="growth-goal-actions"><button type="button" class="text-button" data-growth="edit" data-id="${g.id}">변경</button><button type="button" class="text-button" data-growth="remove" data-id="${g.id}">제거</button></div></article>`;}).join(''):'<p class="growth-empty">먼저 육성할 캐릭터와 목표를 추가해 주세요.</p>'}</div>
  <h3>확인된 비용 합계와 부족분</h3><p class="growth-note">여러 목표가 같은 재료를 사용하면 합산한 뒤 보유량을 한 번만 적용합니다. ${result.complete?'':'아래 합계는 미확인 비용을 제외한 부분 합계입니다.'} 기본 레벨 50 이후 XP·캣츠아이·본능 비용·게임 내 해방 조건은 미산정입니다. 진화 조건과 실제 한국판 비용은 게임에서도 확인해 주세요.</p>
  ${result.materials.length?'<div class="growth-table-wrap"><table class="growth-table"><thead><tr><th>재료</th><th>필요</th><th>보유</th><th>부족</th></tr></thead><tbody>'+result.materials.map(m=>'<tr><th scope="row">'+esc(data.materials.find(x=>x.id===m.id)?.name||m.id)+'</th><td>'+fmt(m.required)+'</td><td>'+fmt(m.owned)+'</td><td class="'+(m.missing?'growth-short':'')+'">'+fmt(m.missing)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="growth-note">계산할 비용이 없거나 목표를 이미 달성했습니다. 미확인 비용 안내도 확인해 주세요.</p>'}
  <details class="growth-stock"><summary>보유 재료 직접 입력</summary><form id="growth-stock-form"><div class="growth-stock-grid">${data.materials.map(m=>'<label>'+esc(m.name)+'<input name="'+m.id+'" type="number" min="0" max="1000000000000" step="1" required value="'+(plan.stock[m.id]||0)+'"></label>').join('')}</div><button class="primary-button" type="submit">보유 재료 저장</button></form></details>
  <div class="growth-title"><h3>오늘 할 활동 · 한국판 ${kstDay()}</h3><button type="button" class="text-button" data-growth="refresh">일정 새로고침</button></div><p class="growth-note">${!snapshot?'일정을 불러오지 못했습니다.':(isStale(snapshot.collectedAt)||snapshot.collectionErrors?.length?'일정 갱신 지연 · 현재 개최 여부를 재확인해 주세요.':'공식 공지 수집: '+new Date(snapshot.collectedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))} 전체 인게임 일정은 포함하지 않습니다. ‘오늘 개최일’은 정확한 현재 개방 시각을 뜻하지 않습니다.</p>
  <div class="growth-activities">${result.materials.filter(m=>m.missing>0).map(m=>activities(m)).join('')||'<p class="growth-empty">확인된 비용에 부족한 재료가 없습니다. 목표를 추가하거나 미확인 비용을 확인해 주세요.</p>'}</div>
  <details class="growth-source"><summary>자료 출처와 계산 범위</summary><p>진화 재료·XP: 도감과 동일한 JP/TW 커뮤니티 데이터, 고정 커밋 ${esc(data.source.commit.slice(0,10))}. 한국판 차이가 있을 수 있습니다.</p><p>획득처는 PONOS 한국판 공식 스테이지의 보상 문구를 연결합니다. 확률·필요 반복 횟수·개인 입장 자격은 추정하지 않습니다. 1회 보상은 이미 수령했다면 다시 받을 수 없습니다.</p><p>일정 연결은 공식 공지를 대조한 종말의 배틀 그라운드·풍운 냥코탑에 우선 적용했습니다. 다른 맵은 개방 미확인으로 표시합니다.</p><a href="${esc(data.source.repository+'/tree/'+data.source.commit)}" target="_blank" rel="noopener noreferrer">수치 자료 원본 ↗</a></details></section>`;
  const form=view.querySelector('#growth-goal-form');
  function choices(query=''){
   const list=catalog.filter(c=>c.form===0&&(!query||[c.name,c.nameJP,c.nameEN,String(c.id)].some(s=>s?.toLowerCase().includes(query.toLowerCase()))));
   const selected=form.elements.id.value;form.elements.id.innerHTML=list.map(c=>'<option value="'+c.id+'">#'+c.id+' '+esc(c.name)+'</option>').join('');if(list.some(c=>String(c.id)===selected))form.elements.id.value=selected;fill();
  }
  function fill(existing){
   const id=Number(form.elements.id.value),unit=data.units.find(u=>u.id===id);if(!unit||form.elements.id.value===''){form.querySelector('[type=submit]').disabled=true;view.querySelector('#growth-profile-hint').textContent='검색 결과가 없습니다.';return;}
   form.querySelector('[type=submit]').disabled=false;
   const actual=getSaved()?.cats?.find(c=>c.id===id),g=existing||plan.goals.find(g=>g.id===id),currentLevel=actual?.level||g?.currentLevel||1,currentForm=Math.max(actual?.form||0,g?.currentForm||0);
   for(const name of ['currentForm','targetForm'])form.elements[name].innerHTML=Array.from({length:unit.forms},(_,n)=>'<option value="'+n+'">'+(n+1)+'진화</option>').join('');
   form.elements.currentLevel.value=currentLevel;form.elements.currentLevel.max=unit.maxBaseLevel;form.elements.currentLevel.readOnly=!!actual;
   form.elements.currentForm.value=currentForm;form.elements.targetLevel.value=g?.targetLevel??Math.max(currentLevel,Math.min(30,unit.maxBaseLevel));form.elements.targetLevel.max=unit.maxBaseLevel;form.elements.targetForm.value=g?.targetForm??currentForm;
   view.querySelector('#growth-profile-hint').textContent=actual?'보유 캐릭터 · 저장된 기본 레벨과 선택 형태를 불러왔습니다. 본능 기록은 유지되며 이 계획은 계정 데이터를 변경하지 않습니다.':'계정 보유 정보 없음 · 현재 상태를 직접 입력해 계획할 수 있습니다.';
  }
  choices();form.elements.id.addEventListener('change',()=>fill());view.querySelector('#growth-search').addEventListener('input',e=>choices(e.target.value));
  form.addEventListener('submit',e=>{e.preventDefault();try{const g=validGoal(Object.fromEntries(new FormData(form)),data),goals=plan.goals.filter(x=>x.id!==g.id);if(goals.length>=MAX_GOALS)throw Error('목표는 최대 '+MAX_GOALS+'개까지 저장할 수 있습니다.');save({...plan,goals:[...goals,g]});message='육성 목표를 저장했습니다.';paint();}catch(e){error(e);}});
  view.querySelector('#growth-stock-form').addEventListener('submit',e=>{e.preventDefault();try{const stock=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,whole(v,0,1e12,'보유량')]));save({...plan,stock});message='보유 재료를 저장했습니다.';paint();}catch(e){error(e);}});
  view.querySelectorAll('[data-growth]').forEach(button=>button.addEventListener('click',()=>{try{const action=button.dataset.growth,id=Number(button.dataset.id);if(action==='remove'){save({...plan,goals:plan.goals.filter(g=>g.id!==id)});message='목표를 제거했습니다. 보유 재료는 유지합니다.';paint();}if(action==='edit'){view.querySelector('.growth-add').open=true;view.querySelector('#growth-search').value='';choices();form.elements.id.value=id;fill(plan.goals.find(g=>g.id===id));form.scrollIntoView({block:'center'});}if(action==='refresh')render(view);}catch(e){error(e);}}));
 }
 function activities(m){
  const candidates=activityCandidates(m.id,data,snapshot),today=candidates.filter(c=>['ongoing','day'].includes(c.availability.code)).length,name=data.materials.find(x=>x.id===m.id)?.name||m.id;
  return '<section class="growth-resource"><h4>'+esc(name)+' · '+fmt(m.missing)+' 부족</h4><p class="growth-note">'+(today?'공식 공지 기준 오늘 기간·개최일에 해당하는 후보 '+today+'개. 실제 입장 조건과 시각은 게임에서 확인해 주세요.':'현재 공지에서 오늘 개최를 확인한 획득처가 없습니다. 아래는 다른 일정 또는 개방 미확인인 후보입니다.')+'</p>'+(candidates.length?'<p class="growth-note">공식 보상에 명시된 획득처 '+candidates.length+'개 · 일정 상태순, 같은 상태는 표시 통솔력순. 최대 5개 표시. 드롭 효율 순위가 아닙니다.</p><details open><summary>획득처 보기</summary>'+candidates.slice(0,5).map(d=>'<article class="growth-destination"><span class="growth-status '+d.availability.code+'">'+esc(d.availability.label)+'</span><strong>'+esc(d.mapName)+' / '+esc(d.stageName)+'</strong><p>'+esc(d.rewardText)+'</p><small>통솔력 '+esc(d.energy??'미확인')+' · 보상 자료 확인 '+esc(d.verifiedAt.slice(0,10))+'</small><div><a href="'+esc(safeSource(d.sourceUrl))+'" target="_blank" rel="noopener noreferrer">공식 스테이지 ↗</a>'+(d.availability.notice?'<a href="'+esc(safeSource(d.availability.notice.sourceUrl))+'" target="_blank" rel="noopener noreferrer">일정 근거 공지 ↗</a>':'')+'</div></article>').join('')+'</details>':'<p>공식 한국판 보상 자료에서 연결된 획득처를 확인하지 못했습니다. 게임에서 획득 방법을 확인해 주세요.</p>')+'</section>';
 }
 return {render,reset(){ticket++;key=null;plan=empty();view=null;message='';persistError='';}};
}
