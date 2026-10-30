import {initProfile,updateProfileCatalog} from './profile.mjs?v=simple-1';
import {initCommunity,renderCharacterCommunity} from './community.mjs?v=simple-1';
import {characterKey} from './community-model.mjs?v=google-only-1';
import {initStages} from './stage-guide.mjs?v=simple-1';
import {initHome} from './home.mjs?v=simple-1';
import {calculate,statsAt,searchUnits,TRAITS,RARITIES,ABILITIES} from './engine.mjs';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{maximumFractionDigits:d}):'불가';
let cats=[],enemies=[],meta={},detail=null,pickerKind='enemy';
let state={cat:'25-2',enemy:'24',level:30,mag:100,treasure:'max',traitTreasure:true,proc:'normal'};
const catalog={kind:'cats',query:'',trait:0,rarity:'all',page:1};
const picker={query:'',trait:0,rarity:'all',page:1};
const PAGE_SIZE=48,PICKER_SIZE=30;
function tags(u,mode='enemy') {
  const t=TRAITS.filter(([bit])=>u.trait&bit);
  if(mode==='cat'&&!t.length)return `<span class="tag">${esc(RARITIES[u.rarity])}</span>`;
  return t.map(([,name,color])=>`<span class="tag ${color}">${esc(name)}</span>`).join('') || '<span class="tag">기타</span>';
}
function image(u,extra='') { return `<img src="${esc(u.image)}" alt="${esc(u.name)}" loading="lazy" ${extra}>`; }
function storageSave(){try{localStorage.setItem('battle-cats-lab-v1',JSON.stringify(state));}catch{/* Browser storage can be disabled. */}}
function readState(){
  try{const s=JSON.parse(localStorage.getItem('battle-cats-lab-v1'));if(s&&typeof s==='object')for(const k of Object.keys(state))if(k in s)state[k]=s[k];}catch{}
  const p=new URLSearchParams(location.search);
  for(const k of ['cat','enemy','level','mag','treasure','proc'])if(p.has(k))state[k]=p.get(k);
  if(p.has('traitTreasure'))state.traitTreasure=p.get('traitTreasure')==='true';
  if(!cats.some(c=>c.key===state.cat))state.cat='25-2';
  if(!enemies.some(e=>e.key===state.enemy))state.enemy='24';
  const c=cats.find(c=>c.key===state.cat);
  state.level=Number(state.level);state.mag=Number(state.mag);
  if(!Number.isInteger(state.level)||state.level<1||state.level>c.maxLevel)state.level=Math.min(30,c.maxLevel);
  if(!Number.isFinite(state.mag)||state.mag<=0||state.mag>1e6)state.mag=100;
  if(!['max','none'].includes(state.treasure))state.treasure='max';
  if(!['normal','triggered'].includes(state.proc))state.proc='normal';
  state.traitTreasure=Boolean(state.traitTreasure);
}
function currentUnits(){return {cat:cats.find(c=>c.key===state.cat),enemy:enemies.find(e=>e.key===state.enemy)};}
function syncInputs(){
  const {cat}=currentUnits();
  $('#cat-level').value=state.level;$('#cat-level').max=cat.maxLevel;
  $('#enemy-mag').value=state.mag;$('#treasure').value=state.treasure;
  $('#trait-treasure').checked=state.traitTreasure;$('#proc-mode').value=state.proc;
  $('#level-limit').textContent=`최대 Lv. ${cat.maxLevel}`;
  $('#level-presets').innerHTML=[1,20,30,40,50,60].filter(v=>v<=cat.maxLevel).map(v=>`<button data-level="${v}" class="${v===state.level?'selected':''}">${v}</button>`).join('');
  $('#mag-presets').innerHTML=[100,200,500,1000].map(v=>`<button data-mag="${v}" class="${v===state.mag?'selected':''}">${v}%</button>`).join('');
}
function selectedUnits(){
  const {cat,enemy}=currentUnits();
  for(const [kind,u]of [['cat',cat],['enemy',enemy]]){
    const target=$(`#selected-${kind}`);target.classList.toggle('enemy-image',kind==='enemy');
    target.innerHTML=`${image(u,'class="portrait"')}<div><span class="unit-id">#${u.id}${kind==='cat'?` · ${u.form+1}진화`:''}</span><button class="selected-detail" data-detail="${u.key}" data-kind="${kind}" aria-label="${esc(u.name)} 상세 정보"><h3>${esc(u.name)}</h3></button><div class="tag-list">${tags(u,kind)}</div></div>`;
  }
}
function inputOptions(){
  const level=$('#cat-level').value,mag=$('#enemy-mag').value;
  if(level===''||mag==='')throw new Error('레벨과 배율을 모두 입력해 주세요.');
  return {level:Number(level),magnification:Number(mag),treasure:$('#treasure').value==='max',traitTreasures:$('#trait-treasure').checked,critical:$('#proc-mode').value==='triggered',curves:meta.levelCurves};
}
function updateCalculation(){
  try{
    const {cat,enemy}=currentUnits(),options=inputOptions(),r=calculate(cat,enemy,options);
    Object.assign(state,{level:options.level,mag:options.magnification,treasure:options.treasure?'max':'none',traitTreasure:options.traitTreasures,proc:options.critical?'triggered':'normal'});
    storageSave();$('#input-error').hidden=true;$('#results').hidden=false;
    const range=r.rangeDifference,rangeText=range>0?'아군이 더 길어요':range<0?'적군이 더 길어요':'인식 사거리가 같아요';
    const kills=Number.isFinite(r.kill.hits)?fmt(r.kill.hits):'처치 불가',deaths=Number.isFinite(r.death.hits)?fmt(r.death.hits):'피해 없음';
    $('#results').innerHTML=`<div class="result-panel"><div class="result-header"><h2>전투 계산 결과</h2><span class="condition-pill">${r.bodyOnly?'실드·배리어 제거 후 본체 기준':options.critical?'확률 효과 발동 조건':'직접 공격 기준'}</span></div><div class="metrics"><div class="metric"><div class="metric-label">적군을 처치하려면</div><div class="metric-value" data-testid="kill-hits">${kills}${Number.isFinite(r.kill.hits)?'<span class="unit">타격</span>':''}</div><p class="metric-note">${Number.isFinite(r.kill.rounds)?`공격 동작 ${fmt(r.kill.rounds)}회 · 본체 체력 0 기준`:'공격 대상·피해량을 확인해 주세요'}</p></div><div class="metric"><div class="metric-label">아군이 쓰러지는 순간</div><div class="metric-value" data-testid="death-hits">${deaths}${Number.isFinite(r.death.hits)?'<span class="unit">피격째</span>':''}</div><p class="metric-note">${Number.isFinite(r.death.hits)?`${fmt(Math.max(0,r.death.hits-1))}타격까지 생존 · 적 공격 ${fmt(r.death.rounds)}회째`:'선택한 적은 직접 공격 피해가 없어요'}</p></div><div class="metric"><div class="metric-label">인식 사거리 차이</div><div class="metric-value" data-testid="range-difference">${range>0?'+':''}${fmt(range)}<span class="unit">거리</span></div><p class="metric-note">${rangeText} · ${cat.range} vs ${enemy.range}</p></div></div><div class="result-bottom"><span>${esc(cat.name)} Lv.${state.level} vs ${esc(enemy.name)} ${fmt(state.mag,2)}%<br>모든 직접 타격이 명중하는 조건입니다.</span><button class="share-button" id="share-result">이 조건 링크 복사 ↗</button></div></div>`;
    const attackString=(arr)=>arr.map(v=>fmt(v)).join(' + ');
    $('#stat-comparison').innerHTML=`<table class="compare-table"><thead><tr><th>기준</th><th>아군 Lv.${state.level}</th><th>적군 ${fmt(state.mag,2)}%</th></tr></thead><tbody><tr><td>체력</td><td>${fmt(r.ally.hp)}</td><td>${fmt(r.foe.hp)}</td></tr><tr><td>직접 공격 피해 / 1회</td><td>${attackString(r.outgoing)}</td><td>${attackString(r.incoming)}</td></tr><tr><td>기본 DPS</td><td>${fmt(r.ally.dps,1)}</td><td>${fmt(r.foe.dps,1)}</td></tr><tr><td>공격 주기</td><td>${fmt(cat.attackF/30,2)}초</td><td>${fmt(enemy.attackF/30,2)}초</td></tr><tr><td>넉백 횟수</td><td>${fmt(cat.kb)}</td><td>${fmt(enemy.kb)}</td></tr></tbody></table>`;
    const max=Math.max(cat.range,enemy.range,1),axis=Math.ceil(max/100)*100||100;
    $('#range-chart').innerHTML=`<div class="range-row"><div class="range-row-header"><span>아군 · ${esc(cat.name)}</span><b>${cat.range}</b></div><div class="range-track"><span style="width:${Math.max(0,cat.range/axis*100)}%"></span></div></div><div class="range-row enemy"><div class="range-row-header"><span>적군 · ${esc(enemy.name)}</span><b>${enemy.range}</b></div><div class="range-track"><span style="width:${Math.max(0,enemy.range/axis*100)}%"></span></div></div><div class="range-axis"><span>0</span><span>${axis/2}</span><span>${axis}</span></div>`;
    $('#conditions').innerHTML=`<p>세계편 보물: ${options.treasure?'최대 ×2.5':'없음 ×1'} · 속성 보물: ${options.traitTreasures?'최대':'없음'} · 아군 속성 공격 보정: ×${fmt(r.attackFactor,2)} · 피격 보정: ×${fmt(r.defenseFactor,3)}</p>${r.notes.length?`<ul class="condition-list">${r.notes.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}`;
    for(const b of document.querySelectorAll('[data-level]'))b.classList.toggle('selected',Number(b.dataset.level)===state.level);
    for(const b of document.querySelectorAll('[data-mag]'))b.classList.toggle('selected',Number(b.dataset.mag)===state.mag);
  }catch(error){
    $('#input-error').textContent=error.message;$('#input-error').hidden=false;
    // Never leave old results visible under invalid new conditions.
    $('#results').hidden=true;$('#stat-comparison').innerHTML='';$('#range-chart').innerHTML='';$('#conditions').innerHTML='';
  }
}
function unitCard(u,kind,action='detail'){
  const selected=kind==='cat'?u.key===state.cat:u.key===state.enemy;
  return `<button class="unit-card ${kind==='enemy'?'enemy-card':''} ${action==='pick'&&selected?'is-selected':''}" data-${action}="${esc(u.key)}" data-kind="${kind}" aria-label="${esc(u.name)} ${action==='pick'?'선택':'상세 정보'}"><div class="card-image">${image(u)}</div><span class="unit-id">NO. ${String(u.id).padStart(3,'0')}${kind==='cat'?` · ${u.form+1}형태`:''}</span><span class="card-name">${esc(u.name)}</span><div class="card-foot"><div class="tag-list">${tags(u,kind)}</div>${!u.koreanName?'<div class="card-sub">한국어 이름 미등록</div>':''}</div></button>`;
}
function filters(context,kind){
  const model=context==='picker'?picker:catalog;
  return [[0,'전체',''],...TRAITS].map(([bit,name,color])=>`<button class="filter-button ${Number(model.trait)===bit?'active':''}" aria-pressed="${Number(model.trait)===bit}" data-filter="${bit}" data-context="${context}">${esc(name)}</button>`).join('');
}
function pagination(target,current,total,context){
  $(target).innerHTML=total>0?`<button data-page="${current-1}" data-context="${context}" ${current<=1?'disabled':''}>← 이전</button><span>${current} / ${total} 페이지</span><button data-page="${current+1}" data-context="${context}" ${current>=total?'disabled':''}>다음 →</button>`:'';
}
function renderCatalog(){
  const kind=catalog.kind==='cats'?'cat':'enemy',units=kind==='cat'?cats:enemies;
  const filtered=searchUnits(units,catalog.query,catalog.trait,kind==='cat'?catalog.rarity:'all');
  const pages=Math.ceil(filtered.length/PAGE_SIZE);catalog.page=Math.max(1,Math.min(catalog.page,pages||1));
  $('#catalog-title').textContent=kind==='cat'?'아군 도감':'적군 도감';
  $('#catalog-description').textContent=kind==='cat'?`${meta.catCount}종 · ${meta.formCount.toLocaleString()}개 진화 형태`:`${meta.enemyCount}종`;
  $('#rarity-wrap').hidden=kind==='enemy';
  $('#catalog-filters').innerHTML=filters('catalog',kind);
  $('#catalog-filters').setAttribute('aria-label',kind==='cat'?'공격 대상 속성 필터':'적 속성 필터');
  $('#catalog-count').textContent=`총 ${fmt(filtered.length)}${kind==='cat'?'개 형태':'종'}${catalog.trait?' · 속성 필터 적용':''}`;
  $('#catalog-grid').innerHTML=filtered.length?filtered.slice((catalog.page-1)*PAGE_SIZE,catalog.page*PAGE_SIZE).map(u=>unitCard(u,kind)).join(''):'<p class="empty">검색 결과가 없어요. 다른 이름이나 속성을 선택해 보세요.</p>';
  pagination('#catalog-pagination',catalog.page,pages,'catalog');
}
function renderPicker(){
  const units=pickerKind==='cat'?cats:enemies;
  const filtered=searchUnits(units,picker.query,picker.trait,pickerKind==='cat'?picker.rarity:'all');
  const pages=Math.ceil(filtered.length/PICKER_SIZE);picker.page=Math.max(1,Math.min(picker.page,pages||1));
  $('#picker-filters').innerHTML=filters('picker',pickerKind);
  $('#picker-count').textContent=`${fmt(filtered.length)}${pickerKind==='cat'?'개 형태':'종'} · 이미지와 이름을 확인하고 선택하세요${pickerKind==='cat'?' · 속성은 공격 대상 기준':''}`;
  $('#picker-grid').innerHTML=filtered.length?filtered.slice((picker.page-1)*PICKER_SIZE,picker.page*PICKER_SIZE).map(u=>unitCard(u,pickerKind,'pick')).join(''):'<p class="empty">일치하는 캐릭터가 없어요. 검색어·필터를 바꿔 보세요.</p>';
  pagination('#picker-pagination',picker.page,pages,'picker');
}
function openPicker(kind){
  pickerKind=kind;Object.assign(picker,{query:'',trait:0,rarity:'all',page:1});
  $('#picker-title').textContent=kind==='cat'?'아군 캐릭터 선택':'적군 캐릭터 선택';
  $('#picker-search').value='';$('#picker-rarity').value='all';$('#picker-rarity').hidden=kind==='enemy';
  renderPicker();$('#picker-dialog').showModal();$('#picker-search').focus();
}
function pick(key,kind){
  if(kind==='cat'){
    const u=cats.find(u=>u.key===key);if(!u)return;
    state.cat=key;state.level=Math.min(state.level,u.maxLevel);
  }else{if(!enemies.some(u=>u.key===key))return;state.enemy=key;}
  selectedUnits();syncInputs();updateCalculation();
  if($('#picker-dialog').open)$('#picker-dialog').close();
}
function attackType(u){return `${u.atkType&2?'범위':'단일'} 공격${u.atkType&4?' · 원거리':u.atkType&8?' · 전방위':''}`;}
function abilityText(id,value){
  let suffix='';
  if([4,7,8].includes(Number(id)))suffix=` ${scalar(value)}%`;
  else if(Number(id)===9&&Array.isArray(value))suffix=` ${value[0]}% 확률 / 피해 +${value[1]}%`;
  else if([38,39].includes(Number(id)))suffix=` ${fmt(scalar(value))}`;
  return (ABILITIES[id]||`능력 #${id}`)+suffix;
}
function scalar(v){return Array.isArray(v)?v[0]:v;}
function renderDetail(){
  const {u,kind}=detail,unitStat=statsAt(u,{level:detail.value,magnification:detail.value,treasure:state.treasure==='max',curves:meta.levelCurves});
  const forms=kind==='cat'?cats.filter(c=>c.id===u.id):[];
  const ranges=u.longStart.map((start,i)=>`${start} ~ ${start+(u.longLength[i]||0)}`);
  $('#detail-content').innerHTML=`<div class="detail-hero">${image(u)}<div><span class="unit-id">#${u.id}</span><h2 id="detail-title">${esc(u.name)}</h2><div class="tag-list">${tags(u,kind)}</div><p class="detail-names">${esc(u.nameJP)}${u.nameEN?` / ${esc(u.nameEN)}`:''}</p></div></div>${forms.length?`<div class="detail-form-options" aria-label="진화 형태">${forms.map(f=>`<button data-form="${f.key}" class="${f.key===u.key?'selected':''}">${f.form+1}형태</button>`).join('')}</div>`:''}<div class="detail-options"><label for="detail-value">${kind==='cat'?'총 레벨':'적 배율 (%)'}</label><input id="detail-value" type="number" min="${kind==='cat'?1:.01}" max="${kind==='cat'?u.maxLevel:1000000}" step="${kind==='cat'?1:'any'}" value="${detail.value}" inputmode="decimal"><span>${kind==='cat'?`최대 ${u.maxLevel} · 세계편 보물 ${state.treasure==='max'?'최대':'없음'}`:'100% = 기본 능력치'}</span></div><p id="detail-error" role="alert" class="error-message" hidden></p><dl class="detail-stats"><div class="detail-stat"><dt>체력</dt><dd>${fmt(unitStat.hp)}</dd></div><div class="detail-stat"><dt>공격력 합계</dt><dd>${fmt(unitStat.attack)}</dd></div><div class="detail-stat"><dt>기본 DPS</dt><dd>${fmt(unitStat.dps,1)}</dd></div><div class="detail-stat"><dt>인식 사거리</dt><dd>${u.range}</dd></div><div class="detail-stat"><dt>이동 속도</dt><dd>${u.speed}</dd></div><div class="detail-stat"><dt>넉백 횟수</dt><dd>${u.kb}</dd></div></dl><h3>공격 정보</h3><p class="detail-text" id="detail-attack-info">${attackType(u)} · 공격 주기 ${fmt(u.attackF/30,2)}초 (${u.attackF}F)<br>타격별 공격력: ${unitStat.active.map(i=>fmt(unitStat.attacks[i])).join(' + ')||'직접 공격 없음'}<br>공격 발생: ${unitStat.active.map(i=>`${fmt(u.preswings[i]/30,2)}초`).join(' / ')||'없음'}${ranges.length?`<br>타격 범위: ${ranges.join(' / ')} (인식 위치 기준)` : ''}</p><h3>${kind==='cat'?'공격 대상 속성':'적 속성'}</h3><div class="tag-list">${tags(u,'enemy')}</div><h3>특수능력</h3><div class="abilities">${Object.keys(u.abilities).length?Object.entries(u.abilities).map(([id,v])=>`<span class="ability-chip">${esc(abilityText(id,v))}</span>`).join(''):'<span class="detail-text">별도 특수능력 없음</span>'}</div><p class="source-note">데이터: battlecatsinfo · JP ${meta.japanVersion}<br>${!u.koreanName?'한국어 이름이 없어 원본 이름으로 표시합니다. ':''}상세 능력치는 본능·냥콤보 및 상대별 특수효과를 적용하기 전입니다.<br>캐릭터 아트 © PONOS Corp. 및 각 권리자</p><button class="primary-button" data-apply-detail="true">이 캐릭터로 계산하기 <span aria-hidden="true">→</span></button><section id="character-community"></section>`;
  renderCharacterCommunity(characterKey(kind,u.key),$("#character-community"));
}
function openDetail(key,kind){
  const u=(kind==='cat'?cats:enemies).find(u=>u.key===key);if(!u)return;
  detail={u,kind,value:kind==='cat'?Math.min(state.level,u.maxLevel):state.mag};renderDetail();$('#detail-dialog').showModal();
}
function setView(view,updateHash=true){
  if(!['home','stages','calculator','cats','enemies','about','community','profile'].includes(view))view='home';
  $('#profile-view').hidden=view!=='profile';$('#community-view').hidden=view!=='community';$('#home-view').hidden=view!=='home';$('#stages-view').hidden=view!=='stages';
  $('#calculator-view').hidden=view!=='calculator';$('#catalog-view').hidden=!['cats','enemies'].includes(view);$('#about-view').hidden=view!=='about';
  for(const button of document.querySelectorAll('.nav-button')){button.classList.toggle('active',button.dataset.view===view);if(button.dataset.view===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
  if(view==='cats'||view==='enemies'){
    if(catalog.kind!==view){catalog.kind=view;Object.assign(catalog,{query:'',trait:0,rarity:'all',page:1});$('#catalog-search').value='';$('#catalog-rarity').value='all';}
    renderCatalog();
  }
  document.title=`${{home:'이벤트 일정',stages:'스테이지 정보',calculator:'전투 계산기',cats:'아군 도감',enemies:'적군 도감',about:'데이터 안내',community:'게시판',profile:'내 정보'}[view]} · 냥코 작전 사령부`;
  if(updateHash&&location.hash!==`#${view}`)history.replaceState(null,'',`#${view}`);
}
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,2500);}
async function share(){
  const url=new URL(location.href);url.search='';for(const[k,v]of Object.entries(state))url.searchParams.set(k,String(v));url.hash='calculator';
  try{await navigator.clipboard.writeText(url.href);toast('계산 조건 링크를 복사했어요.');}catch{toast('이 브라우저에서는 링크를 복사할 수 없어요.');}
}
function wire(){
  $('#choose-cat').addEventListener('click',()=>openPicker('cat'));$('#choose-enemy').addEventListener('click',()=>openPicker('enemy'));
  for(const id of ['cat-level','enemy-mag','treasure','trait-treasure','proc-mode'])$("#"+id).addEventListener('input',updateCalculation);
  $('#calculate').addEventListener('click',updateCalculation);
  $('#catalog-search').addEventListener('input',e=>{catalog.query=e.target.value;catalog.page=1;renderCatalog();});
  $('#picker-search').addEventListener('input',e=>{picker.query=e.target.value;picker.page=1;renderPicker();});
  $('#catalog-rarity').addEventListener('change',e=>{catalog.rarity=e.target.value;catalog.page=1;renderCatalog();});
  $('#picker-rarity').addEventListener('change',e=>{picker.rarity=e.target.value;picker.page=1;renderPicker();});
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.view){setView(b.dataset.view);window.scrollTo({top:0,behavior:'instant'});}
    if(b.dataset.close)$('#'+b.dataset.close).close();
    if(b.dataset.filter!==undefined){const model=b.dataset.context==='picker'?picker:catalog;model.trait=Number(b.dataset.filter);model.page=1;b.dataset.context==='picker'?renderPicker():renderCatalog();}
    if(b.dataset.page){const model=b.dataset.context==='picker'?picker:catalog;model.page=Number(b.dataset.page);if(b.dataset.context==='picker'){renderPicker();$('#picker-dialog').scrollTop=0;}else{renderCatalog();$('#catalog-grid').scrollIntoView({block:'start',behavior:'instant'});}}
    if(b.dataset.pick!==undefined)pick(b.dataset.pick,b.dataset.kind);
    if(b.dataset.detail!==undefined)openDetail(b.dataset.detail,b.dataset.kind);
    if(b.dataset.level){$('#cat-level').value=b.dataset.level;updateCalculation();}
    if(b.dataset.mag){$('#enemy-mag').value=b.dataset.mag;updateCalculation();}
    if(b.dataset.step){const [,delta]=b.dataset.step.split(':');const input=$('#cat-level');input.value=Math.max(1,Math.min(Number(input.max),Number(input.value)+Number(delta)));updateCalculation();}
    if(b.dataset.form){const u=cats.find(c=>c.key===b.dataset.form);detail.u=u;detail.value=Math.min(detail.value,u.maxLevel);renderDetail();}
    if(b.dataset.applyDetail){if(!$('#detail-error').hidden)return;const {u,kind,value}=detail;if(kind==='cat')state.level=value;else state.mag=value;pick(u.key,kind);$('#detail-dialog').close();setView('calculator');window.scrollTo({top:0,behavior:'instant'});}
    if(b.id==='share-result')share();
  });
  $('#detail-content').addEventListener('input',e=>{
    if(e.target.id!=='detail-value')return;
    try{
      if(e.target.value==='')throw new Error('레벨 또는 배율을 입력해 주세요.');
      const value=Number(e.target.value);statsAt(detail.u,{level:value,magnification:value,treasure:state.treasure==='max',curves:meta.levelCurves});
      detail.value=value;
      const st=statsAt(detail.u,{level:value,magnification:value,treasure:state.treasure==='max',curves:meta.levelCurves});
      const values=[fmt(st.hp),fmt(st.attack),fmt(st.dps,1),detail.u.range,detail.u.speed,detail.u.kb];
      document.querySelectorAll('.detail-stat dd').forEach((el,i)=>el.textContent=values[i]);
      const info=$('#detail-attack-info');
      const ranges=detail.u.longStart.map((start,i)=>`${start} ~ ${start+(detail.u.longLength[i]||0)}`);
      info.innerHTML=`${attackType(detail.u)} · 공격 주기 ${fmt(detail.u.attackF/30,2)}초 (${detail.u.attackF}F)<br>타격별 공격력: ${st.active.map(i=>fmt(st.attacks[i])).join(' + ')||'직접 공격 없음'}<br>공격 발생: ${st.active.map(i=>`${fmt(detail.u.preswings[i]/30,2)}초`).join(' / ')||'없음'}${ranges.length?`<br>타격 범위: ${ranges.join(' / ')} (인식 위치 기준)`:''}`;
      $('#detail-error').hidden=true;
    }catch(error){$('#detail-error').textContent=error.message;$('#detail-error').hidden=false;}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='/'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){
      if(!$('#catalog-view').hidden){e.preventDefault();$('#catalog-search').focus();}
    }
  });
  document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){const image=e.target;const text=document.createElement('span');text.className='image-unavailable';text.textContent='이미지 없음';image.replaceWith(text);}},true);
  for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  window.addEventListener('hashchange',()=>setView(location.hash.slice(1),false));
}
async function init(){
  try{
    const responses=await Promise.all(['cats','enemies','meta'].map(n=>fetch(`data/${n}.json`)));
    for(const r of responses)if(!r.ok)throw new Error(`데이터 요청 실패 (${r.status})`);
    [cats,enemies,meta]=await Promise.all(responses.map(r=>r.json()));
    updateProfileCatalog(cats,enemies);
    readState();wire();selectedUnits();syncInputs();updateCalculation();
    for(const select of [$('#catalog-rarity'),$('#picker-rarity')])select.innerHTML='<option value="all">전체 희귀도</option>'+RARITIES.map((r,i)=>`<option value="${i}">${r}</option>`).join('');
    $('#footer-version').textContent=`JP ${meta.japanVersion} · 아군 ${meta.catCount}종 / 적군 ${meta.enemyCount}종 · 한국판과 차이가 있을 수 있습니다.`;
    $('#data-meta').innerHTML=`<dl><dt>아군</dt><dd>${meta.catCount}종 · ${fmt(meta.formCount)}개 진화 형태</dd><dt>적군</dt><dd>${meta.enemyCount}종</dd><dt>기준 버전</dt><dd>일본판 ${meta.japanVersion} / 대만판 ${meta.taiwanVersion}</dd><dt>수집일</dt><dd>${new Date(meta.importedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}</dd><dt>데이터 커밋</dt><dd>${esc(meta.commit.slice(0,12))}</dd></dl>`;
    setView(location.hash.slice(1)||'home',false);$('#loading').hidden=true;
  }catch(error){$('#loading').textContent=`데이터를 불러오지 못했어요. 연결 상태를 확인한 뒤 새로고침해 주세요. (${error.message})`;$('#loading').classList.add('error');console.error(error);}
}
initProfile();
initCommunity();
initHome();
initStages();
init();
