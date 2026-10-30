import {publicNoticeURL} from './notice-links.mjs';
import {effectiveMagnification,wikiComparison} from './stage-battles.mjs';
import {CATEGORIES,SPECIALS,FAMILY_NAMES,familyOf,categoryOf,specialOf,filterMaps,schedulesFor,hydrateStageGroup} from './stages.mjs';
import {eventStatus,isStale} from './events.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
let data,events={events:[]},state={category:'all',special:'all',query:'',map:'V000',stage:0,koreanOnly:true,page:1,crown:0};
const fullMaps=new Map(),pendingGroups=new Map(),battleMaps=new Map();
let enemyCatalog=new Map(),wikiChecks={stages:[]},battleAudit;
const MAP_PAGE_SIZE=36;
const label=(list,key)=>list.find(([id])=>id===key)?.[1]||'미분류';
function officialLink(url,text){return `<a href="${esc(publicNoticeURL(url))}" target="_blank" rel="noopener noreferrer">${text} ↗</a>`;}
function renderSchedules(map){
  const matched=schedulesFor(map,events.events);
  return `<section class="stage-schedule"><div class="stage-section-heading"><h3>열리는 날짜</h3><span>맵 전체 개최 일정 · KST</span></div>${matched.length?matched.map(e=>{
    const status=eventStatus(e),labels={ongoing:'진행 중',upcoming:'예정',ended:'종료',recurring:'반복 개최일'};
    return `<div class="stage-period"><span class="event-status ${status}">${labels[status]||'공식 공지'}</span><strong>${esc(e.period?`${date(e.period.startAt)} ~ ${date(e.period.announcedEndAt)}`:e.recurrence.label)}</strong>${officialLink(e.sourceUrl,'공식 일정 공지')}</div>`;
  }).join(''):'<p class="stage-unknown">공식 개최일 미확인</p><p class="field-help">공식 공지에서 확인되지 않았습니다. 상시 개방·미개최를 뜻하지 않습니다.</p>'}${matched.length?'<p class="field-help">개별 스테이지 개방일·입장 조건은 게임에서 확인하세요.</p>':''}${events.collectedAt?`<small>일정 확인 ${esc(date(events.collectedAt))}${isStale(events.collectedAt)?' · 갱신 지연':''}</small>`:''}</section>`;
}

const percent=value=>value.toLocaleString('ko-KR',{maximumFractionDigits:4});
function renderBattle(map,stage){
  const battle=battleMaps.get(map.code),entry=battle?.stages[stage.index];
  if(!entry||entry.status!=='available')return `<section class="stage-magnifications"><h3>출현 적 이름 · 배율</h3><p class="stage-unknown">${entry?.status==='enemy-list-mismatch'?'공식 적 목록과 게임 데이터가 달라 배율 연결을 보류했어요.':entry?.status==='missing-game-stage'?'해당 스테이지의 게임 데이터가 없어요.':'배율 자료를 불러오지 못했어요.'}</p></section>`;
  state.crown=Math.min(state.crown,battle.crowns.length-1);
  const crown=battle.crowns[state.crown],checked=wikiChecks.stages.find(s=>s.mapCode===map.code&&s.stageIndex===stage.index);
  return `<section class="stage-magnifications"><div class="stage-section-heading"><h3>출현 적 이름 · 배율</h3><span>게임 데이터 · 1배 = 100%</span></div><label class="stage-crown-label" for="stage-crown">성급 <select id="stage-crown">${battle.crowns.map((n,i)=>`<option value="${i}" ${i===state.crown?'selected':''}>${i+1}성 · 강화 ×${percent(n/100)}</option>`).join('')}</select></label><div class="stage-battle-table-wrap"><table class="stage-battle-table"><thead><tr><th>출현 적</th><th>체력 배율</th><th>공격력 배율</th><th>나무위키 대조</th></tr></thead><tbody>${entry.enemies.map(e=>{
    const unit=enemyCatalog.get(e.enemyId),mag=effectiveMagnification(e,crown),observation=checked?.enemies.find(x=>x.enemyId===e.enemyId),comparison=wikiComparison([e],observation);
    return `<tr><th scope="row"><div class="stage-enemy-identity">${unit?`<img src="${esc(unit.image)}" alt="" width="48" height="48" loading="lazy">`:''}<span>${esc(unit?.name||`적 #${e.enemyId}`)}<small>${e.crownApplies?'':'성급 배율 제외 · '}${mag.hp!==mag.attack?'체력·공격력 배율 다름':''}</small></span></div></th><td><strong>${percent(mag.hp/100)}배</strong><small>${percent(mag.hp)}%</small></td><td><strong>${percent(mag.attack/100)}배</strong><small>${percent(mag.attack)}%</small></td><td>${comparison==='matched'?'<span class="wiki-checked">기본 배율 일치</span>':comparison==='different'?'<span class="stage-locale-warning">기본 배율 차이</span>':'미대조'}</td></tr>`;
  }).join('')}</tbody></table></div><p class="field-help">선택한 성급·에이리언 크리스탈 최대 기준입니다. 보물 부족에 따른 추가 배율은 제외됩니다. 현재 개방은 게임에서 확인하세요.</p><p class="field-help">${officialLink(`https://github.com/battlecatsinfo/battlecatsinfo.github.io/blob/${battleAudit?.source.commit||'main'}/data/stage.tsv`,'배율 데이터 출처')} · ${officialLink(`https://battlecatsinfo.github.io/stage.html?s=${Math.floor(entry.gameStageId/1000000)}-${Math.floor(entry.gameStageId%1000000/1000)}-${entry.gameStageId%1000}`,'원본 스테이지 데이터')}${checked?` · ${officialLink(wikiChecks.sourceUrl,'나무위키 원문')} · ${officialLink(wikiChecks.accessedVia,'대조에 사용한 보관본')}`:''}</p>${checked?`<p class="field-help">${esc(wikiChecks.checkedAt)}에 이 스테이지의 일부 수치를 수동 대조했어요. 표의 '일치'는 1성 기본 배율에 대한 확인이며 전체 나무위키 검증을 뜻하지 않습니다.</p>`:''}</section>`;
}

