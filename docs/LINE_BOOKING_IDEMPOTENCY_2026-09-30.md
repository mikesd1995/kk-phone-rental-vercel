# LINE booking intake idempotency — implementation record

Date: 2026-09-30

## Implemented
A server-side contract now derives a deterministic request_id from LINE webhookEventId, requires nickname + phone, requires canonical event_id + template_id resolution, forces booking_status=pending, payment_status=unpaid and contact_channel=LINE, and refuses success without a canonical booking_id read back from the SOT.

## Deliberately not activated
The contract is not wired to Production writes yet. The existing Direct Writer Phase 1 explicitly excludes Booking creates because atomic create/idempotency semantics are not implemented there. Legacy Apps Script createBooking has a document lock but does not currently expose request_id uniqueness as the booking transaction key.

## Next activation gate
Implement a Booking-create writer that atomically checks request_id, writes only 00_Master_Booking B:T (preserving generated booking_id formula A), performs exact readback including A, and records the request in audit storage in the same governed operation. Redelivery must return the original canonical booking rather than append a row.
