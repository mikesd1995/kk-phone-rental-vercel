# LINE booking decision delivery: bounded safe retry + outbox handoff (2026-11-12)

## Source and ownership
- Base: main `735bbf7c159df7f2fd6b93e5324df131727f91c9`.
- This branch modifies **only** the isolated LINE owner approval sender, its safety tests, the dedicated CI workflow and this runbook. It leaves active PR #862 webhook, #865 storefront and #852 canonical GAS/Sheets changes untouched.
- P0 incident: #861. Existing broad audit: #489. This improves one real runtime failure mode but **does not implement a durable outbox**, guarantee provider delivery, or authorize production.

## Runtime remediation now implemented (source only)
- Every **initial customer decision push** uses a deterministic HMAC-derived UUID-shaped `X-Line-Retry-Key` (booking + decision + canonical recipient). The retry request uses the **same recipient, same message and same key**. No recipient/booking PII or token appears in the key header.
- On a LINE transport error or 5xx, wait 250 ms then make **one bounded retry**. On 400/403/409-without-valid-acceptance/429 do **not retry**. Provider diagnostics are sanitized.
- Treat LINE 409 only as **prior provider acceptance** when its `x-line-accepted-request-id` response header is present on a keyed push. It is **not** proof the user received a message (blocked bots remain possible).
- Never attach retry headers to the reply-token API; never send owner confirmation unless the customer push is accepted by LINE. Canonical idempotent replay continues to send **zero messages** and marks manual-delivery review, so older failures cannot trigger unbounded or duplicate deliveries.
- Per [LINE's official retry specification](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/), keys expire after **24 hours** and only work on push/multicast/narrowcast/broadcast, **not reply**. Do not replay a decision after that window without durable evidence and owner intervention; secret rotation can also change derived keys.

## Offline regression tests (9 cases)
Run `node --test tests/line-owner-delivery-failure-regression-20261111.test.js` via dedicated exact-HEAD GitHub Actions. All tests inject mock fetch (no real provider/Sheets writes).
1. Canonical `idempotent_replay: true` suppresses both customer push and owner reply; returns manual-delivery-review marker.
2. Customer LINE push repeatedly returns HTTP 503: two bounded keyed attempts only, error sanitized, never owner success reply.
3. Non-boolean canonical replay evidence fails closed without LINE sends.
4. Customer push transport throws twice: no provider details leaked and no owner success reply.
5. Canonical booking identity mismatch prevents all LINE sends.
6. Transport timeout followed by LINE 409 with `x-line-accepted-request-id`: correct duplicate acceptance handling and exactly one owner reply; check UUID version, same key/body and reply without key.
7. Provider 503 followed by HTTP 200: one successful owner reply, no payload/key drift.
8. LINE HTTP 400: never retried, never owner success.
9. LINE HTTP 409 without accepted-request evidence: fails closed without owner success.

**Limitations:** short retry is *best-effort*. A crash or double failure after canonical Booking commit can still leave the customer unnotified because persistent outbox intent/receipts are absent. Provider acceptance is not human delivery. CI passing does not prove real provider E2E or deployed GAS contract parity.

## Remaining architecture work (separate owner-approved implementation)
1. Establish deployed Apps Script contract/version and identify the canonical single writer before modifying booking rows.
2. Persist a durable notification intent **in the same transaction/lock scope** as canonical owner decision. Key by `booking_id + decision + recipient + message_type`; enforce uniqueness.
3. Explicit state machine: `PENDING -> CLAIMED -> SENT/FAILED_UNCERTAIN`, bounded claim lease and recorded provider request/receipt metadata. Do not treat HTTP 200 alone as proof of human delivery.
4. A provider timeout after transmission is **uncertain**, not safe for blind resend. Reconcile provider receipts/manual owner confirmation before any retry; never replay expired LINE reply tokens.
5. Crash tests: decision committed before send; provider 503; provider timeout after send; webhook duplicate; owner double-click; customer blocked bot; missing contact; stale Apps Script; concurrent workers.
6. Rollout gated: read-only reconciliation -> staging synthetic IDs -> independent security review -> exact-head CI -> owner UAT -> approved production deploy -> alias SHA readback and rollback.

## Release rules
No merge, deployment, Google Sheets, booking, Owner Lock, secret, or live provider-send action is authorized by CI evidence for this review branch. Keep #862/#865/#852 unchanged and verify overlapping paths before any future integration.

## Cross-chat closure
Bounded safe-retry source remediation completed when its **exact-head, explicitly invoked** CI is green. **P0 incident remains open** until independent review, provider/customer+owner E2E, durable delivery reconciliation and approved production release are verified. Never claim that safe provider retry gives exactly-once human delivery.
