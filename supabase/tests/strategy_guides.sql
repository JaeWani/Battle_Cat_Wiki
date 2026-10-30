begin;
insert into auth.users(id,aud,role,email)values('59000000-0000-4000-8000-000000000001','authenticated','authenticated','noc-guide-a@example.invalid'),('59000000-0000-4000-8000-000000000002','authenticated','authenticated','noc-guide-b@example.invalid');
insert into noc_private.members(id,nickname,status)values('59000000-0000-4000-8000-000000000001','NOC guide A','active'),('59000000-0000-4000-8000-000000000002','NOC guide B','active');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"59000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $test$declare id uuid;second uuid;strategy jsonb;result jsonb;bad jsonb;profile jsonb;begin
 strategy:='{"publishAccepted":true,"stageKey":"S250-0","crown":1,"region":"kr","outcome":"clear","lineup":[{"id":32,"form":2,"level":30,"plus":0,"role":"damage","talents":[{"id":31,"level":10}],"private_code":"DO_NOT_STORE"}],"treasures":{"world":"max","future":"unknown","cosmos":"any"},"items":[],"email":"DO_NOT_STORE"}';
 id:=(public.noc_api('create_post','{"board":"guide","password":"guide-test"}')->>'id')::uuid;perform set_config('noc.guide_post',id::text,true);
 perform public.noc_api('save_post',jsonb_build_object('id',id,'title','공략 권한 검증','body','트랜잭션 테스트용 공략 본문','password','guide-test','strategy',strategy));
 result:=public.noc_api('post',jsonb_build_object('id',id));if result::text like '%DO_NOT_STORE%' or result->'strategy'->>'stageKey'<>'S250-0' then raise exception 'Guide roundtrip/whitelist failed';end if;
 result:=public.noc_api('save_post',jsonb_build_object('id',id,'title','잘못된 비밀번호','body','변조 시도','password','wrong','strategy',null));if result->>'ok'<>'false' then raise exception 'Password bypass';end if;
 if public.noc_api('post',jsonb_build_object('id',id))->'strategy'->>'stageKey' is distinct from 'S250-0' then raise exception 'Wrong password removed guide';end if;
 for bad in select value from jsonb_array_elements('[{"stageKey":"S999-999"},{"stageKey":"S250-00"},{"crown":0},{"region":"jp"},{"outcome":"verified"},{"publishAccepted":false},{"lineup":[]},{"items":["injected"]},{"lineup":[{"id":32,"form":2,"level":30,"plus":0,"role":"damage","talents":[{"id":31,"level":11}]}]},{"lineup":[{"id":32,"form":2,"level":30,"plus":0,"role":"damage","talents":[]},{"id":32,"form":0,"level":30,"plus":0,"role":"damage","talents":[]}]}]')loop
  begin perform public.noc_api('save_post',jsonb_build_object('id',id,'title','무효 공략 변경','body','무효 공략 변경 본문','password','guide-test','strategy',strategy||bad));raise exception 'INVALID_GUIDE_ALLOWED';exception when others then if sqlerrm='INVALID_GUIDE_ALLOWED' then raise;end if;end;
 end loop;
 if public.noc_api('post',jsonb_build_object('id',id))->>'title'<>'공략 권한 검증' then raise exception 'Invalid guide partially saved post';end if;
 second:=(public.noc_api('create_post','{"board":"guide","password":"guide-test"}')->>'id')::uuid;perform set_config('noc.guide_second',second::text,true);
 perform public.noc_api('save_post',jsonb_build_object('id',second,'title','두 번째 공략','body','캐릭터가 다른 공략 본문','password','guide-test','strategy',jsonb_set(strategy,'{lineup}','[{"id":30,"form":2,"level":30,"plus":0,"role":"damage","talents":null}]')));
 profile:=jsonb_build_object('source','manual','gameVersion',null,'region','kr','progressKnown',false,'game_data_accepted',true,'policy_version',public.noc_api('site_settings')->>'policy_version','expected_updated_at',null,'cats','[{"id":32,"form":2,"level":30,"plus":0,"talents":[{"id":31,"level":10}]}]'::jsonb,'progress',(select jsonb_agg(jsonb_build_object('progress',0,'cleared',0,'gold',0))from generate_series(1,9)));
 perform public.noc_api('save_game_profile',profile);
 result:=public.noc_api('list_guides','{"stageKey":"S250-0","similar":true}');if result->0->>'id'<>id::text or (result->0->>'distance')::numeric<>0 then raise exception 'Own profile matching failed';end if;
 begin perform count(*)from noc_private.strategy_guides;raise exception 'PRIVATE_GUIDE_READ';exception when insufficient_privilege then null;end;
 begin perform noc_private.store_strategy(id,strategy);raise exception 'DIRECT_GUIDE_WRITE';exception when insufficient_privilege then null;end;
