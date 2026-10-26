
begin;
insert into auth.users(id,aud,role,email)values
 ('40000000-0000-4000-8000-000000000001','authenticated','authenticated','noc-game-test-a@example.invalid'),
 ('40000000-0000-4000-8000-000000000002','authenticated','authenticated','noc-game-test-b@example.invalid');
insert into noc_private.members(id,nickname,status)values
 ('40000000-0000-4000-8000-000000000001','NOC game test A','active'),
 ('40000000-0000-4000-8000-000000000002','NOC game test B','active');
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform public.noc_api('game_profile');raise exception 'ANON_GAME_READ';exception when others then if sqlerrm='ANON_GAME_READ' then raise;end if;end;
 begin perform count(*)from noc_private.game_profiles;raise exception 'DIRECT_GAME_READ';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $test$
declare payload jsonb; result jsonb;
begin
 payload:=jsonb_build_object('gameVersion',150500,'region','kr','game_data_accepted',true,'policy_version',public.noc_api('site_settings')->>'policy_version','expected_updated_at',null,
 'user_id','40000000-0000-4000-8000-000000000002','raw_file','DO_NOT_STORE','cats','[{"id":0,"form":0,"level":20,"plus":10,"extra":"DO_NOT_STORE"}]'::jsonb,
 'progress',(select jsonb_agg(jsonb_build_object('progress',0,'cleared',0,'gold',0,'extra','DO_NOT_STORE')) from generate_series(1,9)));
 begin perform public.noc_api('save_game_profile',jsonb_set(payload,'{cats}','[{"id":0,"form":0,"level":-1,"plus":0}]'));raise exception 'INVALID_LEVEL_ALLOWED';exception when others then if sqlerrm='INVALID_LEVEL_ALLOWED' then raise;end if;end;
 begin perform public.noc_api('save_game_profile',jsonb_set(payload,'{cats}','[{"id":0,"form":0,"level":1,"plus":0},{"id":0,"form":0,"level":1,"plus":0}]'));raise exception 'DUPLICATE_CAT_ALLOWED';exception when others then if sqlerrm='DUPLICATE_CAT_ALLOWED' then raise;end if;end;
 begin perform public.noc_api('save_game_profile',jsonb_set(payload,'{policy_version}','"stale"'));raise exception 'STALE_GAME_CONSENT_ALLOWED';exception when others then if sqlerrm='STALE_GAME_CONSENT_ALLOWED' then raise;end if;end;
 result:=public.noc_api('save_game_profile',payload);
 if result->'cats'->0->>'level'<>'20' or jsonb_array_length(result->'progress')<>9 then raise exception 'Profile roundtrip failed';end if;
 if result::text like '%DO_NOT_STORE%' or result ? 'user_id' then raise exception 'Extra/private fields persisted';end if;
 begin perform public.noc_api('delete_game_profile','{"expected_updated_at":null}');raise exception 'STALE_DELETE_ALLOWED';exception when others then if sqlerrm='STALE_DELETE_ALLOWED' then raise;end if;end;
end $test$;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin if public.noc_api('game_profile') is not null then raise exception 'OTHER_MEMBER_GAME_LEAK';end if;end $$;
select set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.noc_api('request_deletion','{"confirm":"회원탈퇴"}');
do $$ begin if public.noc_api('game_profile') is not null then raise exception 'Withdrawal retained game data';end if;end $$;
rollback;
select 'PASS: anonymous/direct denial, own-only reads, bounds, duplicates, consent, extra-field stripping, optimistic locking and withdrawal cleanup' as result;
