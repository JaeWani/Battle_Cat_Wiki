/** Calendar dates are always Asia/Seoul. Announced end times are inclusive by minute. */
export function kstDay(now=new Date()) {
  return new Date(new Date(now).getTime()+9*3600000).toISOString().slice(0,10);
}
export function shiftDay(day,amount) {
  const d=new Date(`${day}T00:00:00+09:00`);d.setUTCDate(d.getUTCDate()+amount);return kstDay(d);
}
export function dayWindow(day) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||kstDay(new Date(`${day}T00:00:00+09:00`))!==day)throw new RangeError('날짜를 확인해 주세요.');
  const start=Date.parse(`${day}T00:00:00+09:00`);return {start,end:start+86400000};
}
export function onDay(event,day) {
  const {start,end}=dayWindow(day);
  if(event.period){const s=Date.parse(event.period.startAt),e=Date.parse(event.period.endAt);return s<end&&e>start;}
  const r=event.recurrence;if(!r)return false;
  if(event.publishedOn && day<event.publishedOn)return false;
  if(r.frequency==='weekly')return r.weekdays.includes(new Date(`${day}T12:00:00+09:00`).getUTCDay());
  if(r.frequency==='monthly')return r.monthDays.includes(Number(day.slice(-2)));
  return false;
}
export function eventStatus(event,now=new Date()) {
  const ts=new Date(now).getTime();
  if(event.period){
    if(ts<Date.parse(event.period.startAt))return 'upcoming';
    if(ts>=Date.parse(event.period.endAt))return 'ended';
    return 'ongoing';
  }
  if(event.recurrence)return onDay(event,kstDay(now))?'recurring':'upcoming';
  return 'notice';
}
export function isStale(collectedAt,now=new Date()) {
  const age=new Date(now).getTime()-Date.parse(collectedAt);
  return !Number.isFinite(age)||age>36*3600000;
}
export function filterEvents(events,{day,category='all',query=''}={}) {
  const q=query.trim().toLocaleLowerCase('ko-KR');
  return events.filter(e=>(!day||onDay(e,day))&&(category==='all'||e.category===category)&&(!q||e.title.toLocaleLowerCase('ko-KR').includes(q)));
}
