# Phase 1 — Bounded Private Admin Snapshot Cache (2026-10-16 ICT)
**DRAFT #744 SOURCE-ONLY / ZERO-PRODUCTION-WRITES / RELEASE HOLD**

## Finding
Prior patch `edcc8146...` correctly partitioned the Admin fallback cache by service-account identity and Apps Script endpoint, and corrected the OAuth private-key fingerprint. But the Map of private Admin snapshots still retained old entries indefinitely: lookup only checked the selected key's age and there was no eviction or size ceiling. Repeated read-key rotations or per-request identities could leave obsolete customer booking, contact and operational snapshots in server memory until the process restarted. Reducing the cache TTL alone would not delete old entries.

## Minimal patch
- `server/admin-sheet-fallback.js`: add an internal maximum of **64 cached snapshots**; store each entry's absolute `expiresAt`; evict expired entries on subsequent cache-enabled lookups and after insert, then evict oldest Map entry if over limit. Preserve existing 2-second default TTL, single-flight request coalescing, per-request shorter TTL, Strict Core fail-closed behavior and read-only mode.
- `tests/admin-sheet-fallback-private-reader.test.js`: synthetic **70 service-account rotations** with 11 Admin datasets each, proving the first identity becomes a new MISS after eviction, immediate same-identity HIT, zero public fallback and no customer/credential material in public diagnostics.
- No production permission, Google, Supabase, Apps Script, LINE, Make or business writes.

## Verification scope
Isolated native Node targeted function/credential-regression smoke on exact extracted cache/credential functions: **11/11 PASS** before this follow-up, no network. After this patch, exact-source JavaScript syntax and mocked synthetic eviction smoke must be read back; real full-project Node regression/hosted GitHub Actions and credentialed 13/13 private Core E2E are **NOT yet accepted**. Do not mark Issue #738 or #49 complete.

## Safety Gates / Next-chat handoff
Owner-approved strict Core private reader 13/13 authenticated data parity and anonymous denial, Storefront/Admin/Revenue readback, protected/rollback-ready ACL migration, and exact-head CI are required before any Core ACL/Production change. Existing Core workbook permission is `anyone/reader`. Keep `#49 OPEN/HOLD`. No data deletion/merge/deploy or additional fees.
