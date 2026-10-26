-- Apply after deploying the matching r4 notice and client.
update noc_private.settings set value=value||'{"policy_version":"2026-10-26-r4"}'::jsonb where key='public';
