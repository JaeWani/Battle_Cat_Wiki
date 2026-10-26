
begin;
update noc_private.settings set value=value||'{"registration_open":true}'::jsonb where key='public';
insert into auth.users(id,aud,role,email) values
 ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','noc-test-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','noc-test-b@example.invalid'),
 ('10000000-0000-4000-8000-000000000003','authenticated','authenticated','noc-test-owner@example.invalid');
insert into auth.identities(user_id,provider_id,identity_data,provider)select id,id::text,jsonb_build_object('sub',id),'google' from auth.users where id::text like '10000000-0000-4000-8000-00000000000%';
insert into noc_private.staff(user_id,role)values('10000000-0000-4000-8000-000000000003','owner');
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if jsonb_array_length(public.noc_api('boards'))<>4 then raise exception 'board read failed';end if;
 begin perform public.noc_api('create_post','{"board":"free"}');raise exception 'ANON_WRITE_ALLOWED';exception when others then if sqlerrm='ANON_WRITE_ALLOWED' then raise;end if;end;
 begin perform count(*)from noc_private.reports;raise exception 'PRIVATE_READ_ALLOWED';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.noc_api('onboard','{"nickname":"NOC test A","age_confirmed":true,"terms_accepted":true,"privacy_accepted":true,"policy_version":"2026-10-26-r1"}');
select set_config('noc.test_post',(public.noc_api('create_post','{"board":"free"}')->>'id'),true);
select public.noc_api('save_post',jsonb_build_object('id',current_setting('noc.test_post'),'title','권한 테스트 글','body','트랜잭션 종료 시 삭제되는 검증용 본문입니다.'));
select public.noc_api('rate','{"key":"c25-2","stars":5}');
select public.noc_api('rate','{"key":"c25-2","stars":3}');
do $$ begin
 if (public.noc_api('character','{"key":"c25-2"}')->>'count')::int<>1 then raise exception 'duplicate rating';end if;
 if (public.noc_api('character','{"key":"c25-2"}')->>'mine')::int<>3 then raise exception 'rating update failed';end if;
 begin perform public.noc_api('admin');raise exception 'ADMIN_ESCALATION';exception when others then if sqlerrm='ADMIN_ESCALATION' then raise;end if;end;
 begin perform public.noc_api('rate','{"key":"c25-2","stars":6}');raise exception 'BAD_RATING_ALLOWED';exception when check_violation then null;end;
 begin perform public.noc_api('create_post','{"board":"notice"}');raise exception 'NOTICE_ESCALATION';exception when others then if sqlerrm='NOTICE_ESCALATION' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"owner"}}',true);
select public.noc_api('onboard','{"nickname":"NOC test B","age_confirmed":true,"terms_accepted":true,"privacy_accepted":true,"policy_version":"2026-10-26-r1"}');
do $$ begin
 begin perform public.noc_api('save_post',jsonb_build_object('id',current_setting('noc.test_post'),'title','가로채기','body','남의 글 변조 시도'));raise exception 'OTHER_USER_WRITE_ALLOWED';exception when others then if sqlerrm='OTHER_USER_WRITE_ALLOWED' then raise;end if;end;
 begin perform public.noc_api('admin');raise exception 'METADATA_ESCALATION';exception when others then if sqlerrm='METADATA_ESCALATION' then raise;end if;end;
end $$;
select public.noc_api('report',jsonb_build_object('id',current_setting('noc.test_post'),'target','post','reason','권한 검증을 위한 테스트 신고'));
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select public.noc_api('onboard','{"nickname":"NOC test owner","age_confirmed":true,"terms_accepted":true,"privacy_accepted":true,"policy_version":"2026-10-26-r1"}');
select public.noc_api('moderate',jsonb_build_object('id',current_setting('noc.test_post'),'target','post','status','hidden','reason','검증을 위한 게시물 숨김 조치'));
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform public.noc_api('post',jsonb_build_object('id',current_setting('noc.test_post')));raise exception 'HIDDEN_POST_LEAK';exception when others then if sqlerrm='HIDDEN_POST_LEAK' then raise;end if;end;
end $$;
rollback;
select 'PASS: public reads, private isolation, OAuth onboarding, ownership, rating uniqueness/bounds, notice/staff authorization, metadata escalation rejection, moderation and hidden-content isolation' as verification;
