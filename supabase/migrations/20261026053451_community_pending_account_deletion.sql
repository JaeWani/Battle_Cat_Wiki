
-- Pending OAuth accounts must also be able to resume account deletion.
do $patch$
declare definition text; anchor text:='coalesce(member.status,''pending'')';
begin
 select pg_get_functiondef('noc_private.api(text,jsonb)'::regprocedure) into definition;
 if position(anchor in definition)=0 then raise exception 'Pending-account status anchor missing';end if;
 definition:=replace(definition,anchor,'case when exists(select 1 from noc_private.deletion_jobs where user_id=uid) then ''deleting'' else coalesce(member.status,''pending'') end');
 definition:=replace(definition,'''2026-10-26-r1'',true','(select value->>''policy_version'' from noc_private.settings where key=''public''),true');
 execute definition;
end $patch$;
update noc_private.settings set value=value||'{"policy_version":"2026-10-26-r2"}'::jsonb where key='public';
