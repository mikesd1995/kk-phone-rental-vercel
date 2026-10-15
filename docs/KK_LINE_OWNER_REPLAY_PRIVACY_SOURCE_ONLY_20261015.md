# KK LINE Owner Replay / Provider Privacy — Source-Only Candidate (2026-10-15)

Baseline canonical PR #744: 52f5d411de8d0fc4c8a98ab362caeb37619e0c65.
Source reviewed: owner-approval safety subset in draft PR #742 at 1ac8768ea9275b0f448af35d4b4456dac392cb43 (PR #742 remains OPEN; not superseded).

## Why this candidate exists
- Canonical #744 incorrectly treats Apps Script `idempotent_replay:true` as permission to send LINE notifications again.
- It does not strictly demand `idempotent_replay` boolean or exact canonical booking ID on owner decision readback.
- Customer push and owner reply happen in parallel; owner could hear confirmed while customer push failed.
- Apps Script errors, provider HTTP response and thrown transport error can include customer data in webhook logs.

## Candidate scope
- `server/line-booking-owner-approval.js` selectively ports tested safety logic from #742; no provider calls during development/test.
- `tests/line-booking-owner-approval-replay-failclosed.test.js`: reject missing/numeric/string replay, no duplicate sends, owner identity, exact booking ID.
- `tests/line-booking-owner-approval-upstream-privacy.test.js`: sanitize errors, transport failure, avoid false acknowledgement.
- `tests/line-booking-owner-approval.test.js`: update synthetic legacy readback fixture to include explicit replay evidence.

## Gates
- Source-only draft branch based on PR744, target PR744 rather than main, do not merge/deploy.
- No changes to Storefront or #700 private image, #706 booking identity, #721 ACL, #742 original branch.
- Exact-head GitHub Actions tests required before candidate acceptance.
- This fixes duplicate sends on repeated decisions; it does **not** deliver durable exactly-once semantics. An outbox + receipt is still required before actual LINE automation activation, and owner approval remains mandatory.
- PR #744 Storefront Visual QA and Issue #49 remain HOLD.
