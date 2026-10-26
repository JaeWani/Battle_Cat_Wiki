
begin;
do $test$
declare expired bigint; recent bigint; held bigint; ordinary bigint; privileged bigint; open_case uuid; old_closed uuid; newly_closed uuid; c bigint;
begin
 insert into noc_private.consents(document,version,accepted,recorded_at,unlinked_at) values('privacy','retention-test',true,now()-interval '5 years',now()-interval '31 days') returning id into expired;
 insert into noc_private.consents(document,version,accepted,recorded_at,unlinked_at) values('privacy','retention-test',true,now()-interval '5 years',now()-interval '1 day') returning id into recent;
 insert into noc_private.consents(document,version,accepted,unlinked_at) values('privacy','retention-test',true,now()-interval '31 days') returning id into held;
 insert into noc_private.retention_holds(category,record_id,reason)values('consents',held::text,'Synthetic legal hold test');
 insert into noc_private.audit(action,created_at) values('post.save',now()-interval '91 days')returning id into ordinary;
 insert into noc_private.audit(action,created_at) values('moderator.workspace_read',now()-interval '91 days')returning id into privileged;
 insert into noc_private.appeals(message,created_at)values('Synthetic old open inquiry',now()-interval '1 year')returning id into open_case;
 insert into noc_private.appeals(message,status,closed_at)values('Synthetic closed inquiry','closed',now()-interval '91 days')returning id into old_closed;
 insert into noc_private.appeals(message,created_at)values('Synthetic recent closure',now()-interval '1 year')returning id into newly_closed;
 update noc_private.appeals set status='closed' where id=newly_closed;
 if (select closed_at from noc_private.appeals where id=newly_closed) is distinct from now() then raise exception 'Closure clock failed';end if;
 perform noc_private.purge_expired_records();
 if exists(select 1 from noc_private.consents where id=expired) or exists(select 1 from noc_private.audit where id=ordinary) or exists(select 1 from noc_private.appeals where id=old_closed) then raise exception 'Expired row retained';end if;
 if not exists(select 1 from noc_private.consents where id=recent) or not exists(select 1 from noc_private.consents where id=held) or not exists(select 1 from noc_private.audit where id=privileged) or not exists(select 1 from noc_private.appeals where id=open_case) or not exists(select 1 from noc_private.appeals where id=newly_closed) then raise exception 'Unexpired/open/held row deleted';end if;
 if has_function_privilege('anon','noc_private.purge_expired_records()','execute') or has_function_privilege('authenticated','noc_private.purge_expired_records()','execute') then raise exception 'Public purge access';end if;
end $test$;
select 'Retention expiry, closure clock, holds and privilege tests passed' as result;
rollback;