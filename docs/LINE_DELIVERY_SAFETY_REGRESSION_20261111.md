# LINE booking delivery safety: regression and outbox handoff (2026-11-11)

## Source and ownership
- Base: main `735bbf7c159df7f2fd6b93e5324df131727f91c9`.
- This branch **only adds isolated offline regression tests and this runbook**. It does not touch existing LINE implementation or active PR #862/#865/#852.
- P0 incident: #861. Existing broad audit: #489. This work is a safety baseline, **not** a durable outbox implementation or production fix.

## Tests added
`node --test tests/line-owner-delivery-failure-regression-20261111.test.js`
1. Canonical `idempotent_replay: true` suppresses both customer push and owner reply; returns manual-delivery-review marker.
2. Customer LINE push HTTP 503 is sanitized; owner success reply is not sent.
3. Non-boolean canonical replay evidence fails closed without LINE sends.
4. Ambiguous customer push transport failure cannot produce an owner success reply; provider exception details stay sanitized.
5. Canonical booking identity mismatch prevents all LINE sends.

These tests exercise local injected fetch mocks. They do not prove provider delivery, deployed Apps Script compatibility, or exactly-once semantics. Native exact-head CI must pass before any merge.

## Remaining architecture work (separate owner-approved implementation)
1. Establish deployed Apps Script contract/version and identify the canonical single writer before modifying booking rows.
2. Persist a durable notification intent **in the same transaction/lock scope** as canonical owner decision. Key by `booking_id + decision + recipient + message_type`; enforce uniqueness.
3. Explicit state machine: `PENDING -> CLAIMED -> SENT/FAILED_UNCERTAIN`, bounded claim lease and recorded provider request/receipt metadata. Do not treat HTTP 200 alone as proof of human delivery.
4. A provider timeout after transmission is **uncertain**, not safe for blind resend. Reconcile provider receipts/manual owner confirmation before any retry; never replay expired LINE reply tokens.
5. Crash tests: decision committed before send; provider 503; provider timeout after send; webhook duplicate; owner double-click; customer blocked bot; missing contact; stale Apps Script; concurrent workers.
6. Rollout gated: read-only reconciliation -> staging synthetic IDs -> independent security review -> exact-head CI -> owner UAT -> approved production deploy -> alias SHA readback and rollback.

## Release rules
No merge, deployment, Google Sheets, booking, Owner Lock, secret, or provider-send action is authorized by this test-only PR. Keep #862/#865/#852 unchanged and verify overlapping paths before any future integration.

## Cross-chat closure
Test-only risk mitigation completed when CI is green; **P0 incident remains open** until provider/customer+owner E2E and durable delivery recovery are verified. Never report this PR as full technical-debt closure.
