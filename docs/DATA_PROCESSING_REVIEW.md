# NOC overseas processing launch follow-up

Reviewed 2026-10-26. Project: pqqgkavnsgpmhojsimmq, selected region ap-southeast-1, plan Free.

Confirmed from official documents:
- Primary contracted processor Supabase Pte. Ltd., Singapore; DPA contact privacy@supabase.io.
- Selected-region Postgres/Auth/Storage and relevant backups: Singapore.
- Supabase Inc. may perform necessary US support/operations.
- Platform logs: EU-based data centers, but the public FAQ gives no exact member countries.
- Support personnel are globally distributed and Storage may use a global CDN. Private bucket does not alone establish country exclusivity.

Official sources:
- https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq
- https://supabase.com/legal/customer-resources/data-processing-addendum
- https://supabase.com/legal/customer-resources/subprocessor-list
- https://supabase.com/docs/guides/storage/cdn/smart-cdn

Supplier confirmation required (support request has NOT been sent):
1. For this Singapore Free project, which actual countries process personal data in API/Auth/Storage/Edge request logs, telemetry and security metadata? EU is not itself a country; distinguish processor company incorporation from data center location.
2. Which entities/countries may access member data for support and incident response, and what project controls restrict such access?
3. Which countries can receive this private bucket's bytes/URLs/request metadata through the CDN? Can that processing be disabled or region-restricted on this plan?
4. Retention/deletion windows for each relevant log/support/cache/backup category, including individual member deletion rather than only whole-project deletion.
5. Confirm applicable DPA/subprocessors and any regional Edge execution settings needed for the account-deletion function.

Use the signed-in project's support channel or the DPA privacy contact. Do not send member records, access tokens or service keys with the request. We have not contacted any external recipient on the operator's behalf.

Operational browser checks remaining:
- Sign in as the verified operator contact account and complete private-preview onboarding.
- Create a test post with an image, edit/delete it, check another account cannot edit it.
- Use a separately approved test account for report handling and withdrawal. Verify actual storage files and Auth account disappear; do not withdraw the sole owner account.
- Verify cleanup retry behavior if Storage/Auth fails and verify narrow-screen dialogs.

## Public opening decision

On 2026-10-26 the operator explicitly requested opening general membership with the above supplier details and live authenticated browser checks still outstanding. Policy r3 reflects this operational decision; it does not assert that those follow-ups were resolved. No external inquiry was sent.
