-- Only existing catalog identifiers are stored; clients resolve bundled artwork.
alter table noc_private.members add column avatar_key text not null default 'c0-0'
 references noc_private.characters(key);
do $patch$
declare definition text; anchor text:='if action=''me'' then';
begin
 select pg_get_functiondef('noc_private.api(text,jsonb)'::regprocedure) into definition;
 if position(anchor in definition)=0 or position('''nickname'',member.nickname,' in definition)=0 then raise exception 'Member API anchor missing';end if;
 definition:=replace(definition,'''nickname'',member.nickname,','''nickname'',member.nickname,''avatar_key'',member.avatar_key,');
 definition:=replace(definition,anchor,$branch$
 if action='set_avatar' then
  if not noc_private.active_member() then raise exception '가입 완료 및 정상 이용 상태가 필요해요.';end if;
  if jsonb_typeof(payload->'key') is distinct from 'string' then raise exception '프로필 이미지를 선택해 주세요.';end if;
  key_text:=payload->>'key';
  if char_length(key_text)>32 or not exists(select 1 from noc_private.characters where key=key_text and kind in ('cat','enemy')) then raise exception '등록된 아군 또는 적군 이미지만 선택할 수 있어요.';end if;
  update noc_private.members set avatar_key=key_text,updated_at=clock_timestamp() where id=uid;
  insert into noc_private.audit(actor_id,action)values(uid,'member.avatar');
  return jsonb_build_object('avatar_key',key_text);
 end if;
 $branch$||anchor);
 execute definition;
end $patch$;
