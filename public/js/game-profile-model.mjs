// Missing talent entries mean unknown; level 0 explicitly means not unlocked.
export function groupCharacters(catalog, options){
 const groups=new Map();
 for(const unit of catalog){
  if(!groups.has(unit.id))groups.set(unit.id,{id:unit.id,rarity:unit.rarity,forms:[],talents:[]});
  groups.get(unit.id).forms.push(unit);
 }
 for(const group of groups.values()){
  group.forms.sort((a,b)=>a.form-b.form);
  group.talents=options.units.find(u=>u.id===group.id)?.talents||[];
  group.search=[group.id,...group.forms.flatMap(f=>[f.name,f.nameJP,f.nameEN])].join(' ').toLowerCase();
 }
 return [...groups.values()].sort((a,b)=>a.id-b.id);
}
export function createGameDraft(saved){
 return {schemaVersion:2,source:saved?(saved.source==='manual'?'manual':'mixed'):'manual',gameVersion:saved?.gameVersion??null,region:saved?.region||'kr',progressKnown:saved?.progressKnown??!!saved,progress:structuredClone(saved?.progress||Array.from({length:9},()=>({progress:0,cleared:0,gold:0}))),cats:new Map((saved?.cats||[]).map(c=>[c.id,{...structuredClone(c),owned:true}]))};
}
export function draftCat(draft,group){
 if(!draft.cats.has(group.id))draft.cats.set(group.id,{id:group.id,form:group.forms[0].form,level:1,plus:0,talents:null,owned:false});
 return draft.cats.get(group.id);
}
export function validateGameDraft(draft,groups){
 const known=new Map(groups.map(g=>[g.id,g]));
 const cats=[];
 for(const cat of draft.cats.values()){
  if(!cat.owned)continue;
  const group=known.get(cat.id);
  if(!group||!group.forms.some(f=>f.form===cat.form))throw new Error('도감에 없는 캐릭터 형태입니다.');
  if(!Number.isInteger(cat.level)||cat.level<1||cat.level>200||!Number.isInteger(cat.plus)||cat.plus<0||cat.plus>1000)throw new Error(group.forms[0].name+': 기본 레벨(1~200)과 +레벨(0~1000)을 확인해 주세요.');
  const seen=new Set();
  const talents=cat.talents==null?null:cat.talents.map(t=>{
   const definition=group.talents.find(d=>d.id===t.id);
   if(!definition||seen.has(t.id)||!Number.isInteger(t.level)||t.level<0||t.level>definition.maxLevel)throw new Error(group.forms[0].name+': 본능 레벨을 확인해 주세요.');
   seen.add(t.id);return {id:t.id,level:t.level};
  });
  cats.push({id:cat.id,form:cat.form,level:cat.level,plus:cat.plus,talents});
 }
 return {...draft,cats:cats.sort((a,b)=>a.id-b.id)};
}
export function importTalentChoices(parsed,previous,groups){
 const old=new Map((previous?.cats||[]).map(c=>[c.id,c]));
 const definitions=new Map(groups.map(g=>[g.id,g.talents]));
 return {...parsed,schemaVersion:2,source:'import',progressKnown:true,cats:parsed.cats.map(c=>{
  const choices=definitions.get(c.id)||[];
  const talents=parsed.talentStatus==='read'?choices.map(d=>({id:d.id,level:c.talents?.find(t=>t.id===d.id)?.level??0})):old.get(c.id)?.talents??null;
  return {...c,talents};
 })};
}
export function talentSummary(cat,definitions){
 if(!definitions.length)return '본능 항목 없음';
 const values=new Map((cat.talents||[]).map(t=>[t.id,t.level]));
 const learned=definitions.filter(t=>(values.get(t.id)||0)>0).length;
 const unknown=definitions.filter(t=>!values.has(t.id)).length;
 return '본능 '+learned+' / '+definitions.length+' 해방'+(unknown?' · '+unknown+'개 미확인':'');
}
