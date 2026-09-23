# Admin Direct Google Writer — Phase 1 — 2026-09-22

## Objective

Reduce the remaining Apps Script write-path dependency without moving Booking/Asset reservation before its concurrency guarantees are replaced.

Baseline:
- main: `aa08bac8904502c17c8a86c34f5e2d49147b7fa5`
- Production at phase start: `dpl_HWDtf7inUfd5qWVuyhEtU9g7e8MT`
- Core Sheet: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`
- backup branch: `backup-main-pre-direct-writer-phase1-20260922`
- work branch: `admin-direct-writer-phase1-20260922`

The immediate Admin P0 was already Production-accepted before this phase:
- direct primary reads;
- guarded booking preflight no longer waits on Apps Script snapshot;
- current Production write-health healthy;
- legitimate createEvent write + Audit + Override + Web Package readback verified.

This phase is **writer migration hardening**, not an outage recovery.

## Phase 1 routing boundary

New module:

`server/admin-direct-writer-phase1.js`

Only update-in-place actions are eligible:

1. `updateEvent`
   - only when no new `poster_url` is supplied;
   - poster upload/share and Drive semantics remain on Apps Script;
   - existing Web Package price cells are preserved exactly as formulas or manual values.

2. `updatePackage`
   - updates only the same fields as the live Apps Script action;
   - preserves untouched package columns.

3. `upsertEventOverride`
   - direct only when exactly one existing override row is present;
   - a brand-new override remains on the Apps Script lock path;
   - duplicate override cleanup remains on the Apps Script lock path;
   - only matching `09_Web_Packages!H` price cells are refreshed;
   - clearing a price restores the same LOOKUP/VLOOKUP formula contract used by the live Apps Script writer.

Explicitly **not** direct-routed in Phase 1:
- `createEvent`
- `createBooking`
- `updateBooking`
- Asset mutations
- poster upload
- override-row creation
- duplicate override cleanup

## Activation gates

The Phase 1 router cannot activate merely because code is deployed.

The underlying writer still requires:
- valid Google service-account credentials;
- canonical Core Sheet ID;
- `KK_ADMIN_DIRECT_WRITER_ENABLED=1`;
- `KK_ADMIN_DIRECT_WRITER_ACCEPTED=1`;
- `KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED=1`.

Phase 1 additionally requires the exact per-action allowlist:

`KK_ADMIN_DIRECT_WRITER_PHASE1_ACTIONS`

Example future accepted configuration:

`updateEvent,updatePackage,upsertEventOverride`

The default is empty. With no action allowlist, Production behavior remains legacy Apps Script writes.

## Atomicity

Direct Phase 1 uses Google Sheets `spreadsheets:batchUpdate`.

Each accepted direct mutation puts:
- the business-row mutation(s);
- any matching Web Package price mutation(s);
- one `15_Admin_Audit_Log` append

inside the same Google batch request.

This prevents a successful business update from being committed without its audit record when the Google batch itself is rejected.

This does **not** claim to replace Apps Script `DocumentLock` for competing Booking/Asset reservation requests. Booking and Asset writes therefore remain on the legacy locked path.

## Request idempotency

The Admin browser adds one `request_id` per write API call.

For a valid supplied request ID, the direct writer checks recent Audit rows before mutation. If the same accepted action/request ID already exists:
- no second business mutation is issued;
- no second audit mutation is issued;
- the earlier result is returned with `idempotent_replay=true`.

The routed actions are also update-in-place by design, so applying the same state twice is state-idempotent even if a caller fails to provide a reusable request ID.

Create operations remain outside the direct route because they require stronger exactly-once and allocation semantics.

## Exact readback and no silent fallback

After a Google batch succeeds, Phase 1 requires:
1. exact business-range readback;
2. formula readback where formulas must be preserved;
3. Audit readback containing the exact `request_id`.

If a direct mutation was attempted and the batch/readback path fails, the request is **not** silently retried through Apps Script.

The response records:
- `no_legacy_fallback=true`
- `mutation_committed=true` when the Google mutation completed before a verification failure.

This prevents double writes caused by uncertain direct-write outcomes.

Before any direct mutation occurs, semantic cases explicitly marked legacy-required may still route to Apps Script.

## UI behavior during an Apps Script outage

Previously, `degraded_read_only=true` blocked every Admin write in the browser.

The Admin UI now checks `direct_writer_phase1_state`.

When the legacy Apps Script writer is unhealthy:
- non-routed actions remain blocked;
- an action is allowed only when the direct writer is fully accepted **and** the action appears in the explicit Phase-1 allowlist;
- stale snapshots still block all writes.

This means an accepted future Direct Writer can continue safe Event/Package/Override updates without making Booking/Asset writes available during a legacy outage.

## Telemetry

Authenticated snapshots now include non-secret:

`direct_writer_phase1_state`

It reports:
- writer readiness;
- configured Phase-1 actions;
- whether Phase 1 is ready;
- Booking routed = false;
- Asset routed = false;
- createEvent routed = false;
- createOverride routed = false.

No service-account email, private key, access token, Admin PIN, or API key is exposed.

System Health also reports the Direct Writer Phase 1 state.

## Current runtime gate

The canonical Core Sheet permission readback still shows no service-account Editor principal.

Therefore:
- Direct Writer Phase 1 **must remain disabled in Production**;
- no writer environment flags are changed in this phase until identity provisioning and a controlled write probe are accepted;
- current live writes continue through the existing Apps Script writer.

The Make Admin bridge is not used because its runtime remains quarantined by `MAKE_FREE_CREDITS_EXHAUSTED`.

## Safety boundaries

This phase does not:
- mutate Production Booking/Event/Asset/Package/Pricing rows for testing;
- create a synthetic customer/event/booking;
- change Apps Script URL, deployment, API key, timezone, or installed triggers;
- change Sheet schema;
- create or guess a Google credential;
- enable Make;
- enable Scanner/Verifier/Canary/HF;
- route Booking or Asset writes away from `DocumentLock`;
- silently fall back to Apps Script after an uncertain direct mutation.

## Acceptance sequence before Production activation

1. syntax + full regression PASS;
2. Preview runtime READY;
3. Production deploy of the disabled/staged code remains healthy;
4. provision approved Google writer identity;
5. grant Editor only to the canonical Core workbook;
6. verify OAuth + canonical workbook identity without exposing secrets;
7. run controlled non-customer/no-op or existing-row write probe;
8. exact readback + Audit readback PASS;
9. set foundation acceptance gates;
10. allowlist one Phase-1 action at a time;
11. perform legitimate Admin acceptance;
12. only then consider reducing Apps Script write-health dependence for those accepted actions.

Booking/Asset migration is a later phase and requires a proven concurrency/transaction strategy.