end$test$;
select set_config('request.jwt.claims','{"sub":"59000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"owner"}}',true);
do $$declare result jsonb;begin
 begin perform public.noc_api('save_post',jsonb_build_object('id',current_setting('noc.guide_post'),'password','guide-test','title','승인되지 않은 변경','body','다른 계정에서의 변조 시도','strategy',null));raise exception 'OTHER_AUTHOR_GUIDE_WRITE';exception when others then if sqlerrm='OTHER_AUTHOR_GUIDE_WRITE' then raise;end if;end;
 begin perform public.noc_api('list_guides','{"similar":true}');raise exception 'OTHER_PROFILE_LEAK';exception when others then if sqlerrm='OTHER_PROFILE_LEAK' then raise;end if;end;
 perform public.noc_api('save_game_profile',jsonb_build_object('source','manual','gameVersion',null,'region','kr','progressKnown',false,'game_data_accepted',true,'policy_version',public.noc_api('site_settings')->>'policy_version','expected_updated_at',null,'cats','[{"id":30,"form":2,"level":30,"plus":0,"talents":null}]'::jsonb,'progress',(select jsonb_agg(jsonb_build_object('progress',0,'cleared',0,'gold',0))from generate_series(1,9))));
 result:=public.noc_api('list_guides','{"stageKey":"S250-0","similar":true,"user_id":"59000000-0000-4000-8000-000000000001"}');
 if result->0->>'id'<>current_setting('noc.guide_second')then raise exception 'Other profile selector affected matching';end if;

end$$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$declare result jsonb;begin
 result:=public.noc_api('list_guides','{"stageKey":"S250-0","crown":1,"outcome":"clear"}');if jsonb_array_length(result)<2 then raise exception 'Public guide search failed';end if;
 if jsonb_array_length(public.noc_api('list_guides','{"stageKey":"S250-0","crown":4}'))<>0 then raise exception 'Crown filtering failed';end if;
 begin perform public.noc_api('list_guides','{"similar":true}');raise exception 'ANON_PRIVATE_MATCH';exception when others then if sqlerrm='ANON_PRIVATE_MATCH' then raise;end if;end;
end$$;
reset role;
update noc_private.posts set status='hidden' where id=current_setting('noc.guide_post')::uuid;
set local role anon;
do $$declare entry jsonb;begin for entry in select value from jsonb_array_elements(public.noc_api('list_guides','{"stageKey":"S250-0"}'))loop if entry->>'id'=current_setting('noc.guide_post')then raise exception 'Hidden guide leaked';end if;end loop;end$$;
reset role;
update noc_private.posts set status='published' where id=current_setting('noc.guide_post')::uuid;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"59000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

select public.noc_api('save_post',jsonb_build_object('id',current_setting('noc.guide_second'),'password','guide-test','title','공략 조건 제거','body','일반 공략 본문만 남깁니다.','strategy',null));
do $$begin if public.noc_api('post',jsonb_build_object('id',current_setting('noc.guide_second')))->'strategy'<>'null'::jsonb then raise exception 'Guide opt out failed';end if;end$$;
select public.noc_api('request_deletion','{"confirm":"회원탈퇴"}');
reset role;
do $$begin if exists(select 1 from noc_private.strategy_guides where post_id in(current_setting('noc.guide_post')::uuid,current_setting('noc.guide_second')::uuid))then raise exception 'Withdrawal retained guide metadata';end if;end$$;
rollback;
select 'PASS: structured guide roundtrip, allowlist/type/range validation, atomic saves, password and ownership guards, public search, private profile ranking, anonymous denial, hidden isolation and withdrawal cleanup' as result;
