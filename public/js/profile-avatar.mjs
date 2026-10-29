import {escapeHTML as esc} from './community-model.mjs?v=google-only-1';
import {resolveAvatar,filterAvatars,DEFAULT_AVATAR_KEY} from './avatar-model.mjs';
const $=s=>document.querySelector(s),PAGE_SIZE=36;
export function initAvatarPicker({getChoices,getAccount,onSave}){
 const dialog=$('#my-avatar-dialog');
 let selected=DEFAULT_AVATAR_KEY,kind='cat',query='',page=1,busy=false,generation=0;
 const error=message=>{$('#my-avatar-error').textContent=message;};
 function render(){
  const choices=getChoices(),account=getAccount(),unit=resolveAvatar(selected,choices),items=filterAvatars(choices,kind,query),pages=Math.max(1,Math.ceil(items.length/PAGE_SIZE));page=Math.min(page,pages);
  $('#my-avatar-preview').innerHTML='<img src="'+esc(unit.image)+'" alt="">';
  $('#my-avatar-preview img').alt=unit.name+' 프로필 사진 미리보기';
  $('#my-avatar-selected-name').textContent=unit.label;
  $('#my-avatar-current').textContent=selected===(account.avatarKey||DEFAULT_AVATAR_KEY)?'현재 프로필 사진':'저장 전 미리보기';
  $('#my-avatar-count').textContent=items.length+'개 · '+page+' / '+pages+'페이지';
  $('#my-avatar-grid').innerHTML=items.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map(c=>'<button type="button" class="my-avatar-choice '+(c.avatarKey===selected?'selected':'')+'" data-avatar-key="'+esc(c.avatarKey)+'" aria-pressed="'+(c.avatarKey===selected)+'" aria-label="'+esc(c.label)+'" '+(busy?'disabled':'')+'><img src="'+esc(c.image)+'" alt="" loading="lazy"><span>'+esc(c.name)+'</span><small>'+(c.kind==='cat'?(c.form+1)+'진화':'적군')+' · #'+c.id+'</small></button>').join('')||'<p class="my-avatar-empty">검색 결과가 없습니다.</p>';
  $('#my-avatar-pages').innerHTML='<button type="button" data-avatar-action="previous" '+(page===1||busy?'disabled':'')+'>← 이전</button><span>'+page+' / '+pages+'</span><button type="button" data-avatar-action="next" '+(page===pages||busy?'disabled':'')+'>다음 →</button>';
  for(const button of dialog.querySelectorAll('[data-avatar-kind]')){const active=button.dataset.avatarKind===kind;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  const save=$('#my-avatar-save');save.disabled=busy||account.status!=='active'||selected===(account.avatarKey||DEFAULT_AVATAR_KEY);save.textContent=busy?'저장 중…':'프로필 사진 저장';
  $('#my-avatar-login-note').hidden=account.status==='active';
 }
 function open(){
  if(!getChoices().length){document.querySelector('#my-game-status').textContent='도감 자료를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.';return;}
  generation++;selected=resolveAvatar(getAccount().avatarKey,getChoices()).avatarKey;kind=selected.startsWith('e')?'enemy':'cat';query='';page=1;$('#my-avatar-search').value='';error('');render();dialog.showModal();
 }
 function close(){if(!busy){dialog.close();generation++;}}
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 document.addEventListener('click',async e=>{
  if(e.target.closest('[data-avatar-open]')){open();return;}
  if(!dialog.open||busy)return;
  const card=e.target.closest('[data-avatar-key]');
  if(card&&dialog.contains(card)){selected=card.dataset.avatarKey;render();return;}
  const tab=e.target.closest('[data-avatar-kind]');if(tab&&dialog.contains(tab)){kind=tab.dataset.avatarKind;page=1;render();return;}
  const action=e.target.closest('[data-avatar-action]')?.dataset.avatarAction;
  if(action==='close')close();
  if(action==='default'){selected=DEFAULT_AVATAR_KEY;render();}
  if(action==='previous'||action==='next'){page+=action==='next'?1:-1;render();$('#my-avatar-scroll').scrollTop=0;}
  if(action==='save'){
   const account=getAccount();if(account.status!=='active')return;
   if(!getChoices().some(c=>c.avatarKey===selected)){error('등록된 캐릭터나 적군 이미지를 선택해 주세요.');return;}
   const ticket=generation,id=account.id;busy=true;error('');render();dialog.classList.add('is-saving');
   try{await onSave(selected);if(ticket!==generation||getAccount().id!==id)return;dialog.close();}
   catch(err){if(ticket===generation)error(err.message);}
   finally{if(ticket===generation){busy=false;dialog.classList.remove('is-saving');if(dialog.open)render();}}
  }
 });
 $('#my-avatar-search').addEventListener('input',e=>{if(busy)return;query=e.target.value;page=1;render();});
 return {reset(){generation++;dialog.close();selected=DEFAULT_AVATAR_KEY;busy=false;dialog.classList.remove('is-saving');}};
}
