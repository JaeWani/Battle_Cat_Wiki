-- Password hashes are deliberately separate from posts/comments: public reads use to_jsonb.
create table noc_private.content_passwords(
 id bigint generated always as identity primary key,
 post_id uuid unique references noc_private.posts(id) on delete cascade,
 comment_id uuid unique references noc_private.comments(id) on delete cascade,
 password_hash text not null,
 check(num_nonnulls(post_id,comment_id)=1)
);
create table noc_private.content_password_attempts(
 user_id uuid not null references auth.users(id) on delete cascade,
 target text not null check(target in ('post','comment')),content_id uuid not null,
 started_at timestamptz not null,failures integer not null,primary key(user_id,target,content_id)
);
create table noc_private.content_edit_permits(
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references noc_private.posts(id) on delete cascade,
 session_key text not null,expires_at timestamptz not null,
 primary key(user_id,post_id,session_key)
);
do $$declare t text;begin
 foreach t in array array['content_passwords','content_password_attempts','content_edit_permits']loop
  execute format('alter table noc_private.%I enable row level security',t);
  execute format('revoke all on noc_private.%I from public,anon,authenticated',t);
  execute format('grant all on noc_private.%I to service_role',t);
 end loop;
end$$;
revoke all on sequence noc_private.content_passwords_id_seq from public,anon,authenticated;
grant usage,select on sequence noc_private.content_passwords_id_seq to service_role;
create function noc_private.valid_content_password(password text)returns text language plpgsql security invoker set search_path='' as $$begin
 if password is null or char_length(password)<4 or octet_length(password)>72 or btrim(password)='' then raise exception '비밀번호는 4자 이상, UTF-8 72바이트 이하로 입력해 주세요.';end if;return password;
end$$;
create function noc_private.check_content_password(target text,identifier uuid,password text,initialize boolean default false)returns boolean
language plpgsql security invoker set search_path='' as $$
declare uid uuid:=auth.uid();owner_id uuid;st text;hash text;attempt noc_private.content_password_attempts;
begin
 if uid is null or not noc_private.active_member() then raise exception '로그인과 정상 이용 상태가 필요해요.';end if;
 if target='post' then select author_id,status into owner_id,st from noc_private.posts where id=identifier for update;
 elsif target='comment' then select author_id,status into owner_id,st from noc_private.comments where id=identifier for update;
 else raise exception '잘못된 대상이에요.';end if;
 if owner_id is distinct from uid or st='deleted' then raise exception '내가 작성한 글·댓글만 변경할 수 있어요.';end if;
 perform noc_private.valid_content_password(password);
 select password_hash into hash from noc_private.content_passwords where (target='post' and post_id=identifier)or(target='comment' and comment_id=identifier);
 if hash is null then
  if not initialize then raise exception '기존 글·댓글의 비밀번호를 먼저 설정해 주세요.';end if;
  insert into noc_private.content_passwords(post_id,comment_id,password_hash)values(case when target='post' then identifier end,case when target='comment' then identifier end,extensions.crypt(password,extensions.gen_salt('bf',10)));
  return true;
 end if;
 select * into attempt from noc_private.content_password_attempts where user_id=uid and content_id=identifier and content_password_attempts.target=check_content_password.target for update;
 if attempt.started_at>clock_timestamp()-interval '10 minutes' and attempt.failures>=10 then return false;end if;
 if extensions.crypt(password,hash)=hash then
  delete from noc_private.content_password_attempts where user_id=uid and content_id=identifier and content_password_attempts.target=check_content_password.target;return true;
 end if;
 insert into noc_private.content_password_attempts(user_id,target,content_id,started_at,failures)values(uid,target,identifier,clock_timestamp(),1)
 on conflict on constraint content_password_attempts_pkey do update set failures=case when content_password_attempts.started_at>clock_timestamp()-interval '10 minutes' then content_password_attempts.failures+1 else 1 end,started_at=case when content_password_attempts.started_at>clock_timestamp()-interval '10 minutes' then content_password_attempts.started_at else clock_timestamp() end;
 return false;
end$$;
-- Private copy keeps all existing account, moderation and game-profile behavior.
-- Its EXECUTE privilege is revoked so callers cannot bypass the password wrapper.
do $copy$declare definition text;begin
 select pg_get_functiondef('noc_private.api(text,jsonb)'::regprocedure) into definition;
 if position('FUNCTION noc_private.api(' in definition)=0 then raise exception 'API definition missing';end if;
 execute replace(definition,'FUNCTION noc_private.api(','FUNCTION noc_private.content_api_base(');