function renderLoadedDetail(map){
  if(!map){$('#stage-detail').innerHTML='<div class="stage-empty"><h2>공식 자료를 확인한 맵이 없어요.</h2><p>선택한 조건의 공식 상세 안내를 확인하지 못했어요. 한국어 안내 필터를 해제하거나 다른 분류를 선택해 보세요.</p><p>메인 스테이지 등 미확인 계열은 상단의 수집 현황에서 확인할 수 있어요.</p></div>';return;}
  const s=map.stages[Math.min(state.stage,map.stages.length-1)];state.stage=s.index;
  const cat=label(CATEGORIES,categoryOf(map));
  $('#stage-detail').innerHTML=`<div class="stage-map-heading"><div><span class="eyebrow">${esc(cat)}${categoryOf(map)==='special'?` / ${esc(label(SPECIALS,specialOf(map)))}`:''}</span><h2>${esc(map.name)}</h2><p>${map.stages.length}개 스테이지 · ${esc(FAMILY_NAMES[familyOf(map)]||map.code)} · ${esc(map.code)}</p>${map.koreanTextVerified===false?'<p class="stage-locale-warning">공식 원문에 한국어 이름이 제공되지 않았어요. 한국판 출시·현재 개방 여부를 의미하지 않습니다.</p>':''}</div></div>${renderSchedules(map)}<section class="stage-battle"><div class="stage-section-heading"><label for="stage-select">스테이지 선택</label><span>${state.stage+1} / ${map.stages.length}</span></div><div class="stage-selector"><button data-stage-step="-1" aria-label="이전 스테이지" ${state.stage===0?'disabled':''}>←</button><select id="stage-select">${map.stages.map(t=>`<option value="${t.index}" ${t.index===s.index?'selected':''}>${t.index+1}. ${esc(t.name||'공식 이름 미기재')}</option>`).join('')}</select><button data-stage-step="1" aria-label="다음 스테이지" ${state.stage===map.stages.length-1?'disabled':''}>→</button></div><h3 class="stage-name">${esc(s.name||'공식 이름 미기재')}</h3><div class="stage-facts"><div><span>${esc(s.costLabel||'필요 통솔력')}</span><strong class="${s.energy===null?'stage-cost-text':''}">${s.energy??esc(s.costText||'미기재')}</strong></div><div><span>공식 난이도</span><strong>${esc(s.difficulty||'미기재')}</strong></div><div><span>출현 적 종류</span><strong>${s.enemyListPublished?s.enemies.length:'미기재'}${s.enemyListPublished?'<small>종</small>':''}</strong></div></div><div class="stage-reward"><span class="small-label">드롭 보상</span><p>${esc(s.rewards||'공식 페이지 미기재')}</p></div><div class="stage-section-heading"><h3>출현하는 적</h3></div><div class="stage-enemies">${s.enemies.map(e=>`<figure>${e.image?`<img src="${esc(e.image)}" alt="공식 적 아이콘 ${esc(e.iconCode)}" width="64" height="64" loading="lazy">`:'<div class="stage-image-missing">공식 이미지<br>미확인</div>'}<figcaption>아이콘 #${esc(e.iconCode)}</figcaption></figure>`).join('')||'<p class="field-help">공식 페이지에서 공개한 적 아이콘이 없어요.</p>'}</div><p class="stage-enemy-note">아이콘 번호는 적 도감 번호와 다를 수 있습니다. 종류를 표시하며 마릿수는 미확인입니다.</p>${renderBattle(map,s)}</section><footer class="stage-provenance">${officialLink(map.sourceUrl,'공식 게임 내 안내 페이지')}<span>자료 확인 ${esc(date(map.verifiedAt))}${map.refreshFailed?' · 재확인 실패, 이전 확인 자료':''}</span><p>통솔력·난이도·보상은 기본값입니다. 실제 조건은 게임에서 확인하세요.</p></footer>`;
}
async function renderDetail(summary){
  if(!summary){renderLoadedDetail(null);return;}
  if(fullMaps.has(summary.code)){renderLoadedDetail(fullMaps.get(summary.code));return;}
  $('#stage-detail').innerHTML='<div class="stage-empty" role="status"><h2>공식 상세 자료를 불러오는 중…</h2></div>';
  try{
    const path=summary.detailsPath;
    if(!/^data\/stage-groups\/[A-Z]{1,2}\.json$/.test(path))throw new Error('Invalid stage group path');
    if(!pendingGroups.has(path))pendingGroups.set(path,(async()=>{
      const r=await fetch(path);if(!r.ok)throw new Error('Stage group request failed');
      const maps=hydrateStageGroup(await r.json(),data.images);
      try{
        const br=await fetch(`data/stage-battles/${familyOf(summary)}.json`);if(!br.ok)throw new Error('Battle data request failed');
        const battles=await br.json();for(const [code,battle] of Object.entries(battles.maps))battleMaps.set(code,battle);
      }catch(error){console.error(error);}
      for(const map of maps)fullMaps.set(map.code,map);
    })().finally(()=>pendingGroups.delete(path)));
    await pendingGroups.get(path);
    if(state.map===summary.code){const map=fullMaps.get(summary.code);if(!map)throw new Error('Missing map');renderLoadedDetail(map);}
  }catch(error){
    if(state.map===summary.code)$('#stage-detail').innerHTML='<div class="stage-empty"><h2>상세 자료를 불러오지 못했어요.</h2><p>연결 상태를 확인한 후 다시 시도해 주세요.</p><button class="text-button" data-stage-retry="true">다시 불러오기 →</button></div>';
    console.error(error);
  }
}
const failureText=reason=>reason.includes('map name not published')?'공식 맵 이름 미제공':reason.includes('placeholder')?'더미 안내':reason==='HTTP 403'?'공식 경로 접근 불가(403)':'자료 확인 실패';
function renderCoverage(){
  const totals=data.totals;
  $('#stage-coverage-total').textContent=`후보 ${totals.candidates.toLocaleString()}개 경로 확인 · 공식 안내 ${totals.maps.toLocaleString()}개 · 미확인 ${totals.unavailable.toLocaleString()}개`;
  $('#stage-coverage-body').innerHTML=data.familyReport.map(f=>`<tr><th scope="row">${esc(FAMILY_NAMES[f.prefix]||f.prefix)} <small>${f.prefix}</small></th><td>${f.candidateCount}</td><td>${f.verifiedMaps}</td><td>${f.koreanMaps}</td><td>${f.stageCount}</td><td>${f.unavailableCount?`${f.unavailableCount} · ${esc([...new Set(f.failureReasons.map(failureText))].join(', '))}`:'—'}</td></tr>`).join('');
  $('#stage-language-count').textContent=`한국어 안내 ${totals.koreanMaps.toLocaleString()}개 맵 · 그 외 원문 ${(totals.maps-totals.koreanMaps).toLocaleString()}개 맵`;
}

