import {eventStatus,isStale,kstDay,onDay} from './events.mjs';
export const MAX_GOALS=24;
export function whole(value,min,max,label='값'){
 const n=typeof value==='number'?value:typeof value==='string'&&/^\d+$/.test(value)?Number(value):NaN;
 if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error(label+' 범위를 확인해 주세요.');return n;
}
export function validGoal(raw,data){
 const id=whole(raw.id,0,9999,'캐릭터'),unit=data.units.find(u=>u.id===id);if(!unit)throw new Error('미등록 캐릭터입니다.');
 const currentLevel=whole(raw.currentLevel,1,unit.maxBaseLevel,'현재 레벨'),targetLevel=whole(raw.targetLevel,currentLevel,unit.maxBaseLevel,'목표 레벨');
 const currentForm=whole(raw.currentForm,0,unit.forms-1,'현재 진화'),targetForm=whole(raw.targetForm,currentForm,unit.forms-1,'목표 진화');
 return {id,currentLevel,currentForm,targetLevel,targetForm};
}
export function validPlan(raw,data){
 if(raw?.version!==1||!Array.isArray(raw.goals)||raw.goals.length>MAX_GOALS)throw new Error('저장된 계획 형식을 확인해 주세요.');
 const goals=raw.goals.map(g=>validGoal(g,data));if(new Set(goals.map(g=>g.id)).size!==goals.length)throw new Error('중복된 목표입니다.');
 if(!raw.stock||typeof raw.stock!=='object'||Array.isArray(raw.stock))throw new Error('보유 재료 형식이 잘못되었습니다.');
 const stock={};for(const m of data.materials)if(Object.hasOwn(raw.stock,m.id))stock[m.id]=whole(raw.stock[m.id],0,1e12,'보유량');
 return {version:1,goals,stock};
}
export function goalCost(goal,data,saved=null){
 const unit=data.units.find(u=>u.id===goal.id),actual=saved?.cats?.find(c=>c.id===goal.id);
 const current=actual?{level:actual.level,form:Math.max(actual.form,goal.currentForm)}:{level:goal.currentLevel,form:goal.currentForm};
 const costs={},notes=[];let complete=true;
 const add=(k,v)=>{costs[k]=(costs[k]||0)+v;};
 const done=current.level>=goal.targetLevel&&current.form>=goal.targetForm;
 if(done)return {costs,notes,current,fromProfile:!!actual,done,complete};
 if(!unit.xpCurve||goal.targetLevel>50){complete=false;notes.push('레벨 51 이상 XP 또는 레벨업 자료 미확인: 확인된 구간만 합산');}
 if(goal.targetLevel>30&&current.level<goal.targetLevel){complete=false;notes.push('캣츠아이·레벨 해방 조건 및 비용은 별도 확인 필요');}
 for(let lv=current.level;lv<Math.min(goal.targetLevel,50);lv++)if(unit.xpCurve)add('xp',unit.xpCurve[lv%10]*data.xpMultipliers[Math.floor(lv/10)]);
 for(let form=current.form+1;form<=goal.targetForm;form++){
  const recipe=unit.recipes[form];if(!recipe){complete=false;notes.push((form+1)+'진화의 해금 조건·비용 자료 미확인');continue;}
  for(const [key,n]of Object.entries(recipe))add(key,n);
 }
 if(goal.targetForm>current.form){complete=false;notes.push('진화 필요 레벨·클리어 조건은 게임에서 확인해 주세요. 재료 비용만 계산합니다.');}
 return {costs,notes,current,fromProfile:!!actual,done,complete};
}
export function requirements(plan,data,saved){
 const goals=plan.goals.map(g=>({...g,...goalCost(g,data,saved)})),totals={};
 for(const g of goals)for(const [key,n]of Object.entries(g.costs))totals[key]=(totals[key]||0)+n;
 const materials=Object.entries(totals).map(([id,required])=>({id,required,owned:plan.stock[id]||0,missing:Math.max(0,required-(plan.stock[id]||0))}));
 return {goals,materials,complete:goals.every(g=>g.complete)};
}
// Only explicitly reviewed map→notice links are eligible. No keyword schedule inference.
export function destinationStatus(destination,data,snapshot,now=new Date()){
 const link=data.scheduleLinks.find(l=>l.mapCode===destination.mapCode);
 if(!link)return {code:'unknown',label:'개방 미확인',notice:null};
 if(!snapshot||isStale(snapshot.collectedAt,now)||Date.parse(snapshot.collectedAt)>new Date(now).getTime()+300000||snapshot.region!=='KR'||snapshot.collectionErrors?.length)return {code:'stale',label:'일정 갱신 지연 · 재확인 필요',notice:null};
 const notices=snapshot.events.filter(e=>e.category==='event'&&e.region==='KR'&&e.title===link.noticeTitle);
 const statusOrder={ongoing:0,recurring:1,upcoming:2,notice:3,ended:4};
 const event=notices.sort((a,b)=>(statusOrder[eventStatus(a,now)]??9)-(statusOrder[eventStatus(b,now)]??9))[0];
 if(!event)return {code:'unknown',label:'개방 미확인',notice:null};
 if(event.period&&(!Number.isFinite(Date.parse(event.period.startAt))||!Number.isFinite(Date.parse(event.period.endAt))||Date.parse(event.period.startAt)>=Date.parse(event.period.endAt)))return {code:'unknown',label:'기간 자료 미확인',notice:null};
 if(event.recurrence){const today=onDay(event,kstDay(now));return {code:today?'day':'other-day',label:today?'오늘 개최일 · 시간 확인 필요':'오늘은 공지된 반복 개최일 아님',notice:event};}
 const code=eventStatus(event,now);return {code,label:{ongoing:'공식 공지 기간 내',upcoming:'개최 예정',ended:'공지 기간 종료',notice:'기간 미확인'}[code],notice:event};
}
export function activityCandidates(material,data,snapshot,now=new Date()){
 const order={ongoing:0,day:1,upcoming:2,unknown:3,stale:4,'other-day':5,notice:6,ended:7};
 return data.destinations.filter(d=>d.materials.includes(material)).map(d=>({...d,availability:destinationStatus(d,data,snapshot,now)})).sort((a,b)=>(order[a.availability.code]??9)-(order[b.availability.code]??9)||(a.energy??Infinity)-(b.energy??Infinity)||a.stageKey.localeCompare(b.stageKey));
}