end$copy$;
revoke all on function noc_private.content_api_base(text,jsonb) from public,anon,authenticated,service_role;
create or replace function noc_private.api(action text,payload jsonb default '{}')returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();identifier uuid;target text;result jsonb;entry jsonb;items jsonb:='[]';password text;verified boolean;session_key text:=coalesce(auth.jwt()->>'session_id','');
begin
 if action in ('create_post','comment','save_post','edit_comment','delete_post','delete_comment','check_content_password') then
  if uid is null or not noc_private.active_member() then raise exception '로그인과 정상 이용 상태가 필요해요.';end if;
  if jsonb_typeof(payload->'password') is distinct from 'string' then raise exception '글·댓글 비밀번호를 입력해 주세요.';end if;
  password:=noc_private.valid_content_password(payload->>'password');
  if action not in ('create_post','comment') then
   identifier:=(payload->>'id')::uuid;target:=case when action in ('save_post','delete_post')then 'post' when action='check_content_password' then payload->>'target' else 'comment' end;
   verified:=noc_private.check_content_password(target,identifier,password,coalesce((payload->>'initialize_password')::boolean,false));
   -- Returning a failure (rather than raising) commits the failed-attempt counter.
   if not verified then return jsonb_build_object('ok',false,'error','비밀번호가 일치하지 않거나 확인 횟수를 초과했습니다. 10회 실패 시 10분 뒤 다시 시도해 주세요.');end if;
  end if;
  delete from noc_private.content_edit_permits where user_id=uid and expires_at<=clock_timestamp();
  if action='check_content_password' then result:='{"ok":true}';else result:=noc_private.content_api_base(action,payload-'password'-'initialize_password');end if;
  if action in ('create_post','comment')then
   identifier:=(result->>'id')::uuid;
   insert into noc_private.content_passwords(post_id,comment_id,password_hash)values(case when action='create_post'then identifier end,case when action='comment'then identifier end,extensions.crypt(password,extensions.gen_salt('bf',10)));
  end if;
  if action='create_post' or action='delete_post' or (action='check_content_password' and target='post')then
   insert into noc_private.content_edit_permits(user_id,post_id,session_key,expires_at)values(uid,identifier,session_key,clock_timestamp()+interval '15 minutes')on conflict on constraint content_edit_permits_pkey do update set expires_at=excluded.expires_at;
  end if;
  if action='save_post' then delete from noc_private.content_edit_permits where user_id=uid and post_id=identifier;end if;
  if action='delete_post' then delete from noc_private.content_passwords where post_id=identifier;end if;
  if action='delete_comment' then delete from noc_private.content_passwords where comment_id=identifier;end if;
  return result;
 end if;
 if action='request_deletion' and uid is not null then
  result:=noc_private.content_api_base(action,payload);
  delete from noc_private.content_passwords where post_id in(select id from noc_private.posts where author_id=uid)or comment_id in(select id from noc_private.comments where author_id=uid);
  delete from noc_private.content_edit_permits where user_id=uid;delete from noc_private.content_password_attempts where user_id=uid;return result;
 end if;
 result:=noc_private.content_api_base(action,payload);
 if action='post' then return result||jsonb_build_object('password_set',exists(select 1 from noc_private.content_passwords where post_id=(result->>'id')::uuid));end if;
 if action='comments' then
  for entry in select value from jsonb_array_elements(result)loop items:=items||jsonb_build_array(entry||jsonb_build_object('password_set',exists(select 1 from noc_private.content_passwords where comment_id=(entry->>'id')::uuid)));end loop;return items;
 end if;
 return result;
end$$;
create function noc_private.content_media_permitted(path text)returns boolean language plpgsql stable security definer set search_path='' as $$begin
 if auth.uid() is null or not noc_private.active_member() or path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|png|jpg)$' then return false;end if;
 return exists(select 1 from noc_private.content_edit_permits p join noc_private.posts post on post.id=p.post_id where p.user_id=auth.uid() and p.session_key=coalesce(auth.jwt()->>'session_id','') and p.post_id=split_part(path,'/',2)::uuid and post.author_id=auth.uid() and split_part(path,'/',1)=auth.uid()::text and p.expires_at>now());
exception when invalid_text_representation then return false;end$$;
revoke all on function noc_private.valid_content_password(text),noc_private.check_content_password(text,uuid,text,boolean),noc_private.content_media_permitted(text) from public,anon,authenticated,service_role;
grant execute on function noc_private.content_media_permitted(text) to authenticated,service_role;
alter policy noc_image_insert on storage.objects with check(bucket_id='community-images' and noc_private.media_access(name,true) and noc_private.content_media_permitted(name));
alter policy noc_image_delete on storage.objects using(bucket_id='community-images' and (noc_private.staff_role() is not null or noc_private.content_media_permitted(name)));

-- Expired authorization material is removed by the existing scheduled retention job.
do $cleanup$declare definition text;begin
 select pg_get_functiondef('noc_private.purge_expired_records()'::regprocedure)into definition;
 definition:=regexp_replace(definition,'\mbegin\M','begin delete from noc_private.content_edit_permits where expires_at<now(); delete from noc_private.content_password_attempts where started_at<now()-interval ''10 minutes'';','i');
 execute definition;
end$cleanup$;
