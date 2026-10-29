-- All users/content below are synthetic and rolled back. No Storage rows are modified.
begin;
insert into auth.users(id,aud,role,email)values
 ('58000000-0000-4000-8000-000000000001','authenticated','authenticated','noc-password-a@example.invalid'),
 ('58000000-0000-4000-8000-000000000002','authenticated','authenticated','noc-password-b@example.invalid');
insert into noc_private.members(id,nickname,status)values
 ('58000000-0000-4000-8000-000000000001','NOC password A','active'),
 ('58000000-0000-4000-8000-000000000002','NOC password B','active');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"58000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"password-test-a"}',true);
do $test$
declare a text;p jsonb;result jsonb;id uuid;c uuid;
begin
 id:=(public.noc_api('create_post','{"board":"free","password":" pass "}')->>'id')::uuid;
 perform set_config('noc.password_post',id::text,true);
 if not (public.noc_api('post',jsonb_build_object('id',id))->>'password_set')::boolean then raise exception 'Password state missing';end if;
 perform public.noc_api('save_post',jsonb_build_object('id',id,'password',' pass ','title','비밀번호 검증','body','변경되지 않아야 하는 본문'));
 c:=(public.noc_api('comment',jsonb_build_object('post_id',id,'body','테스트 댓글','password',' pass '))->>'id')::uuid;perform set_config('noc.password_comment',c::text,true);
 for a in select unnest(array['create_post','comment','save_post','edit_comment','delete_post','delete_comment','check_content_password'])loop
  for p in select value from jsonb_array_elements('[{}, {"password":null},{"password":1234},{"password":"abc"},{"password":"    "}]')loop
   begin perform public.noc_api(a,jsonb_build_object('id',case when a in('edit_comment','delete_comment')then c else id end,'post_id',id,'target','post','board','free','title','비밀번호 검증','body','유효한 본문')||p);raise exception 'INVALID_PASSWORD_ALLOWED';exception when others then if sqlerrm='INVALID_PASSWORD_ALLOWED' then raise;end if;end;
  end loop;
 end loop;
 begin perform public.noc_api('create_post',jsonb_build_object('board','free','password',repeat('가',25)));raise exception 'OVERSIZED_PASSWORD_ALLOWED';exception when others then if sqlerrm='OVERSIZED_PASSWORD_ALLOWED' then raise;end if;end;
 result:=public.noc_api('save_post',jsonb_build_object('id',id,'password','pass','title','변조 시도','body','실패해야 하는 본문','initialize_password',true));
 if result->>'ok'<>'false' or public.noc_api('post',jsonb_build_object('id',id))->>'body'<>'변경되지 않아야 하는 본문' then raise exception 'Wrong password changed post';end if;
 result:=public.noc_api('edit_comment',jsonb_build_object('id',c,'body','변조 시도','password','wrong'));
 if result->>'ok'<>'false' then raise exception 'Wrong comment password accepted';end if;
 perform public.noc_api('edit_comment',jsonb_build_object('id',c,'body','올바른 수정','password',' pass '));
 result:=public.noc_api('comments',jsonb_build_object('post_id',id));
 if result->0->>'body'<>'올바른 수정' or not(result->0->>'password_set')::boolean then raise exception 'Comment roundtrip failed';end if;
 result:=public.noc_api('delete_comment',jsonb_build_object('id',c,'password','wrong'));
 if result->>'ok'<>'false' then raise exception 'Wrong password deleted comment';end if;
 -- Character comments use the same password protections.
 perform public.noc_api('comment','{"character_key":"c25-2","body":"캐릭터 댓글","password":"가나다라"}');
 begin perform count(*)from noc_private.content_passwords;raise exception 'HASH_TABLE_READ_ALLOWED';exception when insufficient_privilege then null;end;
 begin perform noc_private.content_api_base('delete_post',jsonb_build_object('id',id));raise exception 'BYPASS_ALLOWED';exception when insufficient_privilege then null;end;
 begin perform noc_private.check_content_password('post',id,'wrong',true);raise exception 'HELPER_BYPASS_ALLOWED';exception when insufficient_privilege then null;end;
 if noc_private.content_media_permitted(auth.uid()::text||'/'||id||'/58000000-0000-4000-8000-000000000099.webp') then raise exception 'Save left media permit';end if;
end$test$;
reset role;
do $$declare h1 text;h2 text;begin
 select password_hash into h1 from noc_private.content_passwords where post_id=current_setting('noc.password_post')::uuid;
 select password_hash into h2 from noc_private.content_passwords where comment_id=current_setting('noc.password_comment')::uuid;
 if h1=h2 or h1 not like '$2a$10$%' or extensions.crypt(' pass ',h1)<>h1 then raise exception 'Salted bcrypt hashing failed';end if;
 if (select failures from noc_private.content_password_attempts where content_id=current_setting('noc.password_post')::uuid)<>1 then raise exception 'Wrong attempt did not persist';end if;
end$$;
-- Storage policies must require the same session-scoped verifier; no Storage rows are modified.
do $$begin
 if not exists(select 1 from pg_policies where schemaname='storage' and policyname='noc_image_delete' and qual like '%content_media_permitted%') then raise exception 'Storage delete guard missing';end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and policyname='noc_image_insert' and with_check like '%content_media_permitted%') then raise exception 'Storage insert guard missing';end if;
end$$;
set local role authenticated;
do $$declare result jsonb;id uuid:=current_setting('noc.password_post')::uuid;begin
 for i in 1..9 loop perform public.noc_api('check_content_password',jsonb_build_object('target','post','id',id,'password','wrong'));end loop;
 result:=public.noc_api('check_content_password',jsonb_build_object('target','post','id',id,'password',' pass '));
 if result->>'ok'<>'false' then raise exception 'Rate limit bypassed';end if;
