# LINE booking intake idempotency — implementation record

Date: 2026-09-30

## Implemented
A server-side contract now derives a deterministic request_id from LINE webhookEventId, requires nickname + phone, requires canonical event_id + template_id resolution, forces booking_status=pending, payment_status=unpaid and contact_channel=LINE, and refuses success without a canonical booking_id read back from the SOT.

## Deliberately not activated
The contract is not wired to Production writes yet. The existing Direct Writer Phase 1 explicitly excludes Booking creates because atomic create/idempotency semantics are not implemented there. Legacy Apps Script createBooking has a document lock but does not currently expose request_id uniqueness as the booking transaction key.

## Next activation gate
Implement a Booking-create writer that atomically checks request_id, writes only 00_Master_Booking B:T (preserving generated booking_id formula A), performs exact readback including A, and records the request in audit storage in the same governed operation. Redelivery must return the original canonical booking rather than append a row.


## 2026-10-01 atomic create hardening
The repository Apps Script source now implements request-scoped idempotency for `createBooking` without changing the canonical `00_Master_Booking` A:T schema.

Within the existing document lock, a supplied valid `request_id` is checked against recent successful `createBooking` entries in `15_Admin_Audit_Log`. A replay returns the original canonical `booking_id` and row number and does not append a second Booking or a second success audit row.

For a new request, the writer continues to write only B:T so generated booking_id formula column A is preserved. It then calls `SpreadsheetApp.flush()`, reads back A:T, and fails closed if the canonical booking_id is not available. The normal doPost success audit records request_id together with canonical booking_id/row_number, completing the replay ledger while the document lock is still held by createBooking.

Public LINE webhook activation remains deliberately out of scope. Repository contract acceptance must pass first, followed by deployed Apps Script/runtime acceptance before any production webhook is allowed to invoke the writer.
