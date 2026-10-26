# NOC community implementation and launch checklist

## Project and data boundaries

- Supabase account alias: Neko Operations Command
- Organization: Neko_operations_command
- Project ref: pqqgkavnsgpmhojsimmq, ap-southeast-1 (Singapore).
- Only the publishable key appears in the website. Service credentials stay in the Edge Function environment.
- Game statistics/art remain static GitHub Pages assets.
- 2,969 validated character/form references are stored for foreign-key validation of reviews.
- Private schema noc_private contains members, staff, consents, characters, posts, comments, ratings, reports, notifications, audit, appeals, deletion_jobs, settings.
- No private table is granted to anon/authenticated; all have RLS and explicit deny-direct policies.
- public.noc_api is an invoker wrapper around a carefully authenticated private command handler. The private definer is required to expose curated reads and authorized commands without exposing tables.
- staff privileges come only from the operator-managed staff table, never editable user_metadata and never "first signup becomes admin".

## Features

Free/question/guide/notice boards; title/body search and pagination; drafts; own-post editing/deletion; post comments; character-form ratings (one member/character, update/remove); character comments; own-comment editing/deletion; reports; private report snapshots; moderation hide/restore; report resolution/dismissal; owner-only suspension/restore; notifications; appeals and replies; nickname changes; policy-version acknowledgment; 14-or-over acknowledgment; self-withdrawal.

Images: private community-images bucket, 512,000 bytes/object, JPEG/PNG/WebP MIME restrictions, 3 files per post in UI and publish validation. Browser converts accepted images to WebP (max 1600px and 500KiB), reducing metadata exposure. Storage policy binds upload paths to the active author and their post; SVG is disallowed. Concurrent direct uploads could exceed the UI count temporarily, but publication rejects >3 objects. Signed read URLs expire after 5 minutes; previously issued URLs may remain usable until expiry after moderation. Do not describe this as instant revocation.

No advertising, paid upgrade, third-party messages, paid developer enrollment, or generated branding artwork was added.

## Authentication configuration

Only Google OAuth is supported. Apple was removed at the operator’s request. Google was enabled by the operator and the operator confirmed successful live login. Apple remains disabled. The checklist below documents the required configuration.

1. In this project's Auth URL configuration, set Site URL to https://jaewani.github.io/Neko_Operations_Command/ and allow the intended project redirect https://jaewani.github.io/Neko_Operations_Command/**.
2. Configure a Google OAuth web client using the official provider guide.
3. Google uses the Supabase callback https://pqqgkavnsgpmhojsimmq.supabase.co/auth/v1/callback.
4. Keep the Google client secret out of GitHub, chat, public config and browser code. Enter them in the provider/Supabase consoles.
5. Test Google sign-in on the live site. The client uses PKCE. It checks the public Auth settings and disables unconfigured providers.
6. Owner was bootstrapped only after finding exactly one email-confirmed Google identity matching the operator-provided battlecatwiki@gmail.com address. Do not grant first-signup ownership.
7. Owner bootstrap is an operator SQL action: insert into noc_private.staff(user_id,role) values ('<verified-own-auth-user-uuid>','owner'); this is a template, not executed automatically.

SDK loading: exact pinned @supabase/supabase-js@2.118.0 via jsDelivr +esm. No unversioned @2/latest. Community SDK loading is asynchronous so existing calculator/wiki code stays independent. Consider vendoring a locked bundle when the execution environment returns. CDN availability is checked in CI.

## Registration gate and legal decisions

The operator explicitly requested public registration on 2026-10-26. registration_open is enabled after deployment of policy r3. Server and UI use this live setting; Google identity, 14-or-over and policy acknowledgment checks remain enforced. Guests may read public boards/reviews. There are no fabricated public posts or real-user fixtures.

Contact: battlecatwiki@gmail.com. Policy version: 2026-10-26-r4. The operator delegated retention and overseas processing policy decisions on 2026-10-26. Privacy/terms are available in the account dialog and standalone privacy.html/terms.html; source text lives in community-policy.mjs. Onboarding rejects a stale policy version.

Public registration was explicitly authorized by the operator on 2026-10-26. Core hosting is confirmed Singapore; Supabase's official FAQ additionally describes US operations/support, EU log processing, globally distributed support and global CDN. Exact EU countries and project-specific additional processing/retention details are not supplied by that FAQ and remain a launch follow-up. Do not describe all processing as Singapore-only or mark legal readiness complete.

## Retention applied

Migration 20261026051956 applies a daily 19:15 UTC (04:15 KST) cron job:
- Consents: 30 days after account foreign key becomes NULL, not after original acceptance.
- Resolved/dismissed reports: 90 days after resolved_at.
- Closed appeals: 90 days after closed_at; a trigger starts the clock on closure.
- Notifications: 30 days after creation.
- App audit: 90 days; moderator.* events: 2 years.

The private invoker purge function is not callable by anon/authenticated/service_role. Only the operator's scheduled DB role runs it. Private retention_holds entries exclude individual records. Holds are managed by operator SQL/service_role, with documented reason and review_at (90 days); review/removal is an operator task, not automatic release. No whole-account evidence retention is implied. For example, insert a hold for a specific report ID with its concrete legal reason, then remove it when that purpose ends. This table has RLS and no direct member access.

