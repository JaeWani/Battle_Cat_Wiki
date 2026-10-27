# Read-only SAVE_DATA import

Implemented for the modern 12.0.0–15.5.x prefix layout; actual per-version compatibility still depends on real files. The user's attached file was not accessible to the agent's current environment. The operator explicitly elected to test that file personally after implementation/deployment. No result for that attachment is claimed.

## Data flow

Browser File input (maximum 8 MiB) -> transferable ArrayBuffer -> local module Worker -> regional checksum and bounded prefix parsing -> explicit review and optional consent -> narrow authenticated RPC -> private per-user game profile. The raw file is not uploaded, written to localStorage/IndexedDB or included in logs. Closing the dialog terminates analysis and releases staged references. Browser memory management controls actual reclamation.

The normal SAVE_DATA format represented by the reference reader is binary data plus a 32-character legacy salted MD5 suffix, not a generic AES-encrypted container. MD5 is used only to check this game format and determine KR/JP/EN/TW. It is not proof of account ownership or a secure signature. The parser does not call PONOS, edit the file, re-encrypt it, obtain transfer credentials, or create a playable save.

## Imported fields

- game version and region
- unlocked character IDs, selected form, base level (stored field + 1), plus level
- nine main chapters: progression, count of cleared main stages and count of highest-grade treasures
- confirmed talent / ultra talent ability IDs and levels (schemaVersion 2)
- server update timestamp

Not imported: currency, account/inquiry/transfer codes, tokens, raw filename or file digest, lineups, event/legend progress. These fields are skipped or remain outside the prefix; none are sent to the database.

Known local catalog forms are shown for review and saved; unknown forms are counted and excluded with an explicit notice. If all owned forms are unknown, saving is blocked. An import replaces the entire previous snapshot only after review/consent. Timestamp comparison prevents stale tabs from replacing newer data. Saves are limited to one per 10 seconds. Game profiles are private, user-deletable and removed at withdrawal request and by Auth cascade.

## Format references and implementation

- https://github.com/fieryhenry/BCSFE-Python/blob/main/src/bcsfe/core/io/save.py
- https://github.com/fieryhenry/BCSFE-Python/blob/main/src/bcsfe/core/game/battle/slots.py
- https://github.com/fieryhenry/BCSFE-Python/blob/main/src/bcsfe/core/game/map/story.py
- https://github.com/fieryhenry/BCSFE-Python/blob/main/src/bcsfe/core/game/catbase/cat.py
- https://www.rfc-editor.org/rfc/rfc1321

No Python/EXE or third-party parsing library is bundled. The bounded reader and checksum implementation are original code in this repository; external source is referenced for the binary layout. The main chapter's internal index 3 is excluded, leaving indices 0,1,2,4,5,6,7,8,9. Current-form numbers are zero-based; UI presents 1–4.

## Verification scope

Node tests cross-check checksums against node:crypto and use independent synthetic prefix fixtures for four regions, off-by-one levels, truncated/oversized files, tampering, unknown versions, abnormal counts and values. A synthetic prefix is not a complete playable save. Chrome tests exercise the real file input, module Worker, decoded preview values, cancel-before-save behavior and rejection of a malformed file. SQL rollback tests exercise own-only access, validation, consent version, field allowlisting, timestamp conflict and withdrawal cleanup. No synthetic account or imported profile is left in production. The user's attachment remains an operator test, not part of the public repository.

## Talent section and manual editing (schema 2)

`save-talents.mjs` uses bounded structural extraction of a later version-delimited section, independently of the prefix reader. Reference: BCSFE-Python commit `85fb94cbf00c6a74dbef58932610fb94ec8f7495`, `save.py`, `catbase/nyanko_club.py`, and `catbase/cat.py`. Starting after the character prefix, it requires one complete 77/gold-pass/talent/80000/80200/80300 chain, valid booleans, bounded counts, unique valid character/ability IDs and level values. A lone integer marker is insufficient. Ambiguous, missing or damaged sections produce `talentStatus: unavailable`; they do not silently create zero levels. Worker timeout and input size limits still apply. No full save compatibility or real-user file result is claimed.

Missing per-character talent entries are explicitly populated as level 0 only after a section is confirmed. Known catalog abilities are mapped using the pinned numerical definitions. Unconfirmed imports preserve existing same-character talent records. Direct editing uses the same per-member API and the same `cats[{id,form,level,plus,talents:[{id,level}]}]` structure; missing talent entries / null mean unknown, and explicit level 0 means not unlocked. Imports with confirmed talent data replace existing talent levels for included characters. Removing ownership removes that character from the saved snapshot.

Manual drafts retain chapter progress and are discarded on cancellation/account change. Changes to an existing imported profile are marked mixed; manual-only profiles use a null game version and `progressKnown: false` rather than inventing a save version or chapter progress. The existing timestamp lease and ten-second save throttle remain in place. Account deletion continues to remove the shared profile.

Verification: 83 Node tests, 16 Python tests, Chrome desktop/mobile route and editor checks, synthetic four-region talent imports, damaged/ambiguous chains, unknown preservation, draft/filter retention and consent. The new migration and SQL rollback tests passed in a local PostgreSQL-compatible PGlite instance with an isolated authentication/API fixture; this does not verify the production gateway. After explicit user approval on 2026-10-27, migration `20261027114724_manual_game_profiles.sql` was applied to production. Both existing `game_profiles.sql` and new `manual_game_profiles.sql` rollback suites passed against the production database, leaving no test users or profiles behind.
