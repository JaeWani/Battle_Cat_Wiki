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

## Authentication setup still required

Only Google OAuth is supported. Apple was removed at the operator’s request. The public Auth settings showed Google=false during implementation. Connected MCP tools can deploy SQL/Functions but do not expose Auth provider or redirect configuration. Browser environment became unavailable, so provider-console configuration and interactive OAuth testing could not be completed.

1. In this project's Auth URL configuration, set Site URL to https://jaewani.github.io/Battle_Cat_Wiki/ and allow the intended project redirect https://jaewani.github.io/Battle_Cat_Wiki/**.
2. Configure a Google OAuth web client using the official provider guide.
3. Google uses the Supabase callback https://pqqgkavnsgpmhojsimmq.supabase.co/auth/v1/callback.
4. Keep the Google client secret out of GitHub, chat, public config and browser code. Enter them in the provider/Supabase consoles.
5. Test Google sign-in on the live site. The client uses PKCE. It checks the public Auth settings and disables unconfigured providers.
6. Operator signs in, then explicitly identify the operator's auth.users UUID before assigning owner in noc_private.staff. Do not grant the first registered account ownership.
7. Owner bootstrap is an operator SQL action: insert into noc_private.staff(user_id,role) values ('<verified-own-auth-user-uuid>','owner'); this is a template, not executed automatically.

SDK loading: exact pinned @supabase/supabase-js@2.118.0 via jsDelivr +esm. No unversioned @2/latest. Community SDK loading is asynchronous so existing calculator/wiki code stays independent. Consider vendoring a locked bundle when the execution environment returns. CDN availability is checked in CI.

## Registration gate and legal decisions

Registration is closed in noc_private.settings, enforced on the server as well as the UI. Guests may read public boards/reviews. There are no fabricated public posts or real-user fixtures.

Operator must finalize contact email, legal notices (especially Singapore/international processing), age policy, record retention, deletion exceptions/disputes, and incident/rights-request procedures. The on-site terms/privacy pages are visibly labeled draft while registration is closed. These are implementation drafts, not a legal-compliance certification.

After final text and operational settings are approved, set public settings with the verified contact address and registration_open=true using the connected operator account. Changing this flag alone does not replace review of the actual on-site privacy/terms text.

## Retention not activated

Automatic approval review REJECTED a proposed persistent daily deletion job because specific retention periods/data destruction had not been explicitly approved. No cron extension/job from that rejected proposal was installed. Do not retry it indirectly.

Proposed (NOT approved/applied) periods were audit: 1 year; orphaned consent: 30 days; resolved reports: 90 days; closed appeals: 90 days; notifications: 30 days. These are design proposals, not blanket legal retention requirements. Open disputes/legal holds and identity linkage need operator/legal review before any irreversible expiry. This SQL proposal is intentionally not committed as an executable migration.

Consequently, current records have no automatic time-based purge; the operator must resolve this before opening real registration. Supabase platform logs do not replace application audit retention. Actual administrative SQL/Dashboard reads are not fully covered by the app's workspace audit events; separately configure the required operator access monitoring/export.

## Self-withdrawal

Member types 회원탈퇴. The authenticated command marks the member deleting, makes their posts/comments unavailable and removes ratings. noc-account-delete explicitly verifies the bearer using Auth getUser, requires an existing deletion request, removes the user's files through Storage API and deletes the Auth account through Admin API. The gateway verify_jwt flag is false because authentication is implemented inside the function; unauthenticated requests receive 401. No service credentials are sent to the browser.

If final cleanup fails, access stays restricted and the member can retry from the account screen. Treat operationally stuck deletion_jobs as incidents requiring review. Existing report snapshots/audit/consent records are retained privately pending the approved retention policy; actor foreign keys become null after Auth deletion. This is not a full legal-hold/evidence preservation system. Draft media and canceled uploads need an approved orphan-cleanup policy too.

## Verification

- Executed transaction/rollback SQL tests in supabase/tests/community_authorization.sql: public board access, anonymous write rejection, private-table denial, OAuth identity onboarding, post ownership, rating uniqueness/bounds, notice/staff authorization, editable-metadata escalation rejection, moderator hiding and anonymous hidden-content isolation. Fixtures were rolled back; no test accounts/posts persist.
- Supabase security advisors: no findings after explicit private deny policies.
- Performance advisors: unused-index informational findings only on the new empty project; retain purposeful FK/query indexes.
- Node tests cover character namespaces/forms, escaping, post bounds, attachment paths and unrated labels.
- CI parses frontend modules and performs live HTTP tests for anonymous reads, registration flag, anonymous writes/admin/deletion rejection, Edge auth and pinned SDK availability.
- No interactive authenticated browser flow was verified: Google OAuth is not configured and the execution/browser environment is unavailable. Do not claim successful Google login or browser end-to-end completion.
- Test before opening: two real accounts, Google sign-in, editing another user's content denied, rating updates, 3-photo limits, report/private snapshot visibility, owner/moderator actions, suspension, account deletion/retry, narrow mobile layout.

## Backups

Free plan does not include managed automatic DB backups. Export data to protected storage and back up private Storage objects separately; a DB dump contains only object metadata. Do not put member backups, emails, tokens or private attachment URLs in this public repository.
