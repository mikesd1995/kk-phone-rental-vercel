# LINE booking write activation gate — 2026-10-01

## Current state
PR #361 merged the fail-closed LINE intake contract at `08161db92af09650a1349895e725e2b60ea78e2e` after Admin Regression #1176 passed. The contract is deliberately not wired to a production Booking write.

## Audit findings
1. Legacy Apps Script `kkApiCreateBooking_` acquires a document lock and writes `00_Master_Booking` B:T, preserving generated booking_id column A. However, it calls `kkFindAvailableAsset_` for phone/lens package types regardless of booking status. A public LINE intake forced to `pending` would therefore reserve/assign physical assets prematurely.
2. The legacy create result returns row_number and asset IDs but not canonical booking_id, so it does not satisfy the required canonical A-column readback contract.
3. Direct Writer Phase 1 explicitly excludes Booking mutations. Its persisted audit request_id replay protection is implemented only for supported update-in-place actions; it is not an atomic Booking-create transaction.
4. The low-level direct writer allowlist permits createBooking only within B:T and therefore protects formula column A, but that primitive alone does not provide row allocation, atomic request_id uniqueness, audit coupling, or canonical booking_id readback.

## Required activation contract
Do not route LINE webhook intake to a Booking writer until one governed operation can:
- require deterministic LINE request_id,
- detect/replay an existing successful request before any append,
- resolve exactly one canonical event_id and template_id,
- create only pending/unpaid/LINE bookings,
- leave phone_asset_id and lens_asset_id blank for pending LINE intake,
- allocate exactly one target row,
- write only B:T and preserve formula column A,
- persist request_id in governed audit/idempotency storage in the same transaction/batch,
- read back A:T and require a non-empty canonical booking_id,
- return the original canonical booking on webhook redelivery,
- fail closed on ambiguous identity, partial/uncertain write, or readback mismatch,
- never fall back to legacy create after an uncertain direct mutation.

## Production status
LINE booking write remains disabled. No Booking/Pricing/Inventory/Sheet SOT production write path was activated by this audit.
