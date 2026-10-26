-- Operational setting, applied after policy r3 deployment at the operator's explicit request.
update noc_private.settings set value=value||'{"registration_open":true,"policy_version":"2026-10-26-r3"}'::jsonb where key='public';
