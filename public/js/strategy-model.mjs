export const ROLES={frontline:'전선 유지',damage:'화력',control:'방해',utility:'특수 대응'};
export const OUTCOMES={clear:'클리어 기록',failed:'실패 기록',testing:'시도·연구 중'};
export const ITEMS={speed:'스피드 업',radar:'트레저 레이더',rich:'고양이 도령',cpu:'야옹컴',jobs:'고양이 박사',sniper:'스냥이퍼'};
export function validateStrategy(raw,catalog,options,stageKeys){
 if(!raw||!stageKeys.has(raw.stageKey)||!Number.isInteger(raw.crown)||raw.crown<1||raw.crown>4||raw.region!=='kr'||!Object.hasOwn(OUTCOMES,raw.outcome))throw Error('한국판 스테이지·성급·결과를 확인해 주세요.');
 if(!Array.isArray(raw.lineup)||raw.lineup.length<1||raw.lineup.length>10)throw Error('편성은 1~10종을 등록해 주세요.');
 const seen=new Set(),lineup=raw.lineup.map(c=>{
  if(!catalog.some(u=>u.id===c.id&&u.form===c.form)||seen.has(c.id)||!Object.hasOwn(ROLES,c.role)||!Number.isInteger(c.level)||c.level<1||c.level>200||!Number.isInteger(c.plus)||c.plus<0||c.plus>1000)throw Error('중복 캐릭터·레벨·형태·역할을 확인해 주세요.');seen.add(c.id);
  const definitions=options.units.find(u=>u.id===c.id)?.talents||[],talentSeen=new Set();
  if(c.talents!==null&&!Array.isArray(c.talents))throw Error('본능 형식을 확인해 주세요.');
  const talents=c.talents===null?null:c.talents.map(t=>{const d=definitions.find(x=>x.id===t.id);if(!d||talentSeen.has(t.id)||!Number.isInteger(t.level)||t.level<0||t.level>d.maxLevel)throw Error('본능 상한을 확인해 주세요.');talentSeen.add(t.id);return {id:t.id,level:t.level};});
  return {id:c.id,form:c.form,level:c.level,plus:c.plus,role:c.role,talents};
 });
 const treasures={};for(const k of ['world','future','cosmos']){if(!['max','any','unknown'].includes(raw.treasures?.[k]))throw Error('보물 조건을 선택해 주세요.');treasures[k]=raw.treasures[k];}
 if(!Array.isArray(raw.items)||new Set(raw.items).size!==raw.items.length||raw.items.some(k=>!Object.hasOwn(ITEMS,k)))throw Error('아이템 조건을 확인해 주세요.');
 return {schemaVersion:1,stageKey:raw.stageKey,crown:raw.crown,outcome:raw.outcome,region:'kr',lineup,treasures,items:[...raw.items]};
}
export function compareGuide(guide,profile,options=null){
 if(!profile||profile.region!=='kr')return {available:false,reason:'내 정보에 한국판 보유 캐릭터를 저장해 주세요.',slots:[],notes:[]};
 const slots=guide.lineup.map(required=>{
  const owned=profile.cats.find(c=>c.id===required.id),notes=[];if(!owned)return {required,owned:null,notes:['미보유'],distance:1000};
  const totalGap=Math.max(0,required.level+required.plus-owned.level-owned.plus),baseGap=Math.max(0,required.level-owned.level),plusGap=Math.max(0,required.plus-owned.plus);
  if(baseGap)notes.push('기본 레벨 '+baseGap+' 부족');if(plusGap)notes.push('+레벨 '+plusGap+' 부족');if(totalGap)notes.push('총 레벨 '+totalGap+' 부족');
  if(owned.form<required.form)notes.push('현재 선택 형태가 낮음 · 진화 해금 여부 확인');
  let distance=Math.abs(required.level+required.plus-owned.level-owned.plus)+(owned.form<required.form?20:0);
  const missingDefinitions=(options?.units.find(u=>u.id===required.id)?.talents||[]).filter(d=>!required.talents?.some(t=>t.id===d.id)).length;
  if(required.talents===null||missingDefinitions)notes.push('작성자 본능 '+(missingDefinitions?missingDefinitions+'개 ':'')+'미기재');
  for(const t of required.talents||[]){const actual=owned.talents?.find(v=>v.id===t.id);if(!actual){distance+=10;notes.push('본능 #'+t.id+' 내 기록 미확인');}else{distance+=Math.abs(t.level-actual.level)*5;if(t.level>actual.level)notes.push('본능 #'+t.id+' Lv.'+(t.level-actual.level)+' 부족');}}
  return {required,owned:{...owned},notes,distance};
 });
 const notes=['형태는 현재 선택 형태 기준입니다. 최종 진화 해금 여부는 직접 확인해 주세요.','본능 미기재·미확인은 미해방(0)과 다릅니다.'];
 for(const [i,k]of ['world','future','cosmos'].entries()){
  if(guide.treasures[k]==='unknown')notes.push(['세계편','미래편','우주편'][i]+' 보물: 작성자 미기재');
  if(guide.treasures[k]==='max'){
   const progress=profile.progress?.slice(i*3,i*3+3);const maximum=profile.progressKnown!==false&&progress?.length===3&&progress.every(p=>p.gold>=48);
   if(!maximum)notes.push(['세계편','미래편','우주편'][i]+' 최고급 보물 최대 조건: '+(profile.progressKnown===false?'내 기록 미확인':'부족 또는 미확인'));
  }
 }
 if(guide.items.length)notes.push('필요 아이템: '+guide.items.map(k=>ITEMS[k]).join(', ')+' · 보유량과 사용 여부 직접 확인');
 return {available:true,slots,notes,distance:Math.round(slots.reduce((n,s)=>n+s.distance,0)/slots.length*100)/100};
}
export function replacementCandidates(required,profile,catalog,excluded=[]){
 if(profile?.region!=='kr')return [];const source=catalog.find(c=>c.id===required.id&&c.form===required.form);if(!source)return [];
 const blocked=new Set(excluded),sourceAbilities=Object.keys(source.abilities).filter(k=>![24,37].includes(Number(k)));
 return profile.cats.filter(c=>!blocked.has(c.id)&&c.id!==required.id).map(owned=>{
  const unit=catalog.find(c=>c.id===owned.id&&c.form===owned.form);if(!unit)return null;
  if(required.role==='damage'&&!unit.attacks.some(n=>n>0))return null;
  if(required.role==='utility'&&!sourceAbilities.length&&!source.immunity)return null;
  const shared=sourceAbilities.filter(k=>Object.hasOwn(unit.abilities,k)),traitMatch=source.trait===0||(source.trait&unit.trait)!==0;
  if(required.role==='frontline'&&(unit.price>Math.max(400,source.price*1.5)||unit.cooldown>Math.max(300,source.cooldown*1.5)))return null;
  if(required.role==='control'&&!shared.some(k=>[21,22,23,30,33].includes(Number(k))))return null;
  if(required.role==='utility'&&sourceAbilities.length&&!shared.length&&!(source.immunity&unit.immunity))return null;
  if(source.trait&&!traitMatch)return null;
  const reasons=[ROLES[required.role]+' 후보',traitMatch&&source.trait?'기본 대상 속성 공통':'범용 속성 기준'];
  const lost=sourceAbilities.filter(k=>!Object.hasOwn(unit.abilities,k));
  const warnings=['본능으로 추가되는 능력·실전 운용·클리어는 검증하지 않았습니다.'];
  if(lost.length)warnings.push('원본의 기본 능력 #'+lost.join(', #')+' 누락');if(unit.range<source.range)warnings.push('인식 사거리 '+(source.range-unit.range)+' 짧음');
  if((unit.immunity&source.immunity)!==source.immunity)warnings.push('원본 면역 일부 누락');
  return {owned,unit,reasons,warnings,score:shared.length*30+(traitMatch?20:0)-Math.abs(unit.range-source.range)/20-unit.price/1000};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||a.unit.id-b.unit.id).slice(0,3);
}
