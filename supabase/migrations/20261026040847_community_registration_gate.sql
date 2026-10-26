
create table noc_private.settings(key text primary key,value jsonb not null);
alter table noc_private.settings enable row level security;
create policy noc_deny_direct on noc_private.settings for all to anon,authenticated using(false) with check(false);
revoke all on noc_private.settings from public,anon,authenticated;
grant all on noc_private.settings to service_role;
insert into noc_private.settings(key,value)values('public','{"registration_open":false,"contact_email":"","policy_version":"2026-10-26"}');
create or replace function noc_private.api(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); role_name text:=noc_private.staff_role(); member noc_private.members; item noc_private.posts; comment_item noc_private.comments;
 key_text text; identifier uuid; result jsonb; page_num integer; search_text text; board_name text; reason_text text; target_author uuid; snapshot_data jsonb; new_status text;
begin
 page_num:=least(10000,greatest(0,coalesce((payload->>'page')::integer,0)));
 if action='site_settings' then return (select value from noc_private.settings where key='public');end if;
 if action='boards' then return '[{"id":"free","name":"자유게시판"},{"id":"question","name":"질문·답변"},{"id":"guide","name":"공략·팁"},{"id":"notice","name":"공지사항"}]'; end if;
 if action='list_posts' then
  board_name:=payload->>'board'; search_text:=left(trim(coalesce(payload->>'query','')),100);
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (
   select p.id,p.board,p.title,left(p.body,120) as excerpt,p.author_id,coalesce(m.nickname,'탈퇴한 회원') as nickname,p.created_at,p.updated_at,
   (select count(*) from noc_private.comments c where c.post_id=p.id and c.status='published') as comment_count,
   (select count(*) from storage.objects o where o.bucket_id='community-images' and o.name like p.author_id::text||'/'||p.id::text||'/%') as image_count
   from noc_private.posts p left join noc_private.members m on m.id=p.author_id where p.status='published' and (board_name is null or board_name='all' or p.board=board_name)
    and (search_text='' or p.title ilike '%'||search_text||'%' or p.body ilike '%'||search_text||'%') order by p.created_at desc limit 21 offset page_num*20
  ) q; return result;
 end if;
 if action='post' then
  identifier:=(payload->>'id')::uuid;select * into item from noc_private.posts where id=identifier;
  if not found or not (item.status='published' or (uid is not null and (item.author_id=uid or role_name is not null))) then raise exception '게시글을 찾을 수 없어요.'; end if;
  if item.status<>'published' and role_name is not null then insert into noc_private.audit(actor_id,action,target_id) values(uid,'moderator.read_post',identifier::text);end if;
  select to_jsonb(item)||jsonb_build_object('nickname',coalesce((select nickname from noc_private.members where id=item.author_id),'탈퇴한 회원'),'images',(select coalesce(jsonb_agg(name order by created_at),'[]') from storage.objects where bucket_id='community-images' and name like item.author_id::text||'/'||item.id::text||'/%')) into result;
  return result;
 end if;
 if action='comments' then
  if payload->>'post_id' is not null and not exists(select 1 from noc_private.posts where id=(payload->>'post_id')::uuid and status='published') then return '[]';end if;
  select coalesce(jsonb_agg(to_jsonb(q)),'[]') into result from (
   select c.id,c.author_id,coalesce(m.nickname,'탈퇴한 회원') nickname,c.body,c.created_at,c.updated_at from noc_private.comments c left join noc_private.members m on m.id=c.author_id
   where c.status='published' and ((payload->>'post_id' is not null and c.post_id=(payload->>'post_id')::uuid) or (payload->>'character_key' is not null and c.character_key=payload->>'character_key'))
   order by c.created_at desc limit 21 offset page_num*20
  )q;return result;
 end if;
 if action='character' then
  key_text:=payload->>'key';if not exists(select 1 from noc_private.characters where key=key_text) then raise exception '등록되지 않은 캐릭터예요.';end if;
  return jsonb_build_object('count',(select count(*) from noc_private.ratings where character_key=key_text),'average',(select round(avg(stars),2) from noc_private.ratings where character_key=key_text),'mine',(select stars from noc_private.ratings where character_key=key_text and user_id=uid));
 end if;
 if uid is null then raise exception '로그인이 필요해요.';end if;
 -- Provider tokens/metadata never assign privileges. Staff is an operator-managed private table.
 select * into member from noc_private.members where id=uid;
 if action='me' then
  return jsonb_build_object('id',uid,'nickname',member.nickname,'status',coalesce(member.status,'pending'),'role',role_name,'notifications',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from (select id,message,seen,created_at from noc_private.notifications where user_id=uid order by created_at desc limit 30)n),'posts',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from (select id,title,status,created_at from noc_private.posts where author_id=uid order by created_at desc limit 50)p),'appeals',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select id,message,answer,status,created_at from noc_private.appeals where user_id=uid order by created_at desc limit 20)a));
 end if;
 if action='onboard' then
  if not coalesce((select (value->>'registration_open')::boolean from noc_private.settings where key='public'),false) then raise exception '정식 가입 안내를 준비 중이에요.';end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if member.status='active' then raise exception '이미 가입을 완료했어요.';end if;
  if not exists(select 1 from auth.identities where user_id=uid and provider in ('google','apple')) then raise exception '구글 또는 애플 로그인이 필요해요.';end if;
  if not coalesce((payload->>'age_confirmed')::boolean,false) or not coalesce((payload->>'terms_accepted')::boolean,false) or not coalesce((payload->>'privacy_accepted')::boolean,false) then raise exception '만 14세 이상 확인과 필수 약관 확인이 필요해요.';end if;
  if exists(select 1 from noc_private.members where id=uid and status in ('suspended','deleting')) then raise exception '가입 상태를 변경할 수 없어요.';end if;
  key_text:=trim(payload->>'nickname');if char_length(key_text) not between 2 and 20 or key_text ~ '[[:cntrl:]]' then raise exception '닉네임은 2~20자로 입력해 주세요.';end if;
  insert into noc_private.members(id,nickname,status) values(uid,key_text,'active') on conflict(id) do update set nickname=excluded.nickname,status='active',updated_at=now();
  insert into noc_private.consents(user_id,document,version,accepted) values(uid,'terms','2026-10-26',true),(uid,'privacy','2026-10-26',true),(uid,'age_14_or_over','2026-10-26',true);
  insert into noc_private.audit(actor_id,action)values(uid,'member.onboard');return jsonb_build_object('ok',true);
 end if;
 if action='appeal' then
  if member.id is null then raise exception '가입을 완료해 주세요.';end if;
  if exists(select 1 from noc_private.appeals where user_id=uid and created_at>now()-interval '1 hour')then raise exception '문의는 1시간에 한 번 접수할 수 있어요.';end if;
  insert into noc_private.appeals(user_id,message)values(uid,trim(payload->>'message'));return '{"ok":true}';
 end if;
 if action='request_deletion' then
  if (payload->>'confirm') is distinct from '회원탈퇴' then raise exception '회원탈퇴 확인이 필요해요.';end if;
  insert into noc_private.deletion_jobs(user_id)values(uid)on conflict do nothing;
  update noc_private.members set status='deleting',updated_at=now() where id=uid;
  update noc_private.posts set status='deleted',body='',title='삭제된 게시글',updated_at=now() where author_id=uid;
  update noc_private.comments set status='deleted',body='삭제된 댓글',updated_at=now() where author_id=uid;
  delete from noc_private.ratings where user_id=uid;
  insert into noc_private.audit(actor_id,action)values(uid,'member.deletion_requested');return '{"ok":true}';
 end if;
 if action='admin' then
  if role_name is null then raise exception '운영자 권한이 필요해요.';end if;
  insert into noc_private.audit(actor_id,action)values(uid,'moderator.workspace_read');
  return jsonb_build_object('reports',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select id,target_type,target_id,reason,status,snapshot,resolution,created_at from noc_private.reports order by created_at desc limit 50)r),'appeals',(select coalesce(jsonb_agg(to_jsonb(a)),'[]')from(select a.id,a.user_id,m.nickname,a.message,a.answer,a.status,a.created_at from noc_private.appeals a left join noc_private.members m on m.id=a.user_id order by a.created_at desc limit 50)a),'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]')from(select id,action,target_id,created_at from noc_private.audit order by created_at desc limit 50)a));
 end if;
 if action='moderate' then
  if role_name is null then raise exception '운영자 권한이 필요해요.';end if;
  reason_text:=trim(payload->>'reason');if char_length(reason_text) not between 5 and 1000 then raise exception '조치 사유를 5자 이상 입력해 주세요.';end if;
  identifier:=(payload->>'id')::uuid;
  if payload->>'target'='appeal' then
   update noc_private.appeals set answer=reason_text,status='closed' where id=identifier returning user_id into target_author;
  elsif payload->>'target'='member' then
   if role_name<>'owner' then raise exception '회원 제재는 관리자만 할 수 있어요.';end if;
   if exists(select 1 from noc_private.staff where user_id=identifier)then raise exception '운영진 계정은 이 화면에서 제재할 수 없어요.';end if;
   new_status:=payload->>'status';if new_status not in ('active','suspended')then raise exception '잘못된 계정 상태예요.';end if;
   update noc_private.members set status=new_status,updated_at=now() where id=identifier returning id into target_author;
  elsif payload->>'target'='report' then
   new_status:=payload->>'status';if new_status not in ('resolved','dismissed')then raise exception '잘못된 신고 상태예요.';end if;
   update noc_private.reports set status=new_status,resolution=reason_text,resolved_at=now() where id=identifier returning reporter_id into target_author;
  else
   new_status:=payload->>'status';if new_status not in ('published','hidden')then raise exception '잘못된 게시물 상태예요.';end if;
   if payload->>'target'='post' then update noc_private.posts set status=new_status,updated_at=now() where id=identifier and status not in ('draft','deleted') returning author_id into target_author;
   elsif payload->>'target'='comment' then update noc_private.comments set status=new_status,updated_at=now() where id=identifier and status<>'deleted' returning author_id into target_author;
   else raise exception '잘못된 대상이에요.';end if;
  end if;
  if not found then raise exception '대상을 찾을 수 없어요.';end if;
  insert into noc_private.audit(actor_id,action,target_id,detail)values(uid,'moderator.'||(payload->>'target'),identifier::text,jsonb_build_object('reason',reason_text,'status',payload->>'status'));
  if target_author is not null then insert into noc_private.notifications(user_id,message)values(target_author,'운영 처리 안내: '||reason_text);end if;
  return '{"ok":true}';
 end if;
 if not noc_private.active_member() then raise exception '가입 완료 및 정상 이용 상태가 필요해요.';end if;
 -- Serialize a member's writes to enforce limits even under concurrent requests.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if action='nickname' then
  key_text:=trim(payload->>'nickname');if char_length(key_text) not between 2 and 20 or key_text ~ '[[:cntrl:]]' then raise exception '닉네임은 2~20자로 입력해 주세요.';end if;
  update noc_private.members set nickname=key_text,updated_at=now() where id=uid;return '{"ok":true}';
 elsif action='notifications_seen' then update noc_private.notifications set seen=true where user_id=uid;return '{"ok":true}';
 elsif action='create_post' then
  if (select count(*) from noc_private.posts where author_id=uid and created_at>now()-interval '1 hour')>=10 then raise exception '게시글은 한 시간에 10개까지 작성할 수 있어요.';end if;
  board_name:=payload->>'board';if board_name='notice' and role_name is null then raise exception '공지는 운영자만 작성할 수 있어요.';end if;
  insert into noc_private.posts(author_id,board)values(uid,board_name)returning id into identifier;return jsonb_build_object('id',identifier);
 elsif action='save_post' then
  identifier:=(payload->>'id')::uuid;select * into item from noc_private.posts where id=identifier for update;
  if not found or item.author_id is distinct from uid or item.status not in ('draft','published') then raise exception '게시글을 수정할 수 없어요.';end if;
  if item.board='notice' and role_name is null then raise exception '공지는 운영자만 수정할 수 있어요.';end if;
  if char_length(trim(payload->>'title')) not between 2 and 100 or char_length(trim(payload->>'body')) not between 2 and 20000 then raise exception '제목은 2~100자, 본문은 2~20,000자로 입력해 주세요.';end if;
  if(select count(*) from storage.objects where bucket_id='community-images' and name like uid::text||'/'||identifier::text||'/%')>3 then raise exception '이미지는 3장까지만 첨부할 수 있어요.';end if;
  update noc_private.posts set title=trim(payload->>'title'),body=trim(payload->>'body'),status='published',updated_at=now() where id=identifier;
  insert into noc_private.audit(actor_id,action,target_id)values(uid,'post.save',identifier::text);return jsonb_build_object('id',identifier);
 elsif action='delete_post' then
  identifier:=(payload->>'id')::uuid;update noc_private.posts set title='삭제된 게시글',body='',status='deleted',updated_at=now() where id=identifier and author_id=uid;
  if not found then raise exception '삭제할 게시글을 찾을 수 없어요.';end if;
  insert into noc_private.audit(actor_id,action,target_id)values(uid,'post.delete',identifier::text);return '{"ok":true}';
 elsif action='comment' then
  if(select count(*)from noc_private.comments where author_id=uid and created_at>now()-interval '1 minute')>=5 then raise exception '댓글은 1분에 5개까지 작성할 수 있어요.';end if;
  if payload->>'post_id' is not null and not exists(select 1 from noc_private.posts where id=(payload->>'post_id')::uuid and status='published')then raise exception '댓글을 작성할 수 없는 게시글이에요.';end if;
  insert into noc_private.comments(author_id,post_id,character_key,body)values(uid,(payload->>'post_id')::uuid,payload->>'character_key',trim(payload->>'body'))returning id into identifier;
  if payload->>'post_id' is not null then
   insert into noc_private.notifications(user_id,message)select author_id,'내 게시글에 새 댓글이 달렸어요.' from noc_private.posts where id=(payload->>'post_id')::uuid and author_id<>uid;
  end if;
  return jsonb_build_object('id',identifier);
 elsif action='edit_comment' then
  update noc_private.comments set body=trim(payload->>'body'),updated_at=now() where id=(payload->>'id')::uuid and author_id=uid and status='published';if not found then raise exception '댓글을 수정할 수 없어요.';end if;return '{"ok":true}';
 elsif action='delete_comment' then
  update noc_private.comments set body='삭제된 댓글',status='deleted',updated_at=now() where id=(payload->>'id')::uuid and author_id=uid;if not found then raise exception '댓글을 삭제할 수 없어요.';end if;return '{"ok":true}';
 elsif action='rate' then
  if payload->>'stars' is null then delete from noc_private.ratings where user_id=uid and character_key=payload->>'key';
  else insert into noc_private.ratings(user_id,character_key,stars)values(uid,payload->>'key',(payload->>'stars')::smallint)on conflict(user_id,character_key)do update set stars=excluded.stars,updated_at=now();end if;return '{"ok":true}';
 elsif action='report' then
  identifier:=(payload->>'id')::uuid;
  if(select count(*)from noc_private.reports where reporter_id=uid and created_at>now()-interval '1 day')>=10 then raise exception '신고는 하루에 10개까지 접수할 수 있어요.';end if;
  if payload->>'target'='post' then select jsonb_build_object('title',title,'body',body,'author_id',author_id,'status',status)into snapshot_data from noc_private.posts where id=identifier and status='published';
  elsif payload->>'target'='comment' then select jsonb_build_object('body',body,'author_id',author_id,'status',status)into snapshot_data from noc_private.comments where id=identifier and status='published';end if;
  if snapshot_data is null then raise exception '신고할 대상을 찾을 수 없어요.';end if;
  insert into noc_private.reports(reporter_id,target_type,target_id,reason,snapshot)values(uid,payload->>'target',identifier,trim(payload->>'reason'),snapshot_data);return '{"ok":true}';
 else raise exception '지원하지 않는 요청이에요.';
 end if;
exception when unique_violation then raise exception '이미 사용 중인 닉네임이거나 접수된 요청이에요.';
end $$;
