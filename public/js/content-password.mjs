export function validContentPassword(value){
 if(typeof value!=='string'||[...value].length<4||!value.trim()||new TextEncoder().encode(value).length>72||value.includes('\0'))throw new Error('비밀번호는 4자 이상, UTF-8 72바이트 이하로 입력해 주세요.');
 return value; // Whitespace is significant. Never trim or silently truncate passwords.
}
export function initContentPasswordDialog(){
 const dialog=document.querySelector('#noc-password-dialog'),form=document.querySelector('#noc-password-form');
 let task=null,busy=false,generation=0;
 function clear(){form.reset();document.querySelector('#noc-password-error').textContent='';}
 function cancel(){if(busy)return;generation++;const previous=task;task=null;dialog.close();clear();previous?.resolve(null);}
 dialog.addEventListener('cancel',e=>{e.preventDefault();cancel();});
 document.querySelector('#noc-password-cancel').addEventListener('click',cancel);
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!task||busy)return;
  const ticket=generation,current=task;const button=form.querySelector('[type=submit]');
  try{
   const password=validContentPassword(form.elements.password.value);
   if(current.options.setup&&password!==form.elements.confirm.value)throw new Error('비밀번호 확인이 일치하지 않습니다.');
   busy=true;button.disabled=true;document.querySelector('#noc-password-error').textContent='';
   const result=await current.options.submit({password,body:form.elements.body.value});
   if(ticket!==generation)return;task=null;dialog.close();clear();current.resolve(result??true);
  }catch(error){if(ticket===generation)document.querySelector('#noc-password-error').textContent=error.message;}
  finally{if(ticket===generation){busy=false;button.disabled=false;}}
 });
 function prompt(options){
  if(task||busy)return Promise.reject(new Error('열려 있는 비밀번호 확인을 먼저 완료해 주세요.'));
  generation++;clear();
  document.querySelector('#noc-password-title').textContent=options.title;
  document.querySelector('#noc-password-description').textContent=options.setup?'이 글·댓글의 수정·삭제에 사용할 비밀번호를 설정해 주세요.':'작성할 때 설정한 비밀번호를 입력해 주세요.';
  document.querySelector('#noc-password-confirm-row').hidden=!options.setup;form.elements.confirm.required=!!options.setup;
  document.querySelector('#noc-password-body-row').hidden=options.body==null;form.elements.body.required=options.body!=null;form.elements.body.value=options.body??'';
  form.elements.password.autocomplete=options.setup?'new-password':'off';
  const result=new Promise(resolve=>{task={options,resolve};});dialog.showModal();form.elements.password.focus();return result;
 }
 prompt.reset=()=>{generation++;busy=false;form.querySelector('[type=submit]').disabled=false;const previous=task;task=null;dialog.close();clear();previous?.resolve(null);};
 return prompt;
}
