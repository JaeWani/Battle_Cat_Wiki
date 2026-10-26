
-- Operator delegated retention selection on 2026-10-26.
-- Daily expiry affects only the categories listed below, with explicit holds excluded.
alter table noc_private.consents add column unlinked_at timestamptz;
update noc_private.consents set unlinked_at=now() where user_id is null;
alter table noc_private.appeals add column closed_at timestamptz;
update noc_private.appeals set closed_at=now() where status='closed';
create function noc_private.retention_timestamps() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='consents' then
  if old.user_id is not null and new.user_id is null then new.unlinked_at:=now();end if;
 elsif tg_table_name='appeals' then
  if new.status='closed' and old.status is distinct from 'closed' then new.closed_at:=now();
  elsif new.status='open' then new.closed_at:=null;end if;
 end if;
 return new;
end $$;
revoke all on function noc_private.retention_timestamps() from public,anon,authenticated;
create trigger noc_consent_unlink before update on noc_private.consents for each row execute function noc_private.retention_timestamps();
create trigger noc_appeal_close before update on noc_private.appeals for each row execute function noc_private.retention_timestamps();

create table noc_private.retention_holds(
 category text not null check(category in ('consents','reports','appeals','notifications','audit')),
 record_id text not null,
 reason text not null check(char_length(reason) between 5 and 1000),
 created_at timestamptz not null default now(),
 review_at timestamptz not null default now()+interval '90 days',
 primary key(category,record_id)
);
alter table noc_private.retention_holds enable row level security;
create policy noc_deny_direct on noc_private.retention_holds for all to anon,authenticated using(false) with check(false);
revoke all on noc_private.retention_holds from public,anon,authenticated;
grant all on noc_private.retention_holds to service_role;
comment on table noc_private.retention_holds is 'Operator-managed minimum evidence holds; review at least every 90 days and remove when the documented purpose ends. Not a whole-account retention override.';

create function noc_private.purge_expired_records() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare counts jsonb:='{}'; n integer;
begin
 -- Serialize with other runs; this function is not exposed to clients.
 perform pg_advisory_xact_lock(hashtextextended('noc.retention',0));
 delete from noc_private.consents c where c.user_id is null and c.unlinked_at<now()-interval '30 days'
 and not exists(select 1 from noc_private.retention_holds h where h.category='consents' and h.record_id=c.id::text);
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('consents',n);
 delete from noc_private.reports r where r.status in ('resolved','dismissed') and r.resolved_at<now()-interval '90 days'
 and not exists(select 1 from noc_private.retention_holds h where h.category='reports' and h.record_id=r.id::text);
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('reports',n);
 delete from noc_private.appeals a where a.status='closed' and a.closed_at<now()-interval '90 days'
 and not exists(select 1 from noc_private.retention_holds h where h.category='appeals' and h.record_id=a.id::text);
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('appeals',n);
 delete from noc_private.notifications a where a.created_at<now()-interval '30 days'
 and not exists(select 1 from noc_private.retention_holds h where h.category='notifications' and h.record_id=a.id::text);
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('notifications',n);
 delete from noc_private.audit a where a.created_at<now()-case when a.action like 'moderator.%' then interval '2 years' else interval '90 days' end
 and not exists(select 1 from noc_private.retention_holds h where h.category='audit' and h.record_id=a.id::text);
 get diagnostics n=row_count;counts:=counts||jsonb_build_object('audit',n);
 return counts;
end $$;
revoke all on function noc_private.purge_expired_records() from public,anon,authenticated,service_role;

-- Fail closed on stale policy acknowledgments.
do $patch$
declare definition text; needle text;
begin
 select pg_get_functiondef('noc_private.api(text,jsonb)'::regprocedure) into definition;
 needle:='if action=''onboard'' then';
 if position(needle in definition)=0 then raise exception 'onboard patch anchor missing';end if;
 definition:=replace(definition,needle,needle||E'\n  if (payload->>''policy_version'') is distinct from (select value->>''policy_version'' from noc_private.settings where key=''public'') then raise exception ''새로고침 후 최신 안내를 확인해 주세요.'';end if;');
 definition:=replace(definition,'''2026-10-26'',true','''2026-10-26-r1'',true');
 execute definition;
end $patch$;
update noc_private.settings set value=value||'{"contact_email":"battlecatwiki@gmail.com","policy_version":"2026-10-26-r1"}'::jsonb where key='public';
create extension if not exists pg_cron;
select cron.schedule('noc-retention-daily','15 19 * * *','select noc_private.purge_expired_records();');
