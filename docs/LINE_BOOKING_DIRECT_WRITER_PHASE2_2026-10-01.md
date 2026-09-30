# LINE Booking Direct Writer Phase 2 — 2026-10-01

## Scope
Adds a write-disabled-by-default Phase-2 module and tests for governed LINE booking creation. It is not wired to the webhook.

## Guarantees under test
- exact deterministic `line:<48 hex>` request_id is required;
- only `pending / unpaid / LINE` intake is accepted;
- pending intake forbids phone/lens asset assignment;
- booking mutation starts at column B and spans B:T only, preserving generated booking_id formula A;
- Booking mutation and audit append are emitted in one Sheets batch;
- canonical success requires A:T readback with non-empty booking_id and blank pending assets;
- replay of a successful request_id returns the original canonical booking without a second mutation;
- any post-batch readback failure is marked mutation-committed/uncertain and forbids legacy fallback.

## Activation
`KK_LINE_BOOKING_DIRECT_WRITER_PHASE2_ENABLED` is required. No webhook routing or Production activation is included in this PR.
