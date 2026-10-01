# LINE locked pending booking intake v3 — 2026-10-01

## Decision
The direct Google Sheets Phase-2 prototype is not activation-safe because snapshot row allocation has no compare-and-swap precondition. The repository already has a stronger serialization primitive: Apps Script `LockService.getDocumentLock()`.

## Implementation
Adds a separate `createLineBookingPending` Apps Script action. It is intentionally not wired to the public LINE webhook in this PR.

Inside one document lock the action:
1. validates a deterministic `line:<48 hex>` request_id;
2. derives a hashed Script Property key (raw request_id is not used as the property key);
3. replays an existing successful canonical booking;
4. fails closed on an existing PENDING/uncertain claim;
5. validates canonical event/package and current bookability;
6. persists a PENDING idempotency claim before any Booking mutation;
7. allocates exactly one row while the document lock is held;
8. writes only `00_Master_Booking!B:T`, hard-coded as pending/unpaid/LINE with blank phone/lens assets;
9. flushes and reads back A:T;
10. requires canonical booking_id in formula column A and verifies pending/no-assets/event identity;
11. changes the claim to OK with canonical booking_id and row_number before returning success.

## Failure semantics
If execution fails after the PENDING claim, the claim is deliberately retained. A redelivery then fails closed instead of creating a duplicate. Owner reconciliation is required for uncertain claims. This prefers a recoverable blocked request over duplicate bookings.

## Scope / safety
- No webhook routing is added.
- No Vercel/Production feature flag is enabled.
- Legacy `createBooking` behavior is unchanged.
- No price, inventory, event, package or existing Booking row is modified by this code change itself.
- Pending LINE intake never calls asset allocation.

## Supersedes
This design supersedes PR #366's direct-Sheets row-allocation prototype and incorporates the activation-gate findings from PR #363.

## Hardening record — post-write / pre-OK failure window
- The PENDING claim now records the exact candidate row plus customer name/phone before the first Booking-sheet mutation.
- Added internal-only `kkReconcileLineBookingPendingClaim_`; it is deliberately not routed through `doPost` and therefore is not a public action.
- Reconciliation holds the document lock, reads only the claimed A:T row, and requires canonical booking_id + pending + LINE source + exact event/customer identity + blank assets.
- Reconciliation never allocates a row and never writes Booking data. On an exact match it may only transition the Script Property claim from PENDING to OK.
- Any missing row identity, mismatch, assigned asset, malformed claim, or uncertain state remains fail-closed for owner inspection.
- Added regression gates proving row/identity claim ordering, no Booking mutation in reconciliation, no replacement-row allocation, and no public reconciliation route.

## Activation status after hardening
This remains a dormant capability. Public LINE webhook wiring, Production activation, and Production/business writes are intentionally unchanged at zero. Runtime concurrency/fault-injection acceptance is still required before any activation decision.
