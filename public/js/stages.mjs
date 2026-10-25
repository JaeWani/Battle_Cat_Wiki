/** Category labels reference NamuWiki; gameplay facts come only from PONOS. */
export const CATEGORIES=[
  ['all','전체'],['main','메인 스테이지'],['legend','레전드 스토리'],
  ['true-legend','신 레전드 스토리'],['zero-legend','레전드 제로'],['special','스페셜 스테이지'],
  ['excavation','발굴 스테이지'],['collab','콜라보 스테이지'],
  ['challenge','챌린지 배틀'],['dojo','냥코 도장'],['labyrinth','지하 미궁'],['extra','EX 스테이지'],['other','미분류']
];
export const SPECIALS=[['all','전체'],['items','아이템·요일'],['catfruit','개다래'],['xp','경험치'],['cyclone','사이클론'],['crazed','광란'],['advent','강림·대강림'],['awakening','각성'],['tower','냥코탑·별탑'],['gauntlet','강습'],['behemoth','초수 토벌'],['catamin','고양이 드링크'],['colosseum','이차원 콜로세움'],['other','기타 이벤트']];
export const FAMILY_NAMES={N:'레전드 스토리',S:'스페셜 스테이지',C:'콜라보 스테이지',CH:'메인 스테이지',E:'EX 스테이지',T:'냥코 도장',V:'냥코탑·별탑',R:'랭킹 도장',M:'챌린지 배틀',NA:'신 레전드 스토리',B:'고양이 드링크',A:'강습 스테이지',H:'발굴 스테이지',CA:'콜라보 강습',Q:'초수 토벌',L:'지하 미궁',ND:'레전드 제로',SR:'이차원 콜로세움',G:'냥코 도 검정',P:'신규 계열 후보'};
export const familyOf=map=>map.code.match(/^[A-Z]+/)?.[0]||'';
export function categoryOf(map){
  return {N:'legend',NA:'true-legend',ND:'zero-legend',CH:'main',S:'special',B:'special',V:'special',A:'special',Q:'special',SR:'special',C:'collab',CA:'collab',H:'excavation',T:'dojo',R:'dojo',G:'dojo',M:'challenge',L:'labyrinth',E:'extra',P:'other'}[familyOf(map)]||'unclassified';
}
export function specialOf(map){
  const family=familyOf(map);
  if(family==='B')return 'catamin';
  if(family==='V')return 'tower';
  if(family==='A')return 'gauntlet';
  if(family==='Q')return 'behemoth';
  if(family==='SR')return 'colosseum';
  if(/개다래/.test(map.name))return 'catfruit';
  if(/경험치|경험은/.test(map.name))return 'xp';
  if(/광란/.test(map.name))return 'crazed';
  if(/각성/.test(map.name))return 'awakening';
  if(/강림/.test(map.name))return 'advent';
  if(/사이클론|적색 카타스트로프|다크니스 헤븐|국사무쌍|적소용돌이|흑소용돌이|백소용돌이|철소용돌이|천벌|이차원|롤링 데드/.test(map.name))return 'cyclone';
  if(/^[월화수목금]요 스테이지|토일 스테이지/.test(map.name))return 'items';
  return 'other';
}
export const normalizedName=value=>String(value).normalize('NFKC').replace(/\s+/g,'').replace(/개최[!！]?$/u,'').replace(/[!！]$/u,'');
export function schedulesFor(map,events){
  const name=normalizedName(map.name);
  return events.filter(e=>e.region==='KR'&&e.category==='event'&&(e.period||e.recurrence)&&normalizedName(e.title)===name);
}
export function filterMaps(maps,{category='all',special='all',query='',koreanOnly=false}={}){
  const q=String(query).normalize('NFKC').toLocaleLowerCase('ko-KR').trim();
  return maps.filter(m=>(!koreanOnly||m.koreanTextVerified!==false)&&(category==='all'||categoryOf(m)===category)&&
    (category!=='special'||special==='all'||specialOf(m)===special)&&
    (!q||[m.name,m.code,...m.stages.map(s=>s.name)].some(v=>v.toLocaleLowerCase('ko-KR').includes(q))));
}
export function hydrateStageGroup(group,images){
  const icons=new Map(images.map(e=>[e.iconCode,e]));
  return group.maps.map(m=>({...m,stages:m.stages.map(s=>{
    const {enemyCodes,...facts}=s;
    return {...facts,sourceUrl:m.sourceUrl,enemies:enemyCodes.map(code=>{
      const image=icons.get(code);if(!image)throw new Error(`Unknown official enemy icon: ${code}`);
      return {iconCode:code,sourceUrl:image.sourceUrl,image:image.path,name:null,magnification:null,spawnCount:null,spawnTime:null};
    })};
  })}));
}
