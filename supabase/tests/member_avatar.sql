begin;
insert into auth.users(id,aud,role,email)values
 ('52000000-0000-4000-8000-000000000001','authenticated','authenticated','noc-avatar-a@example.invalid'),
 ('52000000-0000-4000-8000-000000000002','authenticated','authenticated','noc-avatar-b@example.invalid'),
 ('52000000-0000-4000-8000-000000000003','authenticated','authenticated','noc-avatar-blocked@example.invalid');
insert into noc_private.members(id,nickname,status)values
 ('52000000-0000-4000-8000-000000000001','NOC avatar test A','active'),
 ('52000000-0000-4000-8000-000000000002','NOC avatar test B','active'),
 ('52000000-0000-4000-8000-000000000003','NOC avatar blocked','suspended');
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$begin
 begin perform public.noc_api('set_avatar','{"key":"c25-2"}');raise exception 'ANON_AVATAR_ALLOWED';exception when others then if sqlerrm='ANON_AVATAR_ALLOWED' then raise;end if;end;
end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"52000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $test$
declare payload jsonb; result jsonb;
begin
 if public.noc_api('me')->>'avatar_key'<>'c0-0' then raise exception 'Default avatar missing';end if;
 for payload in select value from jsonb_array_elements('[{}, {"key":null},{"key":0},{"key":"c999999-0"},{"key":"https://example.invalid/pic.png"},{"key":"assets/u/0/0.png"},{"key":"<img src=x>"}]'::jsonb)loop
  begin perform public.noc_api('set_avatar',payload);raise exception 'INVALID_AVATAR_ALLOWED';exception when others then if sqlerrm='INVALID_AVATAR_ALLOWED' then raise;end if;end;
 end loop;
 result:=public.noc_api('set_avatar','{"key":"c25-2","user_id":"52000000-0000-4000-8000-000000000002","avatar_url":"https://example.invalid"}');
 if public.noc_api('me')->>'avatar_key'<>'c25-2' then raise exception 'Ally evolution avatar roundtrip failed';end if;
 if result ? 'avatar_url' then raise exception 'Arbitrary URL persisted';end if;
 perform public.noc_api('set_avatar','{"key":"e24"}');
 if public.noc_api('me')->>'avatar_key'<>'e24' then raise exception 'Enemy avatar roundtrip failed';end if;
 begin update noc_private.members set avatar_key='c0-0';raise exception 'DIRECT_AVATAR_UPDATE_ALLOWED';exception when insufficient_privilege then null;end;
end $test$;
select set_config('request.jwt.claims','{"sub":"52000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$begin if public.noc_api('me')->>'avatar_key'<>'c0-0' then raise exception 'Other member avatar modified';end if;end$$;
select set_config('request.jwt.claims','{"sub":"52000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$begin
 begin perform public.noc_api('set_avatar','{"key":"e24"}');raise exception 'SUSPENDED_AVATAR_ALLOWED';exception when others then if sqlerrm='SUSPENDED_AVATAR_ALLOWED' then raise;end if;end;
end$$;
rollback;
select 'PASS: default/ally/enemy avatar persistence, identifier allowlist, own-account-only changes, anonymous/suspended/direct-write denial' as result;
