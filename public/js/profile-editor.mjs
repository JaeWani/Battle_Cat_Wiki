import {escapeHTML as esc} from './community-model.mjs?v=google-only-1';
import {createGameDraft,draftCat,validateGameDraft,talentSummary} from './game-profile-model.mjs';
const $=s=>document.querySelector(s),PAGE_SIZE=24;
const rarities=['기본','EX','레어','슈퍼 레어','울트라 슈퍼 레어','레전드 레어'];
export function initProfileEditor({getSaved,getGroups,getAccount,onSave}){
 let draft=null,groups=[],page=1,query='',rarity='all',ownership='all',expected=null,dirty=false,busy=false,generation=0;
 const dialog=$('#my-editor-dialog');
 function error(message){$('#my-editor-error').textContent=message;}
 function filtered(){return groups.filter(g=>(rarity==='all'||g.rarity===Number(rarity))&&(ownership==='all'||Boolean(draft.cats.get(g.id)?.owned)===(ownership==='owned'))&&g.search.includes(query.toLowerCase().trim()));}
 function count(){return [...draft.cats.values()].filter(c=>c.owned).length;}
 function summary(){
  $('#my-editor-count').textContent='보유 '+count()+'종 / 전체 '+groups.length+'종'+(dirty?' · 저장하지 않은 변경 있음':'');
  $('#my-editor-save').disabled=busy||!$('#my-editor-consent').checked||!dirty;
 }
 function renderRows(){
  const results=filtered(),pages=Math.max(1,Math.ceil(results.length/PAGE_SIZE));page=Math.min(page,pages);
  $('#my-editor-results').textContent=results.length+'종 검색 결과 · '+page+' / '+pages+'페이지';
  $('#my-editor-list').innerHTML=results.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(g=>{
   const c=draftCat(draft,g),unit=g.forms.find(f=>f.form===c.form)||g.forms[0],disabled=c.owned?'':' disabled';
   return '<article class="my-edit-cat '+(c.owned?'is-owned':'')+'" data-edit-cat="'+c.id+'"><div class="my-edit-cat-heading"><img src="'+esc(unit.image)+'" width="104" height="79" alt="" loading="lazy"><div><span class="my-edit-id">NO. '+String(c.id).padStart(3,'0')+' · '+esc(rarities[g.rarity])+'</span><h3>'+esc(unit.name)+'</h3></div><label class="my-own-toggle"><input type="checkbox" data-cat-field="owned" aria-label="'+esc(g.forms[0].name)+' 보유 여부" '+(c.owned?'checked':'')+'><span>보유</span></label></div><fieldset'+disabled+'><legend class="sr-only">'+esc(g.forms[0].name)+' 설정</legend><label class="my-edit-form">진화 형태<select data-cat-field="form" aria-label="'+esc(g.forms[0].name)+' 진화 형태">'+g.forms.map(f=>'<option value="'+f.form+'" '+(f.form===c.form?'selected':'')+'>'+(f.form+1)+'진화 · '+esc(f.name)+'</option>').join('')+'</select></label><div class="my-edit-levels"><label>기본 레벨<input type="number" min="1" max="200" step="1" inputmode="numeric" value="'+c.level+'" data-cat-field="level" aria-label="'+esc(g.forms[0].name)+' 기본 레벨"></label><label>+ 레벨<input type="number" min="0" max="1000" step="1" inputmode="numeric" value="'+c.plus+'" data-cat-field="plus" aria-label="'+esc(g.forms[0].name)+' 플러스 레벨"></label></div>'+(g.talents.length?'<details class="my-edit-talents"><summary>'+esc(talentSummary(c,g.talents))+'</summary><div class="my-talent-presets"><button type="button" class="text-button" data-manual="talents-zero" data-cat-id="'+c.id+'">모두 미해방</button><button type="button" class="text-button" data-manual="talents-max" data-cat-id="'+c.id+'">모두 최대</button></div>'+g.talents.map(t=>{
    const level=c.talents?.find(v=>v.id===t.id)?.level;
    return '<label class="my-edit-talent"><span>'+esc(t.name)+(t.super?'<small>초본능</small>':'')+'</span><select data-talent-id="'+t.id+'" aria-label="'+esc(g.forms[0].name+' '+t.name+(t.super?' 초본능':''))+'"><option value="" '+(level==null?'selected':'')+'>미확인</option>'+Array.from({length:t.maxLevel+1},(_,n)=>'<option value="'+n+'" '+(level===n?'selected':'')+'>'+(n===0?'미해방':t.maxLevel===1?'해방':'Lv. '+n)+'</option>').join('')+'</select></label>';
   }).join('')+'</details>':'<p class="my-no-talents">등록된 본능 항목 없음</p>')+'</fieldset></article>';
  }).join('')||'<p class="my-empty">검색 결과가 없습니다. 검색어나 필터를 변경해 주세요.</p>';
  $('#my-editor-pages').innerHTML='<button type="button" data-manual="previous" '+(page===1?'disabled':'')+'>← 이전</button><span>'+page+' / '+pages+'</span><button type="button" data-manual="next" '+(page===pages?'disabled':'')+'>다음 →</button>';
  summary();
 }
 function close(force=false){
  if(busy&&!force)return;
  if(!force&&dirty&&!confirm('저장하지 않은 변경을 취소할까요?'))return;
  dialog.close();draft=null;dirty=false;generation++;
 }
 async function open(){
  const ticket=++generation;
  try{
   groups=await getGroups();if(ticket!==generation)return;
   const saved=getSaved();draft=createGameDraft(saved);expected=saved?.updated_at||null;page=1;query='';rarity='all';ownership='all';dirty=false;
   $('#my-editor-search').value='';$('#my-editor-rarity').value='all';$('#my-editor-owned').value='all';$('#my-editor-consent').checked=false;
   $('#my-editor-region').value=draft.region;error('');renderRows();dialog.showModal();
  }catch(e){document.querySelector('#my-game-status').textContent=e.message;}
 }
 async function save(){
  if(busy||!draft||!dirty||!$('#my-editor-consent').checked)return;
  error('');
  const invalid=[...dialog.querySelectorAll('input[type=number]')].find(i=>!i.disabled&&!i.validity.valid);
  if(invalid){invalid.reportValidity();return;}
  try{
   const snapshot=validateGameDraft(draft,groups);
   if(getAccount().status!=='active')throw new Error('Google 로그인과 가입 완료 후 저장해 주세요.');
   const ticket=generation;busy=true;dialog.classList.add('is-saving');summary();
   await onSave(snapshot,expected);
   if(ticket!==generation)return;dirty=false;close(true);
  }catch(e){error(e.message);}finally{busy=false;dialog.classList.remove('is-saving');if(draft&&dialog.open)summary();}
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('input',e=>{
  if(!draft||busy)return;
  if(e.target.id==='my-editor-search'){query=e.target.value;page=1;renderRows();return;}
  const card=e.target.closest('[data-edit-cat]'),field=e.target.dataset.catField;
  if(card&&['level','plus'].includes(field)){
   const c=draft.cats.get(Number(card.dataset.editCat));c[field]=e.target.value===''?NaN:Number(e.target.value);dirty=true;summary();
  }
 });
 dialog.addEventListener('change',e=>{
  if(!draft||busy)return;
  if(e.target.id==='my-editor-consent'){summary();return;}
  if(e.target.id==='my-editor-rarity'){rarity=e.target.value;page=1;renderRows();return;}
  if(e.target.id==='my-editor-owned'){ownership=e.target.value;page=1;renderRows();return;}
  if(e.target.id==='my-editor-region'){draft.region=e.target.value;dirty=true;summary();return;}
  const card=e.target.closest('[data-edit-cat]');if(!card)return;
  const c=draft.cats.get(Number(card.dataset.editCat)),field=e.target.dataset.catField;
  if(field==='owned'){c.owned=e.target.checked;dirty=true;renderRows();return;}
  if(field==='form'){c.form=Number(e.target.value);dirty=true;renderRows();return;}
  if(e.target.dataset.talentId){
   const id=Number(e.target.dataset.talentId);c.talents=(c.talents||[]).filter(t=>t.id!==id);
   if(e.target.value!=='')c.talents.push({id,level:Number(e.target.value)});
   card.querySelector('summary').textContent=talentSummary(c,groups.find(g=>g.id===c.id).talents);dirty=true;summary();
  }
 });
 dialog.addEventListener('click',e=>{
  const button=e.target.closest('[data-manual]');if(!button||busy)return;
  const action=button.dataset.manual;
  if(action==='close')close();if(action==='save')save();
  if(action==='next'||action==='previous'){page+=action==='next'?1:-1;renderRows();$('#my-editor-scroll').scrollTop=0;}
  if(action==='talents-zero'||action==='talents-max'){
   const id=Number(button.dataset.catId),c=draft.cats.get(id),g=groups.find(g=>g.id===id);
   if(!c.owned)return;c.talents=g.talents.map(t=>({id:t.id,level:action==='talents-max'?t.maxLevel:0}));dirty=true;renderRows();
  }
 });
 return {open,reset:()=>{generation++;dirty=false;close(true);},isOpen:()=>dialog.open};
}
