begin;
insert into auth.users(id,aud,role,email)values
 ('51000000-0000-4000-8000-000000000001','authenticated','authenticated','noc-manual-a@example.invalid'),
 ('51000000-0000-4000-8000-000000000002','authenticated','authenticated','noc-manual-b@example.invalid');
insert into noc_private.members(id,nickname,status)values
 ('51000000-0000-4000-8000-000000000001','NOC manual test A','active'),
 ('51000000-0000-4000-8000-000000000002','NOC manual test B','active');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $test$
declare payload jsonb; result jsonb; invalid jsonb;
begin
 payload:=jsonb_build_object('source','manual','gameVersion',null,'region','kr','progressKnown',false,'game_data_accepted',true,'policy_version',public.noc_api('site_settings')->>'policy_version','expected_updated_at',null,
 'cats','[{"id":9,"form":2,"level":50,"plus":0,"talents":[{"id":10,"level":4,"raw":"DO_NOT_STORE"}]}]'::jsonb,
 'progress',(select jsonb_agg(jsonb_build_object('progress',0,'cleared',0,'gold',0))from generate_series(1,9)));
 for invalid in select value from jsonb_array_elements('[
 [{"id":9,"form":2,"level":50,"plus":0,"talents":[{"id":10,"level":11}]}],
 [{"id":9,"form":2,"level":50,"plus":0,"talents":[{"id":10,"level":0.5}]}],
 [{"id":9,"form":2,"level":50,"plus":0,"talents":[{"id":255,"level":1}]}],
 [{"id":9,"form":2,"level":50,"plus":0,"talents":[{"id":10,"level":1},{"id":10,"level":2}]}],
 [{"id":0,"form":0,"level":20,"plus":0,"talents":[{"id":10,"level":1}]}]
 ]'::jsonb) loop
  begin perform public.noc_api('save_game_profile',jsonb_set(payload,'{cats}',invalid));raise exception 'INVALID_TALENT_ALLOWED';exception when others then if sqlerrm='INVALID_TALENT_ALLOWED' then raise;end if;end;
 end loop;
 result:=public.noc_api('save_game_profile',payload);
 if result->>'source'<>'manual' or result->'gameVersion'<>'null'::jsonb or result->>'progressKnown'<>'false' or result->'cats'->0->'talents'->0->>'level'<>'4' then raise exception 'Manual talent roundtrip failed';end if;
 if result::text like '%DO_NOT_STORE%' then raise exception 'Extra field retained';end if;
 begin perform public.noc_api('save_game_profile',payload);raise exception 'STALE_SAVE_ALLOWED';exception when others then if sqlerrm='STALE_SAVE_ALLOWED' then raise;end if;end;
end $test$;
reset role;
update noc_private.game_profiles set updated_at=now()-interval '30 seconds' where user_id='51000000-0000-4000-8000-000000000001';
set local role authenticated;
do $test$
declare previous jsonb; payload jsonb; result jsonb;
begin
 previous:=public.noc_api('game_profile');
 payload:=jsonb_build_object('source','import','gameVersion',150500,'region','kr','game_data_accepted',true,'policy_version',public.noc_api('site_settings')->>'policy_version','expected_updated_at',previous->>'updated_at','progress',previous->'progress','cats','[{"id":9,"form":2,"level":45,"plus":0}]'::jsonb);
 result:=public.noc_api('save_game_profile',payload);
 if result->'cats'->0->'talents'->0->>'level'<>'4' then raise exception 'Import without talents overwrote manual levels';end if;
end $test$;
reset role;
update noc_private.game_profiles set updated_at=now()-interval '30 seconds' where user_id='51000000-0000-4000-8000-000000000001';
set local role authenticated;
do $test$
declare previous jsonb; payload jsonb; result jsonb;
begin
 previous:=public.noc_api('game_profile');payload:=jsonb_build_object('source','import','gameVersion',150500,'region','kr','game_data_accepted',true,'policy_version',public.noc_api('site_settings')->>'policy_version','expected_updated_at',previous->>'updated_at','progress',previous->'progress','cats','[{"id":9,"form":2,"level":45,"plus":0,"talents":[{"id":10,"level":7}]}]'::jsonb);
 result:=public.noc_api('save_game_profile',payload);
 if result->'cats'->0->'talents'->0->>'level'<>'7' then raise exception 'Confirmed import did not update talent';end if;
end $test$;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin if public.noc_api('game_profile') is not null then raise exception 'OTHER_MEMBER_PROFILE_LEAK';end if;end$$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$begin
 begin perform public.noc_api('game_profile');raise exception 'ANON_READ_ALLOWED';exception when others then if sqlerrm='ANON_READ_ALLOWED' then raise;end if;end;
 begin perform count(*)from noc_private.character_talents;raise exception 'DIRECT_TALENTS_ALLOWED';exception when insufficient_privilege then null;end;
end$$;
rollback;
select 'PASS: manual/import talent roundtrips, missing-talent preservation, typed bounds, character-specific definitions, own-only access and stale-write denial' as result;
