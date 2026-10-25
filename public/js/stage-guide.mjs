import {CATEGORIES,SPECIALS,categoryOf,specialOf,filterMaps,schedulesFor} from './stages.mjs';
import {eventStatus,isStale} from './events.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
let data,events={events:[]},state={category:'all',special:'all',query:'',map:'V000',stage:0};
const label=(list,key)=>list.find(([id])=>id===key)?.[1]||'미분류';
function officialLink(url,text){return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${text} ↗</a>`;}
function renderSchedules(map){
  const matched=schedulesFor(map,events.events);
  return `<section class="stage-schedule"><div class="stage-section-heading"><h3>열리는 날짜</h3><span>맵 전체 개최 일정 · KST</span></div>${matched.length?matched.map(e=>{
    const status=eventStatus(e),labels={ongoing:'진행 중',upcoming:'예정',ended:'종료',recurring:'반복 개최일'};
    return `<div class="stage-period"><span class="event-status ${status}">${labels[status]||'공식 공지'}</span><strong>${esc(e.period?`${date(e.period.startAt)} ~ ${date(e.period.announcedEndAt)}`:e.recurrence.label)}</strong>${officialLink(e.sourceUrl,'공식 일정 공지')}</div>`;
  }).join(''):'<p class="stage-unknown">공식 개최일 미확인</p><p class="field-help">수집된 한국판 공식 공지에 이 맵의 개최 일정이 없어요. 상시 개방 또는 미개최라는 뜻은 아닙니다.</p>'}${matched.length?'<p class="field-help">맵 이름이 일치하는 공식 공지를 연결했어요. 각 스테이지의 순차 개방일·입장 조건은 별도 확인이 필요해요.</p>':''}${events.collectedAt?`<small>일정 확인 ${esc(date(events.collectedAt))}${isStale(events.collectedAt)?' · 갱신 지연':''}</small>`:''}</section>`;
}
function renderDetail(map){
  if(!map){$('#stage-detail').innerHTML='<div class="stage-empty"><h2>공식 자료를 확인한 맵이 없어요.</h2><p>다른 분류를 선택해 보세요. 이 목록은 전체 게임 스테이지 목록이 아닙니다.</p></div>';return;}
  const s=map.stages[Math.min(state.stage,map.stages.length-1)];state.stage=s.index;
  const cat=label(CATEGORIES,categoryOf(map));
  $('#stage-detail').innerHTML=`<div class="stage-map-heading"><div><span class="eyebrow">${esc(cat)}${categoryOf(map)==='special'?` / ${esc(label(SPECIALS,specialOf(map)))}`:''}</span><h2>${esc(map.name)}</h2><p>${map.stages.length}개 스테이지 · 공식 안내 기본 표시 기준</p></div><span class="official-badge">PONOS 공식 자료</span></div>${renderSchedules(map)}<section class="stage-battle"><div class="stage-section-heading"><label for="stage-select">스테이지 선택</label><span>${state.stage+1} / ${map.stages.length}</span></div><div class="stage-selector"><button data-stage-step="-1" aria-label="이전 스테이지" ${state.stage===0?'disabled':''}>←</button><select id="stage-select">${map.stages.map(t=>`<option value="${t.index}" ${t.index===s.index?'selected':''}>${t.index+1}. ${esc(t.name)}</option>`).join('')}</select><button data-stage-step="1" aria-label="다음 스테이지" ${state.stage===map.stages.length-1?'disabled':''}>→</button></div><h3 class="stage-name">${esc(s.name)}</h3><div class="stage-facts"><div><span>필요 통솔력</span><strong>${s.energy??'미기재'}</strong></div><div><span>공식 난이도</span><strong>${esc(s.difficulty||'미기재')}</strong></div><div><span>출현 적 종류</span><strong>${s.enemyListPublished?s.enemies.length:'미기재'}${s.enemyListPublished?'<small>종</small>':''}</strong></div></div><div class="stage-reward"><span class="small-label">드롭 보상</span><p>${esc(s.rewards||'공식 페이지 미기재')}</p></div><div class="stage-section-heading"><h3>출현하는 적</h3><span>공식 원본 아이콘</span></div><div class="stage-enemies">${s.enemies.map(e=>`<figure><img src="${esc(e.image)}" alt="공식 적 아이콘 ${esc(e.iconCode)}" width="64" height="64" loading="lazy"><figcaption>아이콘 #${esc(e.iconCode)}</figcaption></figure>`).join('')||'<p class="field-help">공식 페이지에서 공개한 적 아이콘이 없어요.</p>'}</div><p class="stage-enemy-note">아이콘 번호는 공식 이미지 파일명의 번호예요. 적 도감 번호와 같다고 보장하지 않아요. 아이콘은 출현 적의 종류를 나타내며 출현 마릿수가 아닙니다.</p><dl class="stage-missing"><div><dt>적 이름 · 배율</dt><dd>공식 페이지 미기재</dd></div><div><dt>출현 마릿수 · 시각</dt><dd>공식 페이지 미기재</dd></div><div><dt>개별 스테이지 개방일</dt><dd>공식 페이지 미기재</dd></div></dl></section><footer class="stage-provenance">${officialLink(map.sourceUrl,'공식 게임 내 안내 페이지')}<span>자료 확인 ${esc(date(map.verifiedAt))}</span><p>통솔력·난이도·보상은 안내 페이지의 기본 표시값이에요. 성급, 할인, 진행도별 조건은 게임 내 표시를 확인하세요. 아이콘 © PONOS Corp. 및 각 권리자</p></footer>`;
}
function render(){
  if(!data)return;
  $('#stage-categories').innerHTML=CATEGORIES.map(([id,name])=>{const count=data.maps.filter(m=>id==='all'||categoryOf(m)===id).length;return `<button data-stage-category="${id}" class="${state.category===id?'active':''}" aria-pressed="${state.category===id}">${name}<span>${count}</span></button>`;}).join('');
  $('#stage-specials').hidden=state.category!=='special';
  $('#stage-specials').innerHTML=SPECIALS.map(([id,name])=>`<button data-stage-special="${id}" aria-pressed="${state.special===id}" class="${state.special===id?'active':''}">${name}</button>`).join('');
  const maps=filterMaps(data.maps,state);
  if(!maps.some(m=>m.code===state.map)){state.map=maps[0]?.code;state.stage=0;}
  $('#stage-map-count').textContent=`${maps.length}개 맵 · ${maps.reduce((n,m)=>n+m.stages.length,0)}개 스테이지`;
  $('#stage-map-list').innerHTML=maps.length?maps.map(m=>`<button data-stage-map="${m.code}" aria-pressed="${m.code===state.map}" class="${m.code===state.map?'active':''}"><strong>${esc(m.name)}</strong><span>${m.stages.length}개 스테이지 <b aria-hidden="true">→</b></span></button>`).join(''):'<p class="stage-list-empty">이 조건으로 확인된 공식 자료가 없어요.</p>';
  renderDetail(maps.find(m=>m.code===state.map));
}
export async function initStages(){
  try{
    const r=await fetch('data/stages.json');if(!r.ok)throw new Error('stage data');data=await r.json();
    try{const e=await fetch('data/events.json');if(e.ok)events=await e.json();}catch{/* Stage metadata remains usable without schedule data. */}
    $('#stage-total').textContent=`${data.maps.length}개 맵 · ${data.maps.reduce((n,m)=>n+m.stages.length,0)}개 스테이지`;
    $('#stage-loading').hidden=true;$('#stage-content').hidden=false;
    $('#stage-search').addEventListener('input',e=>{
      state.query=e.target.value;
      const matches=filterMaps(data.maps,state),map=matches.find(m=>m.code===state.map)||matches[0];
      state.map=map?.code;
      const q=state.query.normalize('NFKC').toLocaleLowerCase('ko-KR').trim();
      state.stage=Math.max(0,map?.stages.findIndex(s=>s.name.normalize('NFKC').toLocaleLowerCase('ko-KR').includes(q))??0);
      render();
    });
    $('#stages-view').addEventListener('change',e=>{if(e.target.id==='stage-select'){state.stage=Number(e.target.value);renderDetail(data.maps.find(m=>m.code===state.map));}});
    $('#stages-view').addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.stageCategory){state.category=b.dataset.stageCategory;state.special='all';state.stage=0;render();}
      if(b.dataset.stageSpecial){state.special=b.dataset.stageSpecial;state.stage=0;render();}
      if(b.dataset.stageMap){state.map=b.dataset.stageMap;state.stage=0;render();}
      if(b.dataset.stageStep){state.stage+=Number(b.dataset.stageStep);renderDetail(data.maps.find(m=>m.code===state.map));}
    });
    render();
  }catch(error){$('#stage-loading').textContent='스테이지 자료를 불러오지 못했어요. 잠시 후 새로고침해 주세요.';console.error(error);}
}
