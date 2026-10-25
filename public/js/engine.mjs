/** Direct-strike model. No movement, procs-as-expectations, or battle win prediction.
 * Level curves / ability identifiers: battlecatsinfo (MIT; see THIRD_PARTY_LICENSES).
 */
export const TRAITS = [
  [1,'빨간 적','red'],[2,'떠있는 적','floating'],[4,'검은 적','black'],
  [8,'메탈','metal'],[16,'천사','angel'],[32,'에이리언','alien'],
  [64,'좀비','zombie'],[128,'고대종','relic'],[256,'흰 적','white'],
  [2048,'악마','aku'],[8192,'초수','behemoth'],[16384,'초생명체','colossus'],
  [32768,'초현자','sage'],[512,'사도','eva'],[1024,'마녀','witch'],
  [4096,'도장 성','base'],[65536,'괴인','kaijin']
];
export const RARITIES = ['기본','EX','레어','슈퍼 레어','울트라 슈퍼 레어','레전드 레어'];
export const ABILITIES = {
  1:'공격력 상승',2:'살아남는다',3:'성 파괴',4:'크리티컬',5:'좀비 킬러',6:'영혼 공격',
  7:'배리어 브레이커',8:'실드 브레이커',9:'혼신의 일격',10:'돈을 많이 받는다',11:'메탈',
  12:'소파동',13:'파동',14:'소열파',15:'열파',16:'파동 삭제',17:'초생명체 특효',
  18:'초수 특효',19:'마녀 킬러',20:'사도 킬러',21:'공격력 다운',22:'움직임을 멈춘다',
  23:'움직임을 느리게 한다',24:'공격 대상 한정',25:'엄청 강하다',26:'맷집이 좋다',
  27:'초 맷집이 좋다',28:'초 데미지',29:'극 데미지',30:'날려버린다',31:'워프',
  32:'공격 무효',33:'저주',34:'버로우',35:'부활',36:'독 공격',37:'1회 공격',
  38:'배리어',39:'악마 실드',40:'열파 반사',41:'순교',42:'초현자 특효',
  43:'소환',44:'메탈 킬러',45:'폭파',46:'괴인 특효',47:'지연',48:'생산 시간 단축'
};
const TREASURE_TRAITS = 1|2|4|8|16|32|64;
const has = (u,id) => Object.hasOwn(u.abilities,id);
const scalar = v => Array.isArray(v) ? v[0] : v;
const positive = (v,name,max=1e6,integer=false) => {
  if (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) || Number(v)<=0 || Number(v)>max || (integer && !Number.isInteger(Number(v)))) throw new RangeError(`${name} 값을 확인해 주세요.`);
  return Number(v);
};
const round = n => Math.round((n+Number.EPSILON)*1e8)/1e8;
export function levelMultiplier(level,curve) {
  positive(level,'레벨',curve.length*10,true);
  let result=.8;
  for(let i=0;i<curve.length;i++) {
    const levels=Math.min(10,Math.max(0,level-i*10));
    result+=levels*curve[i]/100;
  }
  return round(result);
}
export function statsAt(unit,{level=30,magnification=100,treasure=true,curves}={}) {
  let scale;
  if(unit.form!==undefined) {
    level=positive(level,'레벨',unit.maxLevel,true);
    if(!curves?.[unit.curve]) throw new Error('레벨 성장표를 찾을 수 없습니다.');
    scale=levelMultiplier(level,curves[unit.curve]);
  } else scale=positive(magnification,'배율')/100;
  const stat=v=>unit.form!==undefined ? Math.round(round(v*scale))*(treasure?2.5:1) : Math.round(round(v*scale));
  // In-game base level rounding happens before the Empire of Cats treasure multiplier.
  const scaled=v=>Math.floor(stat(v)+Number.EPSILON);
  const attacks=unit.attacks.map(scaled);
  const active=unit.attacks.map((v,i)=>v>0?i:-1).filter(i=>i>=0);
  return {hp:scaled(unit.hp),attacks,active,attack:attacks.reduce((a,b)=>a+b,0),dps:unit.attackF>0?attacks.reduce((a,b)=>a+b,0)*30/unit.attackF:0,range:unit.range};
}
/** Repeating strike vector, skipping zero-damage strikes. Exact count of landed hits;
 * rounds counts attack animations, not projectiles. */
