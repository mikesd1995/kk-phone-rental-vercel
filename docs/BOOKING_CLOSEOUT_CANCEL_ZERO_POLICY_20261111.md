# Booking cancellation zero policy & closeout evidence — 2026-11-11

## Current LIVE Google Sheets state (owner-directed changes, already applied)

Workbook: `KK Phone rental backend`, ID `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`.

- `00_Master_Booking!Q`: 23 already `completed`, returned bookings are now **`uploaded`** (owner attested upload), NOT `sent` or `confirmed`. `Settings!P13` contains new `uploaded` dropdown option and validation on Q5:Q1000 includes P5:P13. Upload does not prove customer link delivery.
- Ten historical `completed` rows missing both P (return) and Q (file status) retain those unknowns and have an evidence-gap marker in T. Never fill in physical return, customer link delivery or payment history without owner evidence.
- `19_Booking_Reconciliation!` rows 138 and 139 contain the owner upload attestation and ten-row exception inventory.
- The previous owner-requested normalization zeroed `amount_received` and `balance_due` for all **17** historical `cancelled` rows and preserved original input values in reconciliation row **137**.
- `00_Master_Booking!Y5:Y1000` now has a relative, status-sensitive formula, tested on a smaller range before rollout:
  `=IF(D5="","",IF(OR(C5="cancelled",C5="no_show"),0,MAX(0,N(X5)+N(S5)-N(O5))))`
  Thus cancellation/no-show returns a computed balance of **0**, even if old O or X values change. Active rows retain the ordinary balance computation. Cross-chat audit row **140**.
- **Do not** change public package prices, booked devices, customer contact, booking dates, or manually infer a refund.

## Proposed code change in this draft PR (NOT deployed)

File: `apps-script/Code.gs`.

Both canonical Admin API `kkApiUpdateBooking_` and governed LINE owner rejection `kkApiDecideLineBookingPending_` use a shared cancellation policy:

1. On transition to `cancelled`, capture the **prior** status, payment status, and raw `amount_received` before modifying the A:T booking record.
2. Set booking payment to `unpaid` and operational `amount_received=0` in the same canonical A:T write. Do not change the agreed historical quote X or customer/asset identity.
3. Append a durable pre-change snapshot to `00_Master_Booking!T` as a fallback, then append a separate structured audit row to existing `19_Booking_Reconciliation`. Verify appended booking ID. Report audit status to caller.
4. Guard against silently cancelling `picked_up`, `returned`, `uploaded`, or `completed` records, since they may involve actual payment or refund liability; those require an independently verified refund process.
5. Repeat cancellation after normalization is idempotent. Real-world money movement, customer messages, and refunds are never implied.

**Limitations / fail-closed evidence:** Cross-sheet writes are not atomic. If the separate reconciliation append fails, the source booking T note preserves the original values and the API reports `audit_pending_master_note_preserved`. Owner/operator must reconcile that case; do not claim a full ledger append. Direct **manual** edits of status cells in Google Sheets do not invoke the Apps Script Admin/LINE API writer: the Y formula always zeroes the computed balance but a manually entered O value is not automatically rewritten by formula. Route future cancellations through the governed Admin writer after deployment.

## Acceptance / release gates

- Run `node --test tests/booking-cancel-zero-policy.test.js` and required repository tests.
- Verify formula sentinels `Y5`, `Y29`, `Y93`, `Y154`, `Y300`, `Y750`, `Y1000`: relative references must point to their own row.
- Verify live `confirmed` balance sum unchanged from the current 26-booking baseline **26,820 THB**; 17 canceled rows must remain zero and no stock-held flags change unexpectedly.
- Verify ten historical evidence gaps are still unverified and 23 owner-uploaded rows remain **not marked sent**.
- Before applying this PR's script to any live Apps Script deployment, require exact-head CI, independent reviewer approval, no owner lock conflicts, release coordination, manual writer acceptance tests, and a rollback plan. **No merge, deployment, or production Apps Script version update is authorized by this draft.**
