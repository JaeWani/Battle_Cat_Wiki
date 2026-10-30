import {saveFixture} from '../tests/helpers/save-fixture.mjs';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
const root=path.resolve('public'),out=path.resolve('artifacts/interface-review');
await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{
  const fixturePath=new URL(req.url,'http://localhost').pathname;
  if(fixturePath==='/__growth_test'){
   res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="growth.css"><button id="growth-switch">Switch account</button><main id="growth-fixture"></main><script type="module">import {initGrowthPlanner} from "./js/growth-planner.mjs";const cats=await fetch("data/cats.json").then(r=>r.json());let account={id:"growth-ui-A"};const planner=initGrowthPlanner({getCatalog:()=>cats,getAccount:()=>account,getSaved:()=>null});document.querySelector("#growth-switch").onclick=()=>{account={id:account.id==="growth-ui-A"?"growth-ui-B":"growth-ui-A"};planner.reset();planner.render(document.querySelector("#growth-fixture"));};planner.render(document.querySelector("#growth-fixture"));</script>');return;
  }
  if(fixturePath==='/__community_test'){
   const html=(await readFile(path.join(root,'index.html'),'utf8')).replace(/<script type="module" src="js\/app.mjs[^>]*><\/script>/,'<script type="module">import {initCommunity} from "./js/__community_test.mjs";document.querySelector("#community-view").hidden=false;initCommunity();</script>');
   res.writeHead(200,{'Content-Type':'text/html'}).end(html);return;
  }
  if(fixturePath==='/js/__community_test.mjs'){
   const source=(await readFile(path.join(root,'js/community.mjs'),'utf8')).replace(/from '\.\/community-config.mjs[^']*'/,"from '/__community_config.mjs'");
   res.writeHead(200,{'Content-Type':'text/javascript'}).end(source);return;
  }
  if(fixturePath==='/__community_config.mjs'){res.writeHead(200,{'Content-Type':'text/javascript'}).end('export const COMMUNITY_CONFIG={url:"/__community_api",sdkURL:"/__community_sdk.mjs"};');return;}
  if(fixturePath==='/__community_sdk.mjs'){res.writeHead(200,{'Content-Type':'text/javascript'}).end(await readFile('tests/helpers/community-browser-fixture.mjs','utf8'));return;}
  if(fixturePath==='/__community_api/auth/v1/settings'){res.writeHead(200,{'Content-Type':'application/json'}).end('{"external":{"google":true}}');return;}
  if(new URL(req.url,'http://localhost').pathname==='/__avatar_test'){
   const index=await readFile(path.join(root,'index.html'),'utf8'),dialog=index.match(/<dialog id="my-avatar-dialog"[\s\S]*?<\/dialog>/)[0];
   const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="command.css"><link rel="stylesheet" href="profile-avatar.css"><button data-avatar-open>Open avatar test</button><output id="avatar-test-saved">c0-0</output>'+dialog+`<script type="module">
    import {initAvatarPicker} from './js/profile-avatar.mjs';import {avatarChoices} from './js/avatar-model.mjs';
    const [cats,enemies]=await Promise.all(['cats','enemies'].map(n=>fetch('data/'+n+'.json').then(r=>r.json()))),choices=avatarChoices(cats,enemies),account={id:'avatar-ui-fixture',status:'active',avatarKey:'c0-0'};
    initAvatarPicker({getChoices:()=>choices,getAccount:()=>account,onSave:async key=>{account.avatarKey=key;document.querySelector('#avatar-test-saved').textContent=key;}});
    document.body.dataset.ready='true';
   </script>`;
   res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'}).end(html);return;
  }
 }catch{res.writeHead(500).end();return;}
 try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const temp=await mkdtemp(path.join(os.tmpdir(),'noc-chrome-'));
const chrome=spawn(process.env.CHROME_BIN||'google-chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-port=0','--user-data-dir='+temp],{stdio:['ignore','ignore','pipe']});
let ws;const report=[];let fatal;
try{
 const endpoint=await new Promise((resolve,reject)=>{
  let text='';const timer=setTimeout(()=>reject(new Error('Chrome startup timeout')),15000);
  chrome.on('error',reject);chrome.stderr.on('data',b=>{text+=b;const m=text.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
 });
 ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let seq=0;const pending=new Map();
 ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(new Error(JSON.stringify(m.error)));else p.resolve(m.result);}});
 const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timeout'));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
 const {targetId}=await command('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
 await command('Page.enable',{},sessionId);await command('Runtime.enable',{},sessionId);
 const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const cases=[['home',1440],['stages',1440],['calculator',1440],['cats',1440],['enemies',1440],['community',1440],['profile',1440],['about',1440],['home',390],['calculator',390],['cats',390],['profile',390]];
 for(const [view,width]of cases){
  const height=width===390?1000:1100;
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600},sessionId);
  await command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/#'+view},sessionId);
  let ready=false;const limit=Date.now()+20000;
  while(Date.now()<limit){
   ready=await evaluate("document.querySelector('#footer-version')?.textContent.startsWith('JP ') && ("+JSON.stringify(view)+"==='about' || [...document.querySelectorAll('.nav-button')].some(e=>e.dataset.view==="+JSON.stringify(view)+" && e.getAttribute('aria-current')==='page')) && getComputedStyle(document.querySelector('.site-header')).backgroundColor==='rgb(17, 30, 48)'");
   if(ready)break;await new Promise(r=>setTimeout(r,200));
  }
  await new Promise(r=>setTimeout(r,350));
  const info=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,title:document.title,active:[...document.querySelectorAll('main>.view')].filter(e=>!e.hidden).map(e=>e.id),copy:[...document.querySelectorAll('main h1, main h2')].filter(e=>e.getClientRects().length).map(e=>e.textContent).join(' '),offenders:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2&&!e.closest('dialog')&&getComputedStyle(e).position!=='fixed'}).slice(0,8).map(e=>({tag:e.tagName,class:e.className,right:Math.round(e.getBoundingClientRect().right)}))})`);
  const expected=['cats','enemies'].includes(view)?'catalog-view':view+'-view';
  const issues=[];if(!ready)issues.push('route did not initialize');if(info.width!==width)issues.push('viewport mismatch');if(info.scrollWidth>width+1)issues.push('horizontal document overflow');if(info.active.length!==1||info.active[0]!==expected)issues.push('wrong active view');
  for(const phrase of ['나의 부대를','몇 대면 이길까','놓치지 말자냥','기다리고 있을까','숫자에도 출처가','상대를 알면, 공략이'])if(info.copy.includes(phrase))issues.push('promotional copy: '+phrase);
  const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);
  await writeFile(path.join(out,view+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
  const row={view,width,ready,scrollWidth:info.scrollWidth,active:info.active,issues,offenders:info.offenders};report.push(row);console.log(JSON.stringify(row));
 }

 // Exercise the real browser file input and module worker with a synthetic prefix fixture.
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true},sessionId);
 await command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/#profile'},sessionId);
 for(let i=0;i<60;i++){if(await evaluate("!!document.querySelector('[data-profile=import]') && !document.querySelector('#profile-view').hidden"))break;await new Promise(r=>setTimeout(r,100));}
 await evaluate("document.querySelector('[data-profile=import]').click()");
 const fixture=saveFixture();
 await evaluate("(()=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array("+JSON.stringify([...fixture])+")],'SAVE_DATA'));const i=document.querySelector('#my-save-file');i.files=d.files;i.dispatchEvent(new Event('change',{bubbles:true}));})()");
 let imported=false;
 for(let i=0;i<80;i++){imported=await evaluate("!!document.querySelector('.my-import-summary')");if(imported)break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(imported,'Synthetic file did not reach the import preview');
 const previewText=await evaluate("document.querySelector('.my-import-summary').innerText");
 assert.ok(previewText.includes('2종')&&previewText.includes('15.5.0')&&previewText.includes('Lv. 20'),'Preview values mismatch');
 assert.equal(await evaluate("document.querySelectorAll('#my-inventory .my-cat').length"),0,'Preview persisted without confirmation');
 const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);
 await writeFile(path.join(out,'save-import-preview-390.png'),Buffer.from(shot.data,'base64'));
 await evaluate("(()=>{const d=new DataTransfer();d.items.add(new File(['bad'],'SAVE_DATA'));const i=document.querySelector('#my-save-file');i.files=d.files;i.dispatchEvent(new Event('change',{bubbles:true}));})()");
 let rejected=false;for(let i=0;i<60;i++){rejected=await evaluate("!!document.querySelector('#my-import-error')?.textContent");if(rejected)break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(rejected,'Invalid save did not produce an error');
 assert.equal(await evaluate("document.querySelectorAll('.my-import-summary').length"),0,'Invalid selection retained prior preview');
 await evaluate("document.querySelector('#my-import-dialog [data-profile=close-import]').click()");
 console.log('Verified browser file input, module worker, preview values, no unconfirmed persistence, and invalid-file rejection with synthetic data.');

 // Exercise manual editing through the real form, including filters and unknown talent levels.
 for(const width of [1440,390]){
  await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600},sessionId);
  await evaluate("document.querySelector('[data-profile=manual]').click()");
  for(let i=0;i<60;i++){if(await evaluate("document.querySelector('#my-editor-dialog').open"))break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(await evaluate("document.querySelector('#my-editor-dialog').open"),'Manual editor did not open');
  assert.ok((await evaluate("document.querySelector('#my-editor-count').innerText")).includes('882'),'Incomplete character catalog');
  await evaluate("(()=>{const c=document.querySelector('[data-edit-cat=\"9\"] [data-cat-field=owned]');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await evaluate("(()=>{const i=document.querySelector('[data-edit-cat=\"9\"] [data-cat-field=level]');i.value='45';i.dispatchEvent(new Event('input',{bubbles:true}));const t=document.querySelector('[data-edit-cat=\"9\"] [data-talent-id]');t.value='4';t.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await evaluate("(()=>{const i=document.querySelector('#my-editor-search');i.value='NO MATCH';i.dispatchEvent(new Event('input',{bubbles:true}));i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));})()");
  assert.equal(await evaluate("document.querySelector('[data-edit-cat=\"9\"] [data-cat-field=level]').value"),'45','Filtering lost a draft level');
  assert.equal(await evaluate("document.querySelector('[data-edit-cat=\"9\"] [data-talent-id]').value"),'4','Filtering lost a talent selection');
  assert.ok(await evaluate("document.querySelector('#my-editor-save').disabled"),'Consent gate missing');
  const overflow=await evaluate("(()=>{const d=document.querySelector('#my-editor-dialog');return d.scrollWidth>d.clientWidth+1;})()");
  assert.equal(overflow,false,'Manual editor has horizontal overflow');
  await evaluate("(()=>{const i=document.querySelector('#my-editor-owned');i.value='owned';i.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-edit-cat=\"9\"] details').open=true;})()");
  const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);
  await writeFile(path.join(out,'manual-editor-'+width+'.png'),Buffer.from(shot.data,'base64'));
  // Cancel remains a draft-only action; discard via native dialog confirmation.
  const closing=evaluate("document.querySelector('[data-manual=close]').click();true");
  await new Promise(r=>setTimeout(r,100));
  const jsDialog=await command('Page.handleJavaScriptDialog',{accept:true},sessionId);void jsDialog;await closing;
  assert.equal(await evaluate("document.querySelectorAll('#my-inventory .my-cat').length"),0,'Manual draft persisted without account save');
 }
 console.log('Verified manual editor at desktop/mobile widths: full catalog, ownership, levels, talents, filter retention, consent and cancellation.');
 // Avatar selection uses the full original-artwork catalog and does not save on cancel.
 for(const width of [1440,390]){
  await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600},sessionId);
  const opener=await evaluate("(()=>{const b=document.querySelector('[data-avatar-open]');if(!b.getClientRects().length)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  assert.ok(opener,'Profile photo controls are hidden at '+width+'px');
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...opener},sessionId);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...opener},sessionId);
  assert.ok(await evaluate("document.querySelector('#my-avatar-dialog').open"),'Avatar picker did not open');
  assert.ok((await evaluate("document.querySelector('#my-avatar-count').textContent")).startsWith('2177'),'Ally evolution choices missing');
  await evaluate("document.querySelector('[data-avatar-kind=enemy]').click()");
  assert.ok((await evaluate("document.querySelector('#my-avatar-count').textContent")).startsWith('792'),'Enemy choices missing');
  await evaluate("(()=>{const i=document.querySelector('#my-avatar-search');i.value='e24';i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-avatar-key=e24]').click();})()");
  assert.ok(await evaluate("document.querySelector('#my-avatar-preview img').getAttribute('src').startsWith('assets/e/24/')"),'Enemy preview missing');
  assert.ok(await evaluate("document.querySelector('#my-avatar-save').disabled"),'Anonymous avatar save enabled');
  const overflow=await evaluate("(()=>{const d=document.querySelector('#my-avatar-dialog');return d.scrollWidth>d.clientWidth+1;})()");assert.equal(overflow,false,'Avatar dialog overflow');
  const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);await writeFile(path.join(out,'avatar-picker-'+width+'.png'),Buffer.from(shot.data,'base64'));
  await evaluate("document.querySelector('#my-avatar-dialog [data-avatar-action=close]').click();document.querySelector('[data-avatar-open]').click()");
  assert.ok(await evaluate("document.querySelector('#my-avatar-preview img').getAttribute('src').endsWith('/u/0/0.png')"),'Cancel changed saved avatar');
  await evaluate("document.querySelector('#my-avatar-dialog [data-avatar-action=close]').click()");
 }
 // The real picker module also exercises its save adapter and reload state in an isolated UI fixture.
 await command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/__avatar_test'},sessionId);
 for(let i=0;i<80;i++){if(await evaluate("document.body?.dataset.ready==='true'"))break;await new Promise(r=>setTimeout(r,100));}
 for(const key of ['c25-2','e24','c0-0']){
  await evaluate("document.querySelector('[data-avatar-open]').click()");
  await evaluate("document.querySelector('[data-avatar-kind="+(key[0]==='e'?'enemy':'cat')+"]').click()");
  await evaluate("(()=>{const i=document.querySelector('#my-avatar-search');i.value="+JSON.stringify(key)+";i.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-avatar-key=\""+key+"\"]').click();document.querySelector('#my-avatar-save').click();})()");
  for(let i=0;i<50;i++){if(await evaluate("!document.querySelector('#my-avatar-dialog').open"))break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(await evaluate("document.querySelector('#avatar-test-saved').textContent"),key,'Avatar save adapter received wrong identifier');
 }
 console.log('Verified avatar picker: ally/enemy search and preview, desktop/mobile layout, anonymous gate, cancel and ally/enemy/default save roundtrips with an isolated adapter.');
 // Use the production community module and forms with an isolated authenticated adapter.
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true},sessionId);
 await command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/__community_test#community'},sessionId);
 const waitFor=async expression=>{for(let i=0;i<80;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Community UI timeout: '+expression);};
 await waitFor('!!globalThis.nocFixture && !!document.querySelector("#noc-feed [data-noc=compose]")');
 await evaluate('document.querySelector("#noc-feed [data-noc=compose]").click()');
 await waitFor('document.querySelector("#noc-password-dialog").open');
 assert.ok(await evaluate('document.querySelector("#noc-password-form").elements.password.required'),'Creation password optional');
 await evaluate('(()=>{const f=document.querySelector("#noc-password-form");f.elements.password.value="test-pass";f.elements.confirm.value="different";f.requestSubmit();})()');
 await waitFor('!!document.querySelector("#noc-password-error").textContent');
 assert.equal(await evaluate('nocFixture.calls.filter(c=>c.action==="create_post").length'),0,'Mismatched confirmation created draft');
 await evaluate('(()=>{const f=document.querySelector("#noc-password-form");f.elements.confirm.value="test-pass";f.requestSubmit();})()');
 await waitFor('!!document.querySelector("#noc-editor")');
 assert.equal(await evaluate('document.querySelector("#noc-password-form").elements.password.value'),'','Closed dialog retained password');
 await evaluate('(()=>{const f=document.querySelector("#noc-editor");f.elements.title.value="브라우저 테스트";f.elements.body.value="테스트 본문";f.requestSubmit();})()');
 await waitFor('!!document.querySelector(".noc-comment-form")');
 assert.ok(await evaluate('document.querySelector(".noc-comment-form").elements.password.required'),'Comment password optional');
 await evaluate('(()=>{const f=document.querySelector(".noc-comment-form");f.elements.body.value="등록 댓글";f.requestSubmit();})()');
 assert.equal(await evaluate('nocFixture.calls.filter(c=>c.action==="comment").length'),0,'Blank comment password submitted');
 await evaluate('(()=>{const f=document.querySelector(".noc-comment-form");f.elements.password.value="test-pass";f.requestSubmit();})()');
 await waitFor('!!document.querySelector(".noc-comment [data-noc=edit-comment]")');
 assert.equal(await evaluate('document.querySelector(".noc-comment-form").elements.password.value'),'','Comment password retained after creation');
 await evaluate('document.querySelector("[data-noc=edit-comment]").click()');
 await waitFor('document.querySelector("#noc-password-dialog").open');
 assert.ok(await evaluate('document.querySelector("#noc-password-confirm-row").hidden'),'Edit unexpectedly resets password');
 await evaluate('(()=>{const f=document.querySelector("#noc-password-form");f.elements.password.value="wrong-pass";f.elements.body.value="수정 댓글";f.requestSubmit();})()');
 await waitFor('!!document.querySelector("#noc-password-error").textContent');
 assert.equal(await evaluate('document.querySelector(".noc-comment p").textContent'),'등록 댓글','Wrong password changed visible comment');
 assert.ok(await evaluate('document.querySelector("#noc-password-dialog").open'),'Failed verification closed dialog');
 assert.equal(await evaluate('(()=>{const d=document.querySelector("#noc-password-dialog");return d.scrollWidth>d.clientWidth+1;})()'),false,'Password dialog mobile overflow');
 const passwordShot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);await writeFile(path.join(out,'content-password-390.png'),Buffer.from(passwordShot.data,'base64'));
 await evaluate('(()=>{const f=document.querySelector("#noc-password-form");f.elements.password.value="test-pass";f.requestSubmit();})()');
 await waitFor('!document.querySelector("#noc-password-dialog").open');
 assert.equal(await evaluate('document.querySelector(".noc-comment p").textContent'),'수정 댓글');
 await evaluate('document.querySelector("[data-noc=delete-comment]").click()');await waitFor('document.querySelector("#noc-password-dialog").open');
 await evaluate('document.querySelector("#noc-password-form").elements.password.value="test-pass";document.querySelector("#noc-password-form").requestSubmit()');
 await waitFor('!document.querySelector(".noc-comment [data-noc=delete-comment]")');
 await evaluate('document.querySelector("[data-noc=edit-post]").click()');await waitFor('document.querySelector("#noc-password-dialog").open');
 await evaluate('document.querySelector("#noc-password-form").elements.password.value="test-pass";document.querySelector("#noc-password-cancel").click()');
 assert.equal(await evaluate('document.querySelector("#noc-password-form").elements.password.value'),'','Cancel retained password');
 assert.equal(await evaluate('!!document.querySelector("#noc-editor")'),false,'Canceled verification opened editor');
 await evaluate('document.querySelector("[data-noc=delete-post]").click()');await waitFor('document.querySelector("#noc-password-dialog").open');
 await evaluate('document.querySelector("#noc-password-form").elements.password.value="test-pass";document.querySelector("#noc-password-form").requestSubmit()');
 await waitFor('!document.querySelector("#noc-password-dialog").open && !document.querySelector(".noc-post-detail")');
 await evaluate('document.querySelector("#noc-feed [data-noc=compose]").click()');await waitFor('document.querySelector("#noc-password-dialog").open');
 await evaluate('document.querySelector("#noc-password-form").elements.password.value="test-pass";nocFixture.changeAccount()');
 await waitFor('!document.querySelector("#noc-password-dialog").open');
 assert.equal(await evaluate('document.querySelector("#noc-password-form").elements.password.value'),'','Account change retained password');
 assert.equal(await evaluate('Object.values(localStorage).some(v=>v.includes("test-pass")) || location.href.includes("test-pass")'),false,'Password persisted outside memory');
 console.log('Verified production post/comment forms: password and confirmation gates, create/save/edit/delete, wrong-password retry, mobile layout, cancel/account-change clearing and no URL/localStorage persistence with an isolated adapter.');
 // Growth plans use the real profile tab, source data and browser storage.
 for(const width of [1440,390]){
  await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600},sessionId);
  await command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/#profile'},sessionId);
  await waitFor('document.querySelector("#footer-version")?.textContent.startsWith("JP ") && !!document.querySelector("[data-profile-tab=growth]")');
  await evaluate('localStorage.removeItem("noc-growth-v1:guest");document.querySelector("[data-profile-tab=progress]").click();document.querySelector("[data-profile-tab=progress]").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}))');
  assert.ok(await evaluate('document.querySelector("[data-profile-tab=growth]").getAttribute("aria-selected")==="true"'),'Arrow keys skipped the growth tab');
  await waitFor('!!document.querySelector("#growth-goal-form")');
  await evaluate('(()=>{const f=document.querySelector("#growth-goal-form");f.elements.id.value="32";f.elements.id.dispatchEvent(new Event("change"));f.elements.currentLevel.value="29";f.elements.currentForm.value="1";f.elements.targetLevel.value="30";f.elements.targetForm.value="2";f.requestSubmit();})()');
  assert.equal(await evaluate('document.querySelectorAll(".growth-goal").length'),1,'Growth goal not created');
  assert.ok((await evaluate('document.querySelector(".growth-table").textContent')).includes('1,394,000'),'Level plus evolution XP missing');
  await evaluate('(()=>{const f=document.querySelector("#growth-stock-form");f.elements.xp.value="500000";f.elements.namedItem("35").value="2";f.requestSubmit();})()');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("noc-growth-v1:guest")).stock.xp'),500000,'Material stock not persisted');
  assert.ok(await evaluate('document.querySelector(".growth-destination a")?.href.startsWith("https://ponosgames.com/")'),'Official destination link missing');
  assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,'Growth planner page overflow');
  await evaluate('document.querySelector(".growth-panel").scrollIntoView({block:"start"});window.scrollBy(0,-130)');
  const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);await writeFile(path.join(out,'growth-planner-'+width+'.png'),Buffer.from(shot.data,'base64'));
  await command('Page.reload',{},sessionId);
  await waitFor('document.querySelector("#footer-version")?.textContent.startsWith("JP ") && !!document.querySelector("[data-profile-tab=growth]")');
  await evaluate('document.querySelector("[data-profile-tab=growth]").click()');await waitFor('!!document.querySelector(".growth-goal")');
  assert.equal(await evaluate('document.querySelector("#growth-stock-form").elements.xp.value'),'500000','Reload lost stock');
  await evaluate('document.querySelector("[data-growth=remove]").click()');assert.equal(await evaluate('document.querySelectorAll(".growth-goal").length'),0,'Remove goal failed');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("noc-growth-v1:guest")).stock.xp'),500000,'Removing a goal spent inventory');
 }
 await command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/__growth_test'},sessionId);await waitFor('!!document.querySelector("#growth-goal-form")');
 await evaluate('(()=>{const f=document.querySelector("#growth-goal-form");f.elements.id.value="32";f.elements.id.dispatchEvent(new Event("change"));f.elements.currentLevel.value="29";f.elements.targetLevel.value="30";f.requestSubmit();})()');
 await evaluate('document.querySelector("#growth-switch").click()');await waitFor('!!document.querySelector("#growth-goal-form")');assert.equal(await evaluate('document.querySelectorAll(".growth-goal").length'),0,'Plan leaked between accounts');
 await evaluate('document.querySelector("#growth-switch").click()');await waitFor('!!document.querySelector(".growth-goal")');
 assert.equal(await evaluate('document.querySelectorAll(".growth-goal").length'),1,'Account switch lost original plan');
 await evaluate('Storage.prototype.setItem=function(){throw new DOMException("Quota exceeded","QuotaExceededError")};document.querySelector("#growth-stock-form").requestSubmit()');
 assert.ok((await evaluate('document.querySelector("#growth-feedback").textContent')).includes('저장에 실패'),'Storage failure was silent');
 console.log('Verified growth planner: production desktop/mobile profile tab, evolution/level costs, stock and deficit persistence, reload, non-destructive removal, official source links, account isolation and storage failure feedback.');
 await command('Network.enable',{},sessionId);await command('Network.setBlockedURLs',{urls:['*data/growth.json*']},sessionId);
 await command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/__growth_test?retry=1'},sessionId);await waitFor('!!document.querySelector("[data-growth=retry]")');
 await command('Network.setBlockedURLs',{urls:[]},sessionId);await evaluate('document.querySelector("[data-growth=retry]").click()');await waitFor('!!document.querySelector("#growth-goal-form")');
 console.log('Verified growth data network failure and successful retry.');
 // Publish structured guides through the real password-protected community editor.
 await command('Network.setBlockedURLs',{urls:[]},sessionId);
 await command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/__community_test#community'},sessionId);
 await waitFor('!!globalThis.nocFixture && !!document.querySelector("#noc-feed [data-noc=compose]")');
 const publishStrategy=async(id,title,level,plus)=>{
  await evaluate('document.querySelector("[data-noc=compose-guide]").click()');await waitFor('document.querySelector("#noc-password-dialog").open');
  await evaluate('(()=>{const f=document.querySelector("#noc-password-form");f.elements.password.value="test-pass";f.elements.confirm.value="test-pass";f.requestSubmit();})()');
  await waitFor('!!document.querySelector(".strategy-enable") && !document.querySelector("#noc-editor [type=submit]").disabled');
  await evaluate('(()=>{const f=document.querySelector("#noc-editor"),c=f.querySelector(".strategy-enable");c.checked=true;c.dispatchEvent(new Event("change"));f.elements.title.value='+JSON.stringify(title)+';f.elements.body.value="도전 조건과 운용 순서를 기록한 테스트 공략";f.querySelector(".strategy-stage").value="S250-0";const unit=f.querySelector(".strategy-cat");unit.value="'+id+'";unit.dispatchEvent(new Event("change"));f.querySelector(".strategy-form").value="2";f.querySelector(".strategy-level").value="'+level+'";f.querySelector(".strategy-plus").value="'+plus+'";f.querySelector(".strategy-public-consent").checked=true;})()');
  await evaluate('document.querySelector(".strategy-editor").scrollIntoView({block:"start"});window.scrollBy(0,-130)');
  const editorShot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);await writeFile(path.join(out,'strategy-editor-'+id+'.png'),Buffer.from(editorShot.data,'base64'));
  await evaluate('document.querySelector("#noc-editor").requestSubmit()');
  await waitFor('!!document.querySelector(".strategy-compare")');
 };
 await publishStrategy(0,'대체 후보가 필요한 공략',20,10);
 assert.ok(await evaluate('nocFixture.calls.some(c=>c.action==="save_post" && c.password==="test-pass" && c.strategy?.publishAccepted===true && c.strategy?.stageKey==="S250-0")'),'Guide publication bypassed password or consent');
 await evaluate('document.querySelector(".strategy-compare").click()');await waitFor('!!document.querySelector("[data-strategy-replace]")');
 assert.ok((await evaluate('document.querySelector(".strategy-comparison").textContent')).includes('미보유'),'Missing unit not explained');
 await evaluate('document.querySelector("[data-strategy-replace]").click()');assert.ok((await evaluate('document.querySelector(".strategy-comparison").textContent')).includes('1 / 1 슬롯'),'Replacement did not populate the draft');
 assert.equal(await evaluate('nocFixture.calls.filter(c=>c.action==="save_game_profile").length'),0,'Adapting a guide changed the game profile');
 await evaluate('document.querySelector(".strategy-comparison").scrollIntoView({block:"start"});window.scrollBy(0,-130)');
 const compareShot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);await writeFile(path.join(out,'strategy-comparison-390.png'),Buffer.from(compareShot.data,'base64'));
 await publishStrategy(32,'내 조건에 가까운 공략',30,0);
 await evaluate('document.querySelector("[data-noc=guide-browser]").click()');await waitFor('document.querySelectorAll(".strategy-result").length===2');
 await evaluate('(()=>{const s=document.querySelector(".strategy-search").elements.sort;s.value="similar";s.dispatchEvent(new Event("change"));})()');
 await waitFor('!!nocFixture.calls.find(c=>c.action==="list_guides" && c.similar===true) && document.querySelectorAll(".strategy-result").length===2');
 assert.ok((await evaluate('document.querySelector(".strategy-result h3").textContent')).includes('가까운'),'Similar condition sorting failed');
 await evaluate('(()=>{const s=document.querySelector(".strategy-search").elements.outcome;s.value="failed";s.dispatchEvent(new Event("change"));})()');await waitFor('!!document.querySelector(".strategy-empty")');
 await evaluate('(()=>{const s=document.querySelector(".strategy-search").elements.outcome;s.value="clear";s.dispatchEvent(new Event("change"));})()');await waitFor('document.querySelectorAll(".strategy-result").length===2');
 assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,'Strategy search mobile overflow');
 for(const width of [1440,390]){
  await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600},sessionId);
  await evaluate('document.querySelector(".strategy-browser").scrollIntoView({block:"start"});window.scrollBy(0,-130)');
  const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);await writeFile(path.join(out,'strategy-search-'+width+'.png'),Buffer.from(shot.data,'base64'));
 }
 await evaluate('document.querySelector(".strategy-result [data-noc=post]").click()');await waitFor('!!document.querySelector(".strategy-compare")');
 await evaluate('document.querySelector(".strategy-compare").click()');await waitFor('!!document.querySelector(".strategy-comparison h4")');
 await evaluate('nocFixture.changeAccount()');await waitFor('document.querySelector(".strategy-comparison").textContent===""');
 console.log('Verified structured guide editor/consent/password publication, own-profile comparison, replacement draft without profile writes, similarity sorting, outcome filters, responsive search and account-change privacy clearing.');
 await command('Target.closeTarget',{targetId});
 assert.ok(report.every(r=>r.issues.length===0),'Interface layout failures; inspect interface-review/report.json');
}catch(error){fatal=error;}
finally{
 await writeFile(path.join(out,'report.json'),JSON.stringify({cases:report,error:fatal?.message||null},null,2));
 if(ws)ws.close();chrome.kill('SIGTERM');server.close();
 await new Promise(r=>setTimeout(r,300));await rm(temp,{recursive:true,force:true}).catch(()=>{});
}
if(fatal)throw fatal;
console.log('Verified '+report.length+' desktop/mobile route layouts in Chrome.');
