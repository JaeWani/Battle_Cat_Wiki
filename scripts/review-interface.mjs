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
   ready=await evaluate("document.querySelector('#footer-version')?.textContent.startsWith('JP ') && [...document.querySelectorAll('.nav-button')].some(e=>e.dataset.view==="+JSON.stringify(view)+" && e.getAttribute('aria-current')==='page') && getComputedStyle(document.querySelector('.site-header')).backgroundColor==='rgb(17, 30, 48)'");
   if(ready)break;await new Promise(r=>setTimeout(r,200));
  }
  await new Promise(r=>setTimeout(r,350));
  const info=await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,title:document.title,active:[...document.querySelectorAll('main>.view')].filter(e=>!e.hidden).map(e=>e.id),copy:document.body.innerText,offenders:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2&&!e.closest('dialog')&&getComputedStyle(e).position!=='fixed'}).slice(0,8).map(e=>({tag:e.tagName,class:e.className,right:Math.round(e.getBoundingClientRect().right)}))})`);
  const expected=['cats','enemies'].includes(view)?'catalog-view':view+'-view';
  const issues=[];if(!ready)issues.push('route did not initialize');if(info.width!==width)issues.push('viewport mismatch');if(info.scrollWidth>width+1)issues.push('horizontal document overflow');if(info.active.length!==1||info.active[0]!==expected)issues.push('wrong active view');
  for(const phrase of ['나의 부대를','몇 대면 이길까','놓치지 말자냥','기다리고 있을까','숫자에도 출처가','상대를 알면, 공략이'])if(info.copy.includes(phrase))issues.push('promotional copy: '+phrase);
  const shot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true},sessionId);
  await writeFile(path.join(out,view+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
  const row={view,width,ready,scrollWidth:info.scrollWidth,active:info.active,issues,offenders:info.offenders};report.push(row);console.log(JSON.stringify(row));
 }
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
