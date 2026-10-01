# Backend Full Audit Hardening — 2026-10-01

## Scope
Read-only audit of Admin/API authentication, snapshot/fallback, reservation/write admission, booking/revenue semantics, direct writer, Apps Script locking, and backend regression surfaces.

## Confirmed finding repaired
The authenticated Admin session gate already compared secrets through fixed-length SHA-256 digests and `crypto.timingSafeEqual`, but `api/kk-admin-guard.js` still compared the trusted `X-Admin-Pin` value with ordinary JavaScript string inequality before guarded Booking/Event writes.

The guard now hashes both values to fixed-length SHA-256 buffers and compares them with `crypto.timingSafeEqual`. Missing server configuration still fails closed and invalid credentials still return HTTP 401.

## Findings reviewed but intentionally not changed
- Revenue buckets already implement the locked contract: completed -> Actual; pending/confirmed/prepared/picked_up/returned/uploaded -> Future; cancelled/no_show/blank do not contribute revenue.
- `non_cancelled_bookings` includes no_show by its existing KPI definition; this is not a revenue bucket and was not silently redefined.
- Booking writes remain outside Direct Writer Phase 1 because create/update semantics depend on lock/transaction behavior.
- Reservation guard remains fail-closed for capacity, asset collision and unknown package type.
- Direct writer continues to route only bounded update-in-place actions and preserves readback plans.

## Safety
- Business/production writes: 0.
- No Sheet rows, bookings, prices, inventory, customer data, event visibility or runtime control-plane state changed.
- No guard was weakened.

## Acceptance
Require exact-head Admin Regression before merge.


## Follow-up: uncertain mutation timeout guidance
A second audit pass found a contradictory operator message in `server/admin-proxy.js`: mutation timeouts were correctly marked `mutation_outcome_uncertain=true` / `mutation_may_have_committed=true`, but the human-readable error still said `Please retry once`.

This is unsafe for non-idempotent legacy Booking creates because Apps Script currently serializes them with a document lock but does not enforce `request_id` uniqueness as the booking transaction key.

The proxy now tells operators not to retry a mutation until readback confirms whether it committed. Regression coverage asserts both the fail-closed instruction and absence of the old retry instruction.
