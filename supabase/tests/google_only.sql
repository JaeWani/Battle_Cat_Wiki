begin;
update noc_private.settings set value=value||'{"registration_open":true}'::jsonb where key='public';
insert into auth.users(id,aud,role,email)values
 ('20000000-0000-4000-8000-000000000001','authenticated','authenticated','noc-google-only-test@example.invalid'),
 ('20000000-0000-4000-8000-000000000002','authenticated','authenticated','noc-apple-rejection-test@example.invalid');
insert into auth.identities(user_id,provider_id,identity_data,provider)values
 ('20000000-0000-4000-8000-000000000001','noc-test-google','{"sub":"noc-test-google"}','google'),
 ('20000000-0000-4000-8000-000000000002','noc-test-apple','{"sub":"noc-test-apple"}','apple');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.noc_api('onboard','{"nickname":"Google only test","age_confirmed":true,"terms_accepted":true,"privacy_accepted":true,"policy_version":"2026-10-26-r1"}');
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 begin
 perform public.noc_api('onboard','{"nickname":"Apple reject test","age_confirmed":true,"terms_accepted":true,"privacy_accepted":true,"policy_version":"2026-10-26-r1"}');
 raise exception 'APPLE_ONBOARDING_ALLOWED';
 exception when others then
  if sqlerrm<>'구글 로그인이 필요해요.' then raise;end if;
 end;
end $$;
rollback;
select 'PASS: Google onboarding accepted, Apple-only identity rejected; all fixtures rolled back' as verification;