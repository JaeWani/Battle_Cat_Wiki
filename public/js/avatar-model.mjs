export const DEFAULT_AVATAR_KEY='c0-0';
export function avatarChoices(cats,enemies){
 return [...cats.map(c=>({...c,avatarKey:'c'+c.key,kind:'cat',label:c.name+' · '+(c.form+1)+'진화'})),...enemies.map(e=>({...e,avatarKey:'e'+e.key,kind:'enemy',label:e.name}))];
}
export function resolveAvatar(key,choices){
 return choices.find(c=>c.avatarKey===key)||choices.find(c=>c.avatarKey===DEFAULT_AVATAR_KEY)||{avatarKey:DEFAULT_AVATAR_KEY,image:'assets/u/0/0.png',name:'고양이',label:'고양이 · 1진화',kind:'cat'};
}
export function filterAvatars(choices,kind,query){
 const normalized=String(query).toLowerCase().replace(/\s/g,'');
 return choices.filter(c=>c.kind===kind&&[c.name,c.nameJP,c.nameEN,c.id,c.avatarKey].some(v=>String(v??'').toLowerCase().replace(/\s/g,'').includes(normalized)));
}
