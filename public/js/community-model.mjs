
export const BOARD_NAMES={all:'전체',free:'자유게시판',question:'질문·답변',guide:'공략·팁',notice:'공지사항'};
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function characterKey(kind,key){
 if(kind==='cat'&&/^\d+-[0-3]$/.test(String(key)))return 'c'+key;
 if(kind==='enemy'&&/^\d+$/.test(String(key)))return 'e'+key;
 throw new Error('캐릭터 식별자를 확인해 주세요.');
}
export function validPost(title,body){
 if(title.trim().length<2||title.trim().length>100)throw new Error('제목은 2~100자로 입력해 주세요.');
 if(body.trim().length<2||body.trim().length>20000)throw new Error('본문은 2~20,000자로 입력해 주세요.');
 return {title:title.trim(),body:body.trim()};
}
export function safeImagePath(path,uid,post){
 return typeof path==='string'&&path.startsWith(uid+'/'+post+'/')&&/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/.test(path);
}
export function ratingLabel(value,count){return count?Number(value).toFixed(1)+' / 5 · '+count+'명 평가':'아직 평가가 없어요';}
