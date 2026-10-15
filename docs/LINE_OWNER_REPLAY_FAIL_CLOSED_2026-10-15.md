# LINE Owner Postback — Fail-closed Replay/Notification Safety (2026-10-15 ICT)

**Scope:** Existing Draft PR #742 (branch `fix/line-owner-decision-replay-20261014`), source base `c31da558914af401574f3f5907e342bf8f803239`. No modification to Gemini-owned PR #744, no main merge, deployment, customer message, booking/stock/price/ACL mutation or paid services.

## Root cause / comparison
- Branch #742 already rejects mismatched canonical booking ID, stops duplicate sends for literal `idempotent_replay:true`, and sends customer before owner acknowledgement.
- **P0 gap:** Missing/non-boolean canonical replay flag previously allowed an extra LINE push. This includes string `"true"` and absent flag; ambiguous prior sends must never be guessed.
- Existing replay handling reported a normal CONFIRMED/CANCELLED outcome even though the previous provider delivery has no durable receipt.
- #706 adds separately gated V2 version/expiry challenge and Apps Script writer; NOT cherry-picked without canonical source acceptance. #700 uses durable outbound delivery/inbox persistence; requires independently reviewed Supabase and LINE integration. Three branch versions of `server/line-booking-owner-approval.js` are distinct (not interchangeable).

## Minimal fix on #742
1. Require literal boolean `idempotent_replay` after matching booking ID and status, before any LINE API send. Non-boolean fails with `LINE_OWNER_DECISION_REPLAY_READBACK_REQUIRED`.
2. On true: return `ALREADY_APPLIED` with `decision_status`, `requires_manual_delivery_review:true`, and zero notification counts; this is not a delivery receipt. Customer contact is not required to suppress a proven replay.
3. On false: retain canonical customer contact requirement, customer push **before** owner reply. No automatic resends after provider-ambiguous failure.
4. Update old test fixture to explicit false and replay expectation; add focused no-network tests for invalid flags, approve/reject replay, missing customer contact, authorization and order.

## Verification and outstanding gates
- Isolated exact-source JavaScript V8 preflight: **22/22 assertions PASS**, synthetic crypto/LINE/App Script mocks, network calls only to mocks; source/new test syntax evaluated. Not Node `npm test`, hosted CI, Apps Script write or real LINE receipt.
- Need owner-controlled native Node 20+ full tests and review of webhook replay/authorization and an independently verified Apps Script `idempotent_replay` boolean readback before future merging.
- A locked booking decision can still lose customer delivery after a provider/network failure. **Exactly-once delivery is NOT solved** until a durable outbox and provider receipt are admitted. Never send a second message solely on retry.

## Other independent PR collisions (READ-ONLY)
- Storefront #727 / #725 / #722 / #711 share source/scripts/CSS; #727 is proposed integration of hero+poster but is not accepted without exact-head viewport TH/EN Dark/Light, booking prices, owner hidden events, and poster load/crop QA. Do not blanket merge/close old PRs.
- Scanner #720 / #732 / #695 all touch `server/kk-ultra-deep-runtime-runner.js` with distinct blobs and different PR bases; reconcile known-miss official source/date handoff, timeouts and zero-write/owner-day guards before a bounded candidate can be promoted.
- Gemini owns #744 Private Core/Revenue/Workflow work; keep it separate.

## Rollback
Revert this isolated commit on #742 only; leave main, #744, #700, #706, #727, #720, all Production deployments and private business state unchanged.
