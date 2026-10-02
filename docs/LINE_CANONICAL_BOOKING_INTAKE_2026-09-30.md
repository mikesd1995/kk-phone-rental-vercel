# LINE canonical booking intake — governed implementation record (2026-09-30)

## Finding
The storefront does not create a booking. It only opens a LINE OA deep link. The LINE webhook currently parses the customer message and replies with Flex. Canonical bookings are created through the existing createBooking path and use booking_id in 00_Master_Booking as the stable identifier.

## Safety decision
Do not mint a second LINE booking ID. Do not connect the public webhook directly to legacy createBooking until create semantics have a production-safe idempotency transaction. The current direct Google Sheets writer intentionally excludes Booking mutations because create operations still depend on lock/transaction semantics.

## Implemented now
- Preserve nickname, phone and pickup time parsed from the LINE booking message.
- Pass customer display fields into the Flex builder.
- Flex supports booking.booking_id but renders it only when a canonical SOT ID is supplied.
- Regression test proves the UI never invents a Booking ID.

## Required gate before SOT writes
A future LINE createBooking adapter must:
1. derive a stable request_id from LINE webhookEventId;
2. accept only pending status;
3. resolve event_id and template_id canonically, not by display text alone;
4. commit exactly once under a transaction/lock or equivalent atomic uniqueness guard;
5. read back booking_id from 00_Master_Booking;
6. reply with Flex only after confirmed readback;
7. return the prior canonical booking on webhook redelivery;
8. fail closed on ambiguous event/package/customer data.

No production Booking/Sheet write is introduced by this change.


## E2E hardening update — 2026-10-02
- Added an explicit canonical-resolution boundary before mutation intent construction.
- Display text, package label, or displayed price alone cannot authorize a booking mutation.
- Canonical event_id and template_id are mandatory; package_id is carried as supporting canonical identity when available.
- Same LINE webhookEventId deterministically produces the same request_id across redelivery.
- Synthetic regression proves the only permitted intent remains pending + unpaid + amount_received 0 + LINE contact channel.
- Public webhook remains intentionally unwired from production booking writes until the Apps Script deployment-equivalence gate is accepted. No production booking/customer data was mutated by this hardening.
