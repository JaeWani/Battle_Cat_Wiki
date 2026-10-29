-- Explicit deny policies document the private-only access boundary.
do $$declare t text;begin
 foreach t in array array['content_passwords','content_password_attempts','content_edit_permits']loop
  execute format('create policy noc_deny_direct on noc_private.%I for all to anon,authenticated using(false) with check(false)',t);
 end loop;
end$$;
