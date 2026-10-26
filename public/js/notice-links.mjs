/** PONOS accepts public notice URLs without session-specific device time fields. */
export function publicNoticeURL(value){
  const url=new URL(value);
  if(url.protocol==='https:'&&url.hostname==='nyanko-announcement.ponosgames.com'){
    url.searchParams.delete('clientTime');
    url.searchParams.delete('timeDifference');
  }
  return url.href;
}