function render(){
  if(!data)return;
  $('#stage-categories').innerHTML=CATEGORIES.map(([id,name])=>{const count=filterMaps(data.maps,{category:id,koreanOnly:state.koreanOnly}).length;return `<button data-stage-category="${id}" class="${state.category===id?'active':''}" aria-pressed="${state.category===id}">${name}<span>${count}</span></button>`;}).join('');
  $('#stage-specials').hidden=state.category!=='special';
  $('#stage-specials').innerHTML=SPECIALS.map(([id,name])=>`<button data-stage-special="${id}" aria-pressed="${state.special===id}" class="${state.special===id?'active':''}">${name}</button>`).join('');
  const maps=filterMaps(data.maps,state);
  if(!maps.some(m=>m.code===state.map)){state.map=maps[0]?.code;state.stage=0;}
  $('#stage-map-count').textContent=`${maps.length}개 맵 · ${maps.reduce((n,m)=>n+m.stages.length,0)}개 스테이지`;
  const pages=Math.ceil(maps.length/MAP_PAGE_SIZE);state.page=Math.max(1,Math.min(state.page,pages||1));
  $('#stage-map-pages').innerHTML=pages>1?`<button data-stage-page="${state.page-1}" ${state.page===1?'disabled':''}>← 이전</button><span>${state.page} / ${pages}</span><button data-stage-page="${state.page+1}" ${state.page===pages?'disabled':''}>다음 →</button>`:'';
  $('#stage-map-list').innerHTML=maps.length?maps.slice((state.page-1)*MAP_PAGE_SIZE,state.page*MAP_PAGE_SIZE).map(m=>`<button data-stage-map="${m.code}" aria-pressed="${m.code===state.map}" class="${m.code===state.map?'active':''}"><strong>${esc(m.name)}</strong><span>${m.stages.length}개 · ${esc(m.code)}${m.koreanTextVerified===false?' · 한국어 미제공':''} <b aria-hidden="true">→</b></span></button>`).join(''):'<p class="stage-list-empty">이 조건으로 확인된 공식 자료가 없어요.</p>';
  renderDetail(maps.find(m=>m.code===state.map));
}
export async function initStages(){
  try{
    const r=await fetch('data/stage-index.json');if(!r.ok)throw new Error('stage data');data=await r.json();
    try{const e=await fetch('data/events.json');if(e.ok)events=await e.json();}catch{/* Stage metadata remains usable without schedule data. */}
    const resources=await Promise.allSettled(['enemies.json','stage-wiki-checks.json','stage-battle-audit.json'].map(async path=>{const r=await fetch('data/'+path);if(!r.ok)throw new Error(path);return r.json();}));
    if(resources[0].status==='fulfilled')enemyCatalog=new Map(resources[0].value.map(e=>[e.id,e]));
    if(resources[1].status==='fulfilled')wikiChecks=resources[1].value;
    if(resources[2].status==='fulfilled'){battleAudit=resources[2].value;$('#stage-battle-coverage').textContent=`배율 연결 ${battleAudit.coveredStages.toLocaleString()} / ${battleAudit.totalStages.toLocaleString()}개 스테이지 · 나무위키 대조 ${wikiChecks.stages.length}개 스테이지(표본)`;}
    renderCoverage();
    $('#stage-total').textContent=`${data.totals.maps.toLocaleString()}개 맵 · ${data.totals.stages.toLocaleString()}개 스테이지`;
    $('#stage-loading').hidden=true;$('#stage-content').hidden=false;
    $('#stage-search').addEventListener('input',e=>{
      state.query=e.target.value;state.page=1;
      const matches=filterMaps(data.maps,state),map=matches.find(m=>m.code===state.map)||matches[0];
      state.map=map?.code;
      const q=state.query.normalize('NFKC').toLocaleLowerCase('ko-KR').trim();
      state.stage=Math.max(0,map?.stages.findIndex(s=>s.name.normalize('NFKC').toLocaleLowerCase('ko-KR').includes(q))??0);
      render();
    });
    $('#stages-view').addEventListener('change',e=>{if(e.target.id==='stage-korean-only'){state.koreanOnly=e.target.checked;state.page=1;render();}if(e.target.id==='stage-crown'){state.crown=Number(e.target.value);renderDetail(data.maps.find(m=>m.code===state.map));}if(e.target.id==='stage-select'){state.stage=Number(e.target.value);renderDetail(data.maps.find(m=>m.code===state.map));}});
    $('#stages-view').addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.stageRetry)renderDetail(data.maps.find(m=>m.code===state.map));
      if(b.dataset.stagePage){state.page=Number(b.dataset.stagePage);render();}
      if(b.dataset.stageCategory){state.page=1;state.category=b.dataset.stageCategory;state.special='all';state.stage=0;render();}
      if(b.dataset.stageSpecial){state.page=1;state.special=b.dataset.stageSpecial;state.stage=0;render();}
      if(b.dataset.stageMap){state.map=b.dataset.stageMap;state.stage=0;state.crown=0;render();}
      if(b.dataset.stageStep){state.stage+=Number(b.dataset.stageStep);renderDetail(data.maps.find(m=>m.code===state.map));}
    });
    render();
  }catch(error){$('#stage-loading').textContent='스테이지 자료를 불러오지 못했어요. 잠시 후 새로고침해 주세요.';console.error(error);}
}
