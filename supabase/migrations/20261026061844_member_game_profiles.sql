
create table noc_private.game_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 game_version integer not null check(game_version between 120000 and 150599),
 region text not null check(region in ('kr','jp','en','tw')),
 cats jsonb not null check(jsonb_typeof(cats)='array' and jsonb_array_length(cats)<=2000),
 progress jsonb not null check(jsonb_typeof(progress)='array' and jsonb_array_length(progress)=9),
 updated_at timestamptz not null default now()
);
alter table noc_private.game_profiles enable row level security;
create policy noc_deny_direct on noc_private.game_profiles for all to anon,authenticated using(false) with check(false);
revoke all on noc_private.game_profiles from public,anon,authenticated;
grant all on noc_private.game_profiles to service_role;
create function noc_private.game_profile_api(action text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid(); previous noc_private.game_profiles; item jsonb; clean_cats jsonb:='[]'; clean_progress jsonb:='[]';
 id_num integer; form_num integer; level_num integer; plus_num integer; n integer; p integer; g integer; version_num integer; cc text; seen integer[]:='{}'; result jsonb;
begin
 if uid is null then raise exception '로그인이 필요해요.';end if;
 if action='game_profile' then
  select jsonb_build_object('schemaVersion',1,'gameVersion',game_version,'region',region,'cats',cats,'progress',progress,'updated_at',updated_at) into result from noc_private.game_profiles where user_id=uid;
  return result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('game-profile:'||uid::text,0));
 select * into previous from noc_private.game_profiles where user_id=uid for update;
 if (payload->>'expected_updated_at')::timestamptz is distinct from previous.updated_at then raise exception '다른 화면에서 데이터가 변경됐어요. 새로고침 후 다시 진행해 주세요.';end if;
 if action='delete_game_profile' then
  delete from noc_private.game_profiles where user_id=uid;
  if previous.user_id is not null then
   insert into noc_private.consents(user_id,document,version,accepted) select uid,'game_data',value->>'policy_version',false from noc_private.settings where key='public';
   insert into noc_private.audit(actor_id,action)values(uid,'game_profile.delete');
  end if;
  return '{"ok":true}';
 end if;
 if action<>'save_game_profile' then raise exception '지원하지 않는 요청이에요.';end if;
 if not noc_private.active_member() then raise exception '가입 완료 및 정상 이용 상태가 필요해요.';end if;
 if not coalesce((payload->>'game_data_accepted')::boolean,false) or (payload->>'policy_version') is distinct from (select value->>'policy_version' from noc_private.settings where key='public') then raise exception '최신 개인정보 안내와 게임 정보 저장 동의를 확인해 주세요.';end if;
 if previous.updated_at>now()-interval '10 seconds' then raise exception '저장 후 10초 뒤 다시 가져올 수 있어요.';end if;
 if octet_length(payload::text)>300000 or jsonb_typeof(payload->'cats') is distinct from 'array' or jsonb_array_length(payload->'cats')>2000 or jsonb_typeof(payload->'progress') is distinct from 'array' or jsonb_array_length(payload->'progress')<>9 then raise exception '게임 정보 크기나 형식이 올바르지 않아요.';end if;
 version_num:=(payload->>'gameVersion')::integer;cc:=payload->>'region';
 if version_num is null or version_num not between 120000 and 150599 or cc is null or cc not in ('kr','jp','en','tw') then raise exception '지원하지 않는 버전 또는 지역이에요.';end if;
 for item in select value from jsonb_array_elements(payload->'cats') loop
  if jsonb_typeof(item) is distinct from 'object' or not (item ?& array['id','form','level','plus']) or jsonb_typeof(item->'id')<>'number' or jsonb_typeof(item->'form')<>'number' or jsonb_typeof(item->'level')<>'number' or jsonb_typeof(item->'plus')<>'number' then raise exception '캐릭터 항목 형식이 올바르지 않아요.';end if;
  id_num:=(item->>'id')::integer;form_num:=(item->>'form')::integer;level_num:=(item->>'level')::integer;plus_num:=(item->>'plus')::integer;
  if id_num is null or form_num is null or level_num is null or plus_num is null or id_num<0 or form_num not between 0 and 3 or level_num not between 1 and 200 or plus_num not between 0 and 1000 or id_num=any(seen) then raise exception '캐릭터 수치 또는 중복 항목을 확인해 주세요.';end if;
  if not exists(select 1 from noc_private.characters where key='c'||id_num::text||'-'||form_num::text and kind='cat') then raise exception '도감에 없는 캐릭터 형태예요.';end if;
  seen:=array_append(seen,id_num);clean_cats:=clean_cats||jsonb_build_array(jsonb_build_object('id',id_num,'form',form_num,'level',level_num,'plus',plus_num));
 end loop;
 for item in select value from jsonb_array_elements(payload->'progress') loop
  if jsonb_typeof(item) is distinct from 'object' or not (item ?& array['progress','cleared','gold']) or jsonb_typeof(item->'progress')<>'number' or jsonb_typeof(item->'cleared')<>'number' or jsonb_typeof(item->'gold')<>'number' then raise exception '진행 정보 형식이 올바르지 않아요.';end if;
  p:=(item->>'progress')::integer;n:=(item->>'cleared')::integer;g:=(item->>'gold')::integer;
  if p is null or n is null or g is null or p not between 0 and 51 or n not between 0 and 48 or g not between 0 and 48 then raise exception '진행 정보 수치를 확인해 주세요.';end if;
  clean_progress:=clean_progress||jsonb_build_array(jsonb_build_object('progress',p,'cleared',n,'gold',g));
 end loop;
 insert into noc_private.game_profiles(user_id,game_version,region,cats,progress,updated_at)values(uid,version_num,cc,clean_cats,clean_progress,clock_timestamp())
 on conflict(user_id) do update set game_version=excluded.game_version,region=excluded.region,cats=excluded.cats,progress=excluded.progress,updated_at=excluded.updated_at;
 insert into noc_private.consents(user_id,document,version,accepted) select uid,'game_data',value->>'policy_version',true from noc_private.settings where key='public';
 insert into noc_private.audit(actor_id,action,detail)values(uid,'game_profile.import',jsonb_build_object('cat_count',jsonb_array_length(clean_cats),'version',version_num,'region',cc));
 return noc_private.game_profile_api('game_profile','{}');
end $$;
revoke all on function noc_private.game_profile_api(text,jsonb) from public,anon,authenticated,service_role;
do $patch$
declare definition text; anchor text:='if action=''site_settings'' then';
begin
 select pg_get_functiondef('noc_private.api(text,jsonb)'::regprocedure) into definition;
 if position(anchor in definition)=0 then raise exception 'API dispatch anchor missing';end if;
 definition:=replace(definition,anchor,'if action in (''game_profile'',''save_game_profile'',''delete_game_profile'') then return noc_private.game_profile_api(action,payload);end if;'||E'\n '||anchor);
 anchor:='insert into noc_private.deletion_jobs(user_id)values(uid)on conflict do nothing;';
 if position(anchor in definition)=0 then raise exception 'Account deletion anchor missing';end if;
 definition:=replace(definition,anchor,anchor||E'\n  delete from noc_private.game_profiles where user_id=uid;');
 execute definition;
end $patch$;
-- Updated only after deployment of the matching notice.
