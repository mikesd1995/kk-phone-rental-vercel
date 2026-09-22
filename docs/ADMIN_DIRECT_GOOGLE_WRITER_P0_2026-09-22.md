# Admin Direct Google Writer P0 — 2026-09-22

## Objective

Remove unstable Apps Script from the Admin critical path without weakening booking/event safety.

The target architecture is:

```
Admin
  -> Vercel guarded API
  -> authenticated Google Sheets API
  -> canonical Core workbook
```

Apps Script becomes optional/legacy after direct-writer acceptance rather than a required dependency for normal Admin operation.

## Baseline

Repository baseline before this work:
- main: `78cbeb9d50433cfd6188e12efc56dbb2e0f0714e`
- backup branch: `backup-main-pre-direct-admin-writer-20260922`
- work branch: `admin-direct-google-writer-v1-20260922`

Observed Production at the start of this phase:
- Production deployment: `dpl_7nJnrnsyuifjxFUcqMVjX7veNFtr`
- Production commit: `65bf8c95a59638b47a8f6680f785edea834fb98f`
- PR #163 direct-Sheet primary reads are already live.

Fresh Production evidence from the direct-primary runtime:
- direct read no longer spends ~12 seconds waiting for Apps Script snapshot;
- snapshots were observed around ~1.77s when lightweight write-health passed;
- snapshots were observed around ~4.01–4.04s when the Apps Script `phase1Health` write probe timed out;
- the direct reader is currently `public-gviz`;
- write health still alternates between healthy and timeout.

Therefore the remaining user-visible instability is primarily the legacy Apps Script write dependency, not the default read snapshot.

## Google identity evidence

Canonical Core workbook:
`12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`

Drive permission readback shows:
- one owner permission;
- one link/anyone reader permission;
- **no service-account permission**.

The private CRM/Intelligence workbook also has no service-account permission.

This means an authenticated Google Sheets writer cannot be activated safely yet. A service account with Editor access to the canonical Core workbook (or an equivalent approved Google workload identity) must be provisioned before the direct writer can pass acceptance.

No credential was guessed, requested in chat, logged, or exposed.

## Changes in this branch

### 1. Booking preflight no longer calls Apps Script snapshot

`api/kk-admin-guard.js` now builds the fresh reservation snapshot directly from the canonical Sheet through the existing direct-Sheet snapshot module with cache disabled.

This removes an unnecessary Apps Script request before every guarded booking write.

Safety preserved:
- reservation/collision preflight still runs;
- stale cache is not trusted for booking preflight;
- conflicting requests are still blocked before write;
- passing writes still delegate to the existing guarded writer until direct writer acceptance is complete;
- the existing Apps Script DocumentLock remains the final atomic legacy guard while the legacy writer is active.

### 2. Legacy write-health probes are cached briefly

`api/kk-admin-snapshot-v5.js` now keeps a short process-local result for the lightweight legacy write-health probe:
- healthy result TTL: 15 seconds;
- failed result TTL: 5 seconds.

This does not turn a failed path green. It only prevents repeated Admin refreshes on the same warm runtime from waiting on the same probe again immediately.

The cache is:
- URL + Sheet scoped;
- process-local only;
- short-lived;
- cleared by tests;
- bypassed when a deterministic deployment/auth failure is already known.

Telemetry added:
- `write_health_cache_status`
- `write_health_cache_age_ms`

### 3. Direct authenticated writer foundation added

New module:
`server/admin-direct-writer.js`

The module uses Google service-account OAuth with the Sheets write scope but is **not wired to business actions** in this phase.

It requires all activation gates simultaneously:
- supported service-account credentials present;
- canonical Core Sheet ID exactly matches;
- `KK_ADMIN_DIRECT_WRITER_ENABLED=1`;
- `KK_ADMIN_DIRECT_WRITER_ACCEPTED=1`;
- `KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED=1`.

Without every gate, it fails closed before any network write.

Allowlisted target families are limited to:
- Booking B:T — preserves generated booking_id formula in column A;
- Event A:H — preserves data_health formula in column I;
- Event Override A:G;
- Admin Audit A:J.

Arbitrary sheets/actions/ranges are rejected.

No Production environment variable is enabled by this branch.

## Why direct business writes are not enabled yet

The current Apps Script implementation contains business semantics that cannot be replaced safely by a generic Sheets update:
- DocumentLock serialization;
- asset allocation and collision revalidation;
- package/event bookability validation;
- event ID generation;
- price override reconciliation;
- duplicate override cleanup;
- web-package price preservation;
- poster/web-ready verification;
- audit/error logging.

Google Sheets Values API alone does not provide an Apps-Script-style DocumentLock or a general compare-and-swap transaction across these ranges.

Therefore this phase deliberately does not claim full write cutover until:
1. an authenticated writer identity exists;
2. write permission is proven with a controlled non-customer probe;
3. action-specific mutation planners preserve the live business semantics;
4. idempotency + exact readback + audit acceptance passes;
5. concurrency safety is proven or moved to a transactional SOT.

## Safety boundaries

This phase does not:
- change Apps Script URL or secrets;
- deploy Apps Script;
- change Sheet/App Script timezone;
- change installed triggers;
- mutate Production booking/event/asset/pricing rows;
- enable direct writer Production flags;
- enable Scanner/Verifier/Canary/HF;
- use public GViz for writes;
- silently fall back from a failed direct write to another writer.

## Acceptance gates

Repository/Preview gate:
- syntax PASS;
- full regression PASS;
- direct-preflight tests PASS;
- writer activation/allowlist tests PASS;
- Vercel Preview READY if quota permits.

Runtime direct-writer gate before activation:
1. provision approved Google writer identity;
2. grant only required Core workbook Editor access;
3. verify token/read identity without exposing credentials;
4. run a controlled non-customer/idempotent write probe with exact readback;
5. set explicit acceptance flags only after the probe passes;
6. implement and verify action-specific business planners;
7. run legitimate Admin acceptance and audit readback.

Until then, direct writer remains staged and disabled.