The earlier proposal was rejected because no specific policy had been authorized. After the operator explicitly delegated policy selection, this revised migration was accepted and applied; it does not silently retry the earlier one-year audit/creation-based inquiry proposal.

Transaction/rollback retention fixtures verify expiry, protected records, unexpired records, closure timestamps and purge privilege denial. Periodic cleanup is subject to service availability (Free projects may pause). Monitor cron.job_run_details and outstanding deletion_jobs. Provider logs/backups and actual SQL/Dashboard access monitoring are distinct from application records; do not claim the app logs cover all administrator access.

## Self-withdrawal

Member types 회원탈퇴. The authenticated command marks the member deleting, makes their posts/comments unavailable and removes ratings. noc-account-delete explicitly verifies the bearer using Auth getUser, requires an existing deletion request, removes the user's files through Storage API and deletes the Auth account through Admin API. The gateway verify_jwt flag is false because authentication is implemented inside the function; unauthenticated requests receive 401. No service credentials are sent to the browser.

If final cleanup fails, access stays restricted and the member can retry from the account screen. Treat operationally stuck deletion_jobs as incidents requiring review. Existing report snapshots/audit/consent records follow the retention periods above; actor foreign keys become null after Auth deletion. Record holds preserve only already stored data, not a deleted identity link. This is not a full forensic evidence preservation system. Draft media and canceled uploads need an approved orphan-cleanup policy too.

## Verification

- Executed transaction/rollback SQL tests in supabase/tests/community_authorization.sql: public board access, anonymous write rejection, private-table denial, OAuth identity onboarding, post ownership, rating uniqueness/bounds, notice/staff authorization, editable-metadata escalation rejection, moderator hiding and anonymous hidden-content isolation. Fixtures were rolled back; no test accounts/posts persist.
- Supabase security advisors: no findings after explicit private deny policies.
- Performance advisors: unused-index informational findings only on the new empty project; retain purposeful FK/query indexes.
- Node tests cover character namespaces/forms, escaping, post bounds, attachment paths and unrated labels.
- CI parses frontend modules and performs live HTTP tests for anonymous reads, registration flag, anonymous writes/admin/deletion rejection, Edge auth and pinned SDK availability.
- The operator confirmed Google login and return to the membership screen. Automated authenticated end-to-end checks remain outstanding.
- Test before opening: two real accounts, Google sign-in, editing another user's content denied, rating updates, 3-photo limits, report/private snapshot visibility, owner/moderator actions, suspension, account deletion/retry, narrow mobile layout.

## Backups

Free plan does not include managed automatic DB backups. Export data to protected storage and back up private Storage objects separately; a DB dump contains only object metadata. Do not put member backups, emails, tokens or private attachment URLs in this public repository.

## Launch hardening (2026-10-26)

- The login screen explains that Google login itself creates an Auth account before membership completion, and links the notices before the OAuth button.
- Pending users can request account deletion. The me response reports deleting when a deletion job exists even without a member row, so failed cleanup remains retryable.
- Policy version is read from settings when stamping acceptance records, rather than hardcoded in SQL. Outdated acknowledgments fail closed.
- Deletion handler is shared with Node tests. It validates bearer tokens with Auth getUser, requires the private deletion request, traverses paginated nested files, removes storage before Auth deletion, and returns a retry response without exposing private error details. This is unit verification with mock services, not a claim that an authenticated live Storage/Auth deletion was tested.
- launch_readiness.sql verifies the public gate, explicit staff preview, stale-policy denial and pending deletion state using rollback fixtures. community_authorization.sql separately verifies cross-user ownership and report/moderation isolation.
- Actual browser/OS execution environment is unavailable during this follow-up. Real Google sign-in was previously confirmed by the operator; authenticated live uploads, actual Storage bytes removed, completed Auth deletion and UI retry still need operator/browser verification. No service secret or test-auth backdoor was added.
- Supabase's public FAQ does not identify all ancillary processing countries. See DATA_PROCESSING_REVIEW.md for the concrete supplier questions. No legal-compliance certification is made and public registration was subsequently authorized by the operator.

## Repository path change

GitHub repository and Pages path changed to Neko_Operations_Command at the operator's request. All website asset/module paths are relative. CORS origin stays https://jaewani.github.io. Update Supabase Auth Site URL to https://jaewani.github.io/Neko_Operations_Command/ and allow redirect https://jaewani.github.io/Neko_Operations_Command/** in the dashboard. These Auth URL settings cannot be changed by the connected MCP tools; they have not been marked verified. Google authorized JavaScript origin remains https://jaewani.github.io and Google provider callback remains https://pqqgkavnsgpmhojsimmq.supabase.co/auth/v1/callback.

## Optional game profile import

Private game_profiles table and game_profile/save_game_profile/delete_game_profile RPC actions are available through the existing authenticated private dispatcher. There are no direct member table grants. Profile access is self-only; save requires active membership, current notice version, explicit optional game-data acknowledgment, whitelisted numeric fields and a current expected_updated_at. Withdrawal clears game profiles before Storage/Auth cleanup. Audit records contain counts/version/region, never raw saves or account-transfer credentials. See SAVE_IMPORT.md for supported fields, bounds and test scope.