export function strikesToKill(hp,damages) {
  if(!Number.isFinite(hp)||hp<=0) throw new RangeError('체력은 양수여야 합니다.');
  if(!Array.isArray(damages)||!damages.length||damages.some(x=>!Number.isFinite(x)||x<0)) throw new RangeError('피해량을 확인해 주세요.');
  const cycle=damages.reduce((a,b)=>a+b,0);
  if(cycle<=0) return {hits:Infinity,rounds:Infinity,lastIndex:null};
  let full=Math.max(0,Math.ceil(hp/cycle)-1), remaining=hp-full*cycle;
  for(let i=0;i<damages.length;i++) {
    remaining-=damages[i];
    if(remaining<=1e-8) return {hits:full*damages.length+i+1,rounds:full+1,lastIndex:i};
  }
  throw new Error('타수 계산 오차가 발생했습니다.');
}
function factors(cat,enemy,traitTreasures) {
  let attack=1,defense=1;
  const target=Boolean(cat.trait & enemy.trait);
  const treasure=traitTreasures && Boolean(cat.trait & enemy.trait & TREASURE_TRAITS);
  if(target) {
    if(has(cat,28)) attack*=treasure?4:3;
    else if(has(cat,29)) attack*=treasure?6:5;
    else if(has(cat,25)) attack*=treasure?1.8:1.5;
    if(has(cat,26)) defense/=treasure?5:4;
    else if(has(cat,27)) defense/=treasure?7:6;
    else if(has(cat,25)) defense*=treasure?.4:.5;
  }
  if(enemy.trait&8192 && has(cat,18)) {attack*=2.5; defense*=.6;}
  else if(enemy.trait&16384 && has(cat,17)) {attack*=1.6; defense*=.7;}
  else if(enemy.trait&32768 && has(cat,42)) {attack*=1.2; defense*=.5;}
  else if(enemy.trait&65536 && has(cat,46)) {attack*=2.5; defense*=.4;}
  if(enemy.trait&1024 && has(cat,19)) {attack*=5;defense*=.1;}
  if(enemy.trait&512 && has(cat,20)) {attack*=5;defense*=.2;}
  if((enemy.trait&4096 || (enemy.trait===0&&enemy.speed===0)) && has(cat,3)) attack*=4;
  return {attack,defense,target};
}
function enabled(u,i) { return Boolean(u.abilityMask & (1<<(2-i))); }
function proc(u,id,i,forced=false) {
  return has(u,id) && enabled(u,i) && (Number(scalar(u.abilities[id]))>=100 || forced);
}
export function calculate(cat,enemy,options) {
  const {level,magnification,curves,treasure=true,traitTreasures=true,critical=false}=options;
  const ally=statsAt(cat,{level,treasure,curves}), foe=statsAt(enemy,{magnification});
  const f=factors(cat,enemy,traitTreasures);
  const canAttack=!(has(cat,24)&&!f.target&&!(enemy.trait&4096)&&!(enemy.trait===0&&enemy.speed===0));
  const metal=Boolean(enemy.trait&8)||has(enemy,11);
  const outgoing=ally.active.map(i=>{
    if(!canAttack) return 0;
    let damage=ally.attacks[i]*f.attack;
    if(proc(cat,9,i,critical)) damage*=1+cat.abilities[9][1]/100;
    if(proc(cat,4,i,critical)) damage*=2;
    else if(metal) return 1;
    return Math.max(1,Math.floor(damage+1e-8));
  });
  const incoming=foe.active.map(i=>{
    let damage=foe.attacks[i];
    if(proc(enemy,9,i)) damage*=1+enemy.abilities[9][1]/100;
    if(proc(enemy,4,i)) damage*=2;
    else if(has(cat,11)) return 1;
    return Math.max(1,Math.floor(damage*f.defense+1e-8));
  });
  const kill=outgoing.length?strikesToKill(foe.hp,outgoing):{hits:Infinity,rounds:Infinity,lastIndex:null};
  const death=incoming.length?strikesToKill(ally.hp,incoming):{hits:Infinity,rounds:Infinity,lastIndex:null};
  const notes=[];
  if(metal) notes.push('메탈: 크리티컬이 아닌 직접 공격은 타격당 1 피해입니다.');
  if(!canAttack) notes.push('공격 대상 한정: 선택한 적은 아군의 공격 대상이 아닙니다.');
  if(has(enemy,38)) notes.push(`배리어 ${Math.round(scalar(enemy.abilities[38])*magnification/100).toLocaleString('ko-KR')}: 아래 타수는 배리어가 제거된 본체 기준입니다. 배리어 파괴 가능 여부는 판정하지 않습니다.`);
  if(has(enemy,39)) notes.push('악마 실드: 아래 타수는 실드가 제거된 본체 기준입니다. 실드 피해·재생은 계산하지 않습니다.');
  if(has(enemy,35)) notes.push('좀비 부활: 최초로 체력이 0이 될 때까지 계산합니다. 부활 후 체력은 포함하지 않습니다.');
  if(has(cat,2)||has(enemy,2)) notes.push('살아남는다: 생존 효과가 발동하지 않은 조건입니다.');
  if(has(cat,37)||has(enemy,37)) notes.push('1회 공격 캐릭터가 포함되어 있습니다. 반복 타수는 동일 개체가 아닌 새 개체의 공격까지 가정한 값입니다.');
  if(has(cat,1)||has(enemy,1)) notes.push('체력 감소에 따른 공격력 상승은 적용하지 않습니다.');
  const excluded=[12,13,14,15,21,22,23,30,31,32,33,34,36,40,41,43,44,45,47];
  if(excluded.some(id=>has(cat,id)||has(enemy,id))) notes.push('파동·열파·폭파·독·메탈 킬러·공격 무효·행동 방해·소환 등은 미적용입니다. 직접 공격 피해만 계산합니다.');
  const probabilistic=[4,9].some(id=>(has(cat,id)&&Number(scalar(cat.abilities[id]))<100)||(has(enemy,id)&&Number(scalar(enemy.abilities[id]))<100));
  if(probabilistic) notes.push(critical?'아군의 크리티컬·혼신의 일격은 매번 발동하는 조건입니다. 적의 확률 효과는 미발동 조건입니다. 평균 타수가 아닙니다.':'100%가 아닌 크리티컬·혼신의 일격은 발동하지 않는 조건입니다. 평균 타수가 아닙니다.');
  if((cat.atkType|enemy.atkType)&12) notes.push('원거리·전방위 공격: 사거리 차이는 인식 사거리 기준입니다. 사각지대와 타격 범위는 도감에서 확인해 주세요.');
  if(enemy.star) notes.push('에이리언 등 보물에 따른 적 강화는 별도 적용하지 않습니다. 입력한 배율을 최종 실효 배율로 사용합니다.');
  const killTime=Number.isFinite(kill.rounds)&&cat.attackF>0 ? ((kill.rounds-1)*cat.attackF+cat.preswings[ally.active[kill.lastIndex]])/30 : Infinity;
  return {ally,foe,outgoing,incoming,kill,death,killTime,rangeDifference:cat.range-enemy.range,attackFactor:f.attack,defenseFactor:f.defense,notes,conditional:critical,bodyOnly:has(enemy,38)||has(enemy,39),canAttack};
}
export function searchUnits(units,query='',trait=0,rarity='all') {
  const norm=s=>String(s).normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  const q=norm(query);
  return units.filter(u=>(!trait||Boolean(u.trait&Number(trait))) && (rarity==='all'||u.rarity===Number(rarity)) && (!q||[u.name,u.nameJP,u.nameEN,String(u.id),u.key].some(v=>norm(v||'').includes(q))));
}