end$$;
reset role;
update noc_private.content_password_attempts set started_at=clock_timestamp()-interval '11 minutes' where content_id=current_setting('noc.password_post')::uuid;
set local role authenticated;
select public.noc_api('check_content_password',jsonb_build_object('target','post','id',current_setting('noc.password_post'),'password',' pass '));
do $$begin
 if not noc_private.content_media_permitted(auth.uid()::text||'/'||current_setting('noc.password_post')||'/58000000-0000-4000-8000-000000000099.webp') then raise exception 'Verified media permit missing';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"58000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"password-test-b"}',true);
do $$begin
 if noc_private.content_media_permitted(auth.uid()::text||'/'||current_setting('noc.password_post')||'/58000000-0000-4000-8000-000000000099.webp') then raise exception 'Permit leaked between sessions';end if;
end$$;
reset role;
update noc_private.content_edit_permits set expires_at=now()-interval '1 minute' where user_id='58000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"58000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"password-test-a"}',true);
do $$begin
 if noc_private.content_media_permitted(auth.uid()::text||'/'||current_setting('noc.password_post')||'/58000000-0000-4000-8000-000000000099.webp') then raise exception 'Expired media permit allowed';end if;
end$$;
select set_config('request.jwt.claims','{"sub":"58000000-0000-4000-8000-000000000002","role":"authenticated","session_id":"password-test-a"}',true);
do $$begin
 begin perform public.noc_api('delete_post',jsonb_build_object('id',current_setting('noc.password_post'),'password',' pass '));raise exception 'OTHER_AUTHOR_ALLOWED';exception when others then if sqlerrm='OTHER_AUTHOR_ALLOWED' then raise;end if;end;
end$$;
reset role;
-- Existing content has no credential until its authenticated author initializes it.
insert into noc_private.posts(id,author_id,board,title,body,status)values('58000000-0000-4000-8000-000000000003','58000000-0000-4000-8000-000000000001','free','기존 글','기존 본문','published');
insert into noc_private.comments(id,author_id,post_id,body)values('58000000-0000-4000-8000-000000000004','58000000-0000-4000-8000-000000000001','58000000-0000-4000-8000-000000000003','기존 댓글');
set local role authenticated;
do $$begin
 begin perform public.noc_api('check_content_password','{"target":"post","id":"58000000-0000-4000-8000-000000000003","password":"new-pass","initialize_password":true}');raise exception 'OTHER_AUTHOR_INITIALIZED';exception when others then if sqlerrm='OTHER_AUTHOR_INITIALIZED' then raise;end if;end;
end$$;
select set_config('request.jwt.claims','{"sub":"58000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"password-test-a"}',true);
do $$begin
 begin perform public.noc_api('save_post','{"id":"58000000-0000-4000-8000-000000000003","password":"new-pass","title":"기존 글 수정","body":"기존 본문 수정"}');raise exception 'LEGACY_SILENT_INITIALIZATION';exception when others then if sqlerrm='LEGACY_SILENT_INITIALIZATION' then raise;end if;end;
 perform public.noc_api('check_content_password','{"target":"post","id":"58000000-0000-4000-8000-000000000003","password":"new-pass","initialize_password":true}');
 perform public.noc_api('save_post','{"id":"58000000-0000-4000-8000-000000000003","password":"new-pass","title":"기존 글 수정","body":"기존 본문 수정"}');
 perform public.noc_api('delete_comment','{"id":"58000000-0000-4000-8000-000000000004","password":"new-pass","initialize_password":true}');
 perform public.noc_api('delete_comment',jsonb_build_object('id',current_setting('noc.password_comment'),'password',' pass '));
 perform public.noc_api('delete_post',jsonb_build_object('id',current_setting('noc.password_post'),'password',' pass '));
end$$;
reset role;
do $$begin
 if exists(select 1 from noc_private.content_passwords where post_id=current_setting('noc.password_post')::uuid or comment_id in(current_setting('noc.password_comment')::uuid,'58000000-0000-4000-8000-000000000004')) then raise exception 'Deleted content retained hash';end if;
end$$;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$declare result jsonb;begin
 result:=public.noc_api('post','{"id":"58000000-0000-4000-8000-000000000003"}');
 if result::text like '%password_hash%' or result::text like '%new-pass%' then raise exception 'Public post leaked credential';end if;
 result:=public.noc_api('comments','{"character_key":"c25-2"}');
 if result::text like '%password_hash%' or result::text like '%가나다라%' then raise exception 'Public comment leaked credential';end if;
 begin perform public.noc_api('check_content_password','{"target":"post","id":"58000000-0000-4000-8000-000000000003","password":"new-pass"}');raise exception 'ANONYMOUS_PASSWORD_ALLOWED';exception when others then if sqlerrm='ANONYMOUS_PASSWORD_ALLOWED' then raise;end if;end;
end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"58000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"password-test-a"}',true);
select public.noc_api('request_deletion','{"confirm":"회원탈퇴"}');
reset role;
do $$begin
 if exists(select 1 from noc_private.content_passwords cp left join noc_private.posts p on p.id=cp.post_id left join noc_private.comments c on c.id=cp.comment_id where p.author_id='58000000-0000-4000-8000-000000000001' or c.author_id='58000000-0000-4000-8000-000000000001')then raise exception 'Withdrawal retained credentials';end if;
 if exists(select 1 from noc_private.content_edit_permits where user_id='58000000-0000-4000-8000-000000000001')then raise exception 'Withdrawal retained permits';end if;
end$$;
rollback;
select 'PASS: required passwords, salted bcrypt, ownership, private hash isolation, edit/delete verification, failed-attempt persistence/lockout, Storage policy guards, session permits, legacy setup, public non-disclosure and withdrawal cleanup' as result;
