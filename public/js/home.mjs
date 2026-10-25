import {kstDay,shiftDay,onDay,eventStatus,isStale,filterEvents} from './events.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={gacha:'뽑기',event:'이벤트',reward:'보상'};
const statuses={ongoing:'진행 중',upcoming:'예정',ended:'종료',recurring:'개최일',notice:'소식'};
const state={day:kstDay(),category:'all',query:'',autoDay:true};
let data=null;
const date=(v,options={})=>new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',...options});
const shortDay=day=>date(`${day}T12:00:00+09:00`,{month:'long',day:'numeric',weekday:'long'});
const clock=v=>date(v,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const safeURL=url=>{try{const u=new URL(url);return u.protocol==='https:'&&['nyanko-announcement.ponosgames.com','battlecats.club'].includes(u.hostname)?u.href:'https://battlecats.club/kr/';}catch{return 'https://battlecats.club/kr/';}};
function periodText(e){return e.period?`${clock(e.period.startAt)} ~ ${clock(e.period.announcedEndAt)}`:e.recurrence?.label||'개최 기간은 원문 확인';}
function endingLabel(e,now){
  if(!e.period)return '';
  const ms=Date.parse(e.period.endAt)-now.getTime();
  if(ms<=0)return '';
  if(ms<3600000)return `${Math.ceil(ms/60000)}분 후 종료`;
  if(ms<86400000)return `${Math.ceil(ms/3600000)}시간 후 종료`;
  return `${Math.ceil(ms/86400000)}일 이내 종료`;
}
function row(e,now){
  const status=eventStatus(e,now);
  const image=e.image?`<img src="${esc(e.image.path)}" alt="${esc(e.title)} 공식 배너" loading="lazy">`:`<img src="assets/u/0/0.png" alt="고양이" loading="lazy" class="event-fallback">`;
  return `<article class="event-row"><a class="event-art" href="${esc(safeURL(e.sourceUrl))}" target="_blank" rel="noopener noreferrer">${image}</a><div class="event-content"><div class="event-tags"><span class="event-category ${e.category}">${labels[e.category]||'이벤트'}</span><span class="event-status ${status}">${statuses[status]}</span>${status==='ongoing'?`<span class="event-deadline">${endingLabel(e,now)}</span>`:''}</div><h3><a href="${esc(safeURL(e.sourceUrl))}" target="_blank" rel="noopener noreferrer">${esc(e.title)}</a></h3><p class="event-period">${esc(periodText(e))}</p>${e.recurrence?'<p class="recurrence-note">반복 개최일 기준 · 정확한 개최 시간은 공식 공지를 확인하세요.</p>':''}</div><a class="event-source-link" href="${esc(safeURL(e.sourceUrl))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(e.title)} 공식 공지">공지 보기 <span aria-hidden="true">↗</span></a></article>`;
}
function render(){
  if(!data)return;
  const now=new Date(),today=kstDay(now),events=data.events;
  const ongoing=events.filter(e=>eventStatus(e,now)==='ongoing');
  const soon=ongoing.filter(e=>Date.parse(e.period.endAt)-now.getTime()<86400000);
  const selected=filterEvents(events,{day:state.day,category:state.category,query:state.query}).sort((a,b)=>{
    const order={ongoing:0,recurring:1,upcoming:2,ended:3};
    return (order[eventStatus(a,now)]??4)-(order[eventStatus(b,now)]??4)||(Date.parse(a.period?.endAt)||Infinity)-(Date.parse(b.period?.endAt)||Infinity);
  });
  $('#home-today').textContent=shortDay(today);
  $('#home-live-count').textContent=ongoing.length;
  $('#home-ending-count').textContent=soon.length;
  $('#home-collection-count').textContent=events.filter(e=>e.period||e.recurrence).length;
  $('#home-date').value=state.day;
  $('#selected-day-title').textContent=state.day===today?'오늘의 일정':shortDay(state.day);
  $('#selected-day-count').textContent=`${selected.length}개 일정 · 한국 시간 기준`;
  $('#home-week').innerHTML=Array.from({length:7},(_,i)=>{
    const day=shiftDay(state.day,i-3),count=events.filter(e=>onDay(e,day)).length;
    return `<button class="week-day ${day===state.day?'selected':''} ${day===today?'is-today':''}" data-event-day="${day}" aria-pressed="${day===state.day}"><span>${date(`${day}T12:00:00+09:00`,{weekday:'short'})}${day===today?' · 오늘':''}</span><b>${Number(day.slice(-2))}</b><small>${count?`${count}개`:'—'}</small></button>`;
  }).join('');
  $('#home-event-list').innerHTML=selected.length?selected.map(e=>row(e,now)).join(''):`<div class="events-empty"><strong>${state.query||state.category!=='all'?'조건에 맞는 일정이 없어요.':'이 날짜에 확인된 일정이 없어요.'}</strong><p>공식 공지에서 확인한 일정만 표시합니다.<br>실제 게임 내 이벤트가 없다는 의미는 아니에요.</p><a href="${esc(safeURL(data.sourceUrl))}" target="_blank" rel="noopener noreferrer">공식 공지 확인 ↗</a></div>`;
  for(const button of document.querySelectorAll('[data-event-category]')){const active=button.dataset.eventCategory===state.category;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  const stale=isStale(data.collectedAt,now);
  $('#home-sync').innerHTML=`<span class="${stale?'sync-old':'sync-live'}"></span>${stale?'갱신 지연 · ':''}마지막 수집 ${date(data.collectedAt,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}`;
  $('#home-stale').hidden=!stale;
  $('#home-source').href=safeURL(data.sourceUrl);
  const notices=events.filter(e=>!e.period&&!e.recurrence).slice(0,5);
  $('#home-notices').innerHTML=notices.length?notices.map(e=>`<a class="news-item" href="${esc(safeURL(e.sourceUrl))}" target="_blank" rel="noopener noreferrer"><small>${e.publishedOn?esc(e.publishedOn.replaceAll('-','.')):'공식 소식'}</small><strong>${esc(e.title)}</strong><span>기간은 원문 확인 ↗</span></a>`).join(''):'<p class="field-help">개최 기간이 확인된 공지는 왼쪽 일정에 표시했어요.</p>';
  const feature=ongoing.find(e=>e.category==='event'&&e.image)||ongoing.find(e=>e.image);
  $('#home-feature').hidden=!feature;
  if(feature)$('#home-feature').innerHTML=`<a href="${esc(safeURL(feature.sourceUrl))}" target="_blank" rel="noopener noreferrer"><div class="feature-caption"><span class="event-category">지금 주목할 이벤트</span><span>${endingLabel(feature,now)} ↗</span></div><img src="${esc(feature.image.path)}" alt="${esc(feature.title)} 공식 배너"><div class="feature-title">${esc(feature.title)}</div><p>${esc(periodText(feature))}</p></a>`;
  $('#home-loading').hidden=true;
}
export async function initHome(){
  $('#home-date').addEventListener('change',e=>{if(!e.target.value)return;state.day=e.target.value;state.autoDay=false;render();});
  $('#home-search').addEventListener('input',e=>{state.query=e.target.value;render();});
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.eventDay){state.day=b.dataset.eventDay;state.autoDay=false;render();}
    if(b.dataset.eventCategory){state.category=b.dataset.eventCategory;render();}
    if(b.dataset.eventShift){state.day=shiftDay(state.day,Number(b.dataset.eventShift));state.autoDay=false;render();}
    if(b.id==='event-today'){state.day=kstDay();state.autoDay=true;render();}
  });
  try{
    const response=await fetch('data/events.json',{cache:'no-cache'});if(!response.ok)throw new Error('일정 데이터 요청 실패');
    data=await response.json();if(data.region!=='KR'||!Array.isArray(data.events))throw new Error('일정 데이터 형식 오류');
    render();
    setInterval(()=>{if(state.autoDay)state.day=kstDay();render();},60000);
  }catch{
    $('#home-loading').hidden=true;$('#home-sync').textContent='일정 데이터 확인 필요';
    $('#home-event-list').innerHTML='<div class="events-empty"><strong>일정을 불러오지 못했어요.</strong><p>잠시 후 새로고침하거나 공식 공지에서 확인해 주세요.</p><a href="https://battlecats.club/kr/" target="_blank" rel="noopener noreferrer">공식 소식 확인 ↗</a></div>';
    $('#home-live-count').textContent='—';$('#home-ending-count').textContent='—';$('#home-collection-count').textContent='—';
  }
}
