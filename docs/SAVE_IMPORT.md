# Read-only SAVE_DATA import

Implemented for the modern 12.0.0–15.5.x prefix layout; actual per-version compatibility still depends on real files. The user's attached file was not accessible to the agent's current environment. The operator explicitly elected to test that file personally after implementation/deployment. No result for that attachment is claimed.

## Data flow

Browser File input (maximum 8 MiB) -> transferable ArrayBuffer -> local module Worker -> regional checksum and bounded prefix parsing -> explicit review and optional consent -> narrow authenticated RPC -> private per-user game profile. The raw file is not uploaded, written to localStorage/IndexedDB or included in logs. Closing the dialog terminates analysis and releases staged references. Browser memory management controls actual reclamation.

The normal SAVE_DATA format represented by the reference reader is binary data plus a 32-character legacy salted MD5 suffix, not a generic AES-encrypted container. MD5 is used only to check this game format and determine KR/JP/EN/TW. It is not proof of account ownership or a secure signature. The parser does not call PONOS, edit the file, re-encrypt it, obtain transfer credentials, or create a playable save.

## Imported fields

- game version and region
- unlocked character IDs, selected form, base level (stored field + 1), plus level
- nine main chapters: progression, count of cleared main stages and count of highest-grade treasures
- server update timestamp

Not imported: currency, account/inquiry/transfer codes, tokens, raw filename or file digest, lineups, talents, event/legend progress. These fields are skipped or remain outside the prefix; none are sent to the database.

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
