/** Category labels reference NamuWiki; gameplay facts come only from PONOS. */
export const CATEGORIES=[
  ['all','전체'],['main','메인 스테이지'],['legend','레전드 스토리'],
  ['true-legend','신 레전드 스토리'],['special','스페셜 스테이지'],
  ['excavation','발굴 스테이지'],['collab','콜라보 스테이지'],
  ['challenge','챌린지 배틀'],['dojo','냥코 도장']
];
export const SPECIALS=[['all','전체'],['items','아이템·요일'],['catfruit','개다래'],['cyclone','사이클론'],['crazed','광란'],['advent','강림·대강림'],['other','기타 이벤트']];
export function categoryOf(map){
  if(/^N\d{3}$/.test(map.code))return 'legend';
  // Explicitly verified source families in the initial official catalog.
  if(/^[BSV]\d{3}$/.test(map.code))return 'special';
  return 'unclassified';
}
export function specialOf(map){
  if(/개다래/.test(map.name))return 'catfruit';
  if(/광란/.test(map.name))return 'crazed';
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
export function filterMaps(maps,{category='all',special='all',query=''}={}){
  const q=String(query).normalize('NFKC').toLocaleLowerCase('ko-KR').trim();
  return maps.filter(m=>(category==='all'||categoryOf(m)===category)&&
    (category!=='special'||special==='all'||specialOf(m)===special)&&
    (!q||[m.name,m.code,...m.stages.map(s=>s.name)].some(v=>v.toLocaleLowerCase('ko-KR').includes(q))));
}
