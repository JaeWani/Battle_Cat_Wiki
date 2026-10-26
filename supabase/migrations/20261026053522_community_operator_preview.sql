
-- The operator supplied this contact address; Auth confirms a Google identity and verified email.
do $owner$
begin
 if (select count(*) from auth.users u where lower(u.email)='battlecatwiki@gmail.com' and u.email_confirmed_at is not null and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google'))<>1 then raise exception 'Verified operator account must be unique';end if;
 insert into noc_private.staff(user_id,role)
 select u.id,'owner' from auth.users u where lower(u.email)='battlecatwiki@gmail.com'
 and u.email_confirmed_at is not null and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google')
 on conflict(user_id) do update set role='owner';
end $owner$;
do $patch$
declare definition text; anchor text:='if not coalesce((select (value->>''registration_open'')::boolean from noc_private.settings where key=''public''),false) then';
begin
 select pg_get_functiondef('noc_private.api(text,jsonb)'::regprocedure) into definition;
 if position(anchor in definition)=0 then raise exception 'Registration gate anchor missing';end if;
 definition:=replace(definition,anchor,replace(anchor,' then',' and role_name is null then'));
 execute definition;
end $patch$;
