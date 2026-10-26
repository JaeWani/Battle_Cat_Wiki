
begin;
update noc_private.settings set value=value||'{"registration_open":false}'::jsonb where key='public';
insert into auth.users(id,aud,role,email)values
 ('30000000-0000-4000-8000-000000000001','authenticated','authenticated','noc-pending@example.invalid'),
 ('30000000-0000-4000-8000-000000000002','authenticated','authenticated','noc-closed@example.invalid'),
 ('30000000-0000-4000-8000-000000000003','authenticated','authenticated','noc-preview@example.invalid');
insert into auth.identities(user_id,provider_id,identity_data,provider)
select id,id::text,jsonb_build_object('sub',id),'google' from auth.users where id in ('30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003');
insert into noc_private.staff(user_id,role)values('30000000-0000-4000-8000-000000000003','owner');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 begin perform public.noc_api('onboard','{"nickname":"closed test","age_confirmed":true,"terms_accepted":true,"privacy_accepted":true,"policy_version":"2026-10-26-r2"}');raise exception 'PUBLIC_GATE_BYPASS';exception when others then if sqlerrm='PUBLIC_GATE_BYPASS' then raise;end if;end;
end $$;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
 begin perform public.noc_api('onboard','{"nickname":"stale test","age_confirmed":true,"terms_accepted":true,"privacy_accepted":true,"policy_version":"stale"}');raise exception 'STALE_VERSION_ALLOWED';exception when others then if sqlerrm='STALE_VERSION_ALLOWED' then raise;end if;end;
end $$;
select public.noc_api('onboard','{"nickname":"preview test","age_confirmed":true,"terms_accepted":true,"privacy_accepted":true,"policy_version":"2026-10-26-r2"}');
do $$ begin if public.noc_api('me')->>'status'<>'active' then raise exception 'Operator preview failed';end if;end $$;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.noc_api('request_deletion','{"confirm":"회원탈퇴"}');
do $$ begin
 if public.noc_api('me')->>'status'<>'deleting' then raise exception 'Pending deletion status missing';end if;
 begin perform public.noc_api('create_post','{"board":"free"}');raise exception 'DELETING_WRITE_ALLOWED';exception when others then if sqlerrm='DELETING_WRITE_ALLOWED' then raise;end if;end;
end $$;
rollback;
select 'PASS: public registration closed, staff preview allowed, stale version denied, pending-account deletion retry state' as verification;
