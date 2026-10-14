# Notification recovery execution evidence — 2026-10-14 (tasks 1–6)

**Status: OPEN / fail closed.** This is a read-only audit plus one isolated code fix, not production recovery. No paid credits, customer sends, Make activation, production deployment, or merge.

## Task 1 — LINE owner configuration
Vercel project `prj_snbAmpya7YGmOuMbv1o8T16ouxl6`, team `team_uaeOdVIjXMSW690ZM2wPuJyt`. Project env listing with decrypt=false returned 16 records. Production key **presence** confirmed: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `KK_ADMIN_SCRIPT_URL`, `KK_ADMIN_API_KEY`. No project env entry for `KK_LINE_BOOKING_AUTOMATION_ENABLED`, `KK_OWNER_LINE_USER_ID`, or `KK_OWNER_LINE_TARGET_ID`. The latter target is optional when owner user ID exists. **Correction:** the earlier statement that the admin API key was missing was wrong; it is present. No trusted owner LINE user ID verified; no env write or flag activation performed.

## Task 2 — LINE duplicate owner-decision notifications
Draft PR #742 `fix/line-owner-decision-replay-20261014`, head `d9e54e12f04349bc2628126306f7cc86b5f230d6`, changes `server/line-booking-owner-approval.js` and `tests/line-booking-owner-approval.test.js`. Prevents a duplicate LINE customer and owner notification when canonical decision readback returns `idempotent_replay:true`. This fixes a source-level replay path, but **is not accepted or deployed**.

## CI gate readback
GitHub Actions `Booking E2E Acceptance` run `38557774876` for PR #742 head: **completed / failure**. Job `acceptance` id `115831077248`: failure; job steps/logs not supplied by connector (`steps:null`, `logs_url:null`). Therefore root cause of CI failure is **not verified**; do not claim the regression test failed specifically. Do not merge. Investigate run logs or reproduce exact-head tests and rerun.

## Task 3 — Telegram gateway
Make scenario `6600107` remains fail-closed, signed Prepare #3, Telegram Send #4, ACK #5 disabled and HTTP 503 response. Legacy `5901592` and `6176241` remain quarantined. Do not reactivate without a signed, TTL-bound, idempotent outbox/ACK path and owner UAT.

## Task 4 — Outbox / duplicate protection
The LINE owner-decision replay fix is isolated in PR #742. End-to-end outbox backlog, stale retries, provider acknowledgement and no-duplicate guarantees **not yet verified**. Never replay legacy queues without filtering expiration and confirmed deliveries.

## Task 5 — Make budget / monitoring
Make A org `8618622`: Free, 1000 unused operations, 0 active scenarios, reset 2026-10-10, next 2026-11-10. Make B org `8709610`: Free, 1000 unused operations, 0 active scenarios, reset 2026-09-19, next 2026-10-19. Both allow 2 active scenarios; auto-purchase off. Budget is available, but delivery is not enabled. Monitor queue age, attempts, provider response and owner receipt only after safe gateway acceptance.

## Task 6 — E2E acceptance
NOT PASSED. Require exact-head green CI, signed LINE webhook tests, canonical booking idempotency, owner authorization, Telegram signed Prepare/ACK replay/TTL tests, verified owner receipt and rollback. Do not turn on production flags, activate legacy Make, merge PR #742 or claim recovered.

## Cross-chat handoff
- Tracking issue: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/740
- Runbook PR: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/741
- Code fix PR: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/742
- Next immediate step: diagnose run 38557774876 logs and pass exact-head CI; separately establish verified owner LINE user ID before any live owner push.

## 2026-10-14 19:11+07 follow-up (new verification)
- Rechecked PR #742 head `d9e54e12f04349bc2628126306f7cc86b5f230d6`: GitHub reports draft/open and mergeable at metadata level, but this is **not** a safety-gate pass.
- Combined commit statuses returned zero legacy statuses; GitHub Actions workflow run `38557774876` is completed/failure. Job `115831077248` failure; connector returned no steps/logs, so root cause remains unverified. Do not assert the new test itself failed.
- Rechecked Make A org `8618622`: Free, 1000 unused operations, zero active scenarios, no auto-purchase, next reset 2026-11-10. Make B org `8709610`: Free, 1000 unused operations, zero active scenarios, no auto-purchase, next reset 2026-10-19.
- Rechecked scenario `6600107`: inactive, zero incomplete executions; Prepare HTTP #3, Telegram #4 and ACK #5 disabled; webhook trigger #1 and response #2 remain. Do not reactivate.
- **Critical acceptance caveat:** PR #742 suppresses sends on `idempotent_replay:true`, but an earlier Apps Script decision may have committed successfully while the first LINE customer push failed. A later webhook retry would be suppressed, causing a **lost notification**. Before merging, design durable delivery outbox/receipt (separate decision idempotency from notification-delivery idempotency), plus a deterministic regression test for commit-success/push-failure/retry. This is a known gap, not an accepted fix.
- Local exact-head checkout unavailable in this execution environment (GitHub host DNS inaccessible); do not represent source review or mocks as executed Node test results.
- Zero production env changes, zero live sends, zero Make scenario activations, zero merges/deployments.

## Additional code hardening — 2026-10-14
- Draft PR #742 branch `fix/line-owner-decision-replay-20261014`: code commit `04dd75a877347a0aafa49f70d690b93f327ade22` adds canonical booking ID equality check in `processOwnerPostback` before LINE sends; error `LINE_OWNER_DECISION_BOOKING_ID_MISMATCH` on mismatch.
- Test commit `2700dc550b61af165b09db076cd9b69248ade20b` adds a negative-path regression asserting mismatched canonical booking ID produces zero LINE sends.
- GitHub Actions lookup for exact head `2700dc550b61af165b09db076cd9b69248ade20b` returned zero workflow runs at time of check. **No claim that tests passed.** Earlier run `38557774876` for previous head failed.
- Remaining P0: durable LINE decision delivery outbox and receipt to avoid lost notifications; signed Telegram TTL/ACK; queue state/retries; owner identity and UAT; CI/E2E evidence. No merge/deploy/live sends/Make activation.

## 2026-10-14 additional attempted recovery and real code changes
- Tested direct local GitHub access using `git ls-remote https://github.com/mikesd1995/kk-phone-rental-vercel.git HEAD`; container DNS failed: `Could not resolve host: github.com`. Node 22.16.0 is installed locally, but without an exact-head repository checkout and dependency tree no full Node test result can be claimed.
- PR #742 code commit `cc57c67748b5b0da3b3312bd3047516e71cdf86b`: replaces parallel owner reply/customer push with sequential customer push first, owner reply only after successful LINE provider response. Prevents misleading owner acknowledgement on a known customer push failure.
- PR #742 test commit `c31da558914af401574f3f5907e342bf8f803239`: negative test for LINE push HTTP 503, asserts no owner reply and error propagated.
- Exact-head GitHub Actions lookup for `c31da558914af401574f3f5907e342bf8f803239` returned no runs at check time. Tests are **added but not verified passing**.
- **Unresolved:** canonical decision is committed before customer push; on push failure a replay may return `idempotent_replay:true` and suppress further delivery. Durable outbox + delivery receipt/reconciliation is required. This branch is not safe to merge or deploy until this is fixed and exact-head CI is green.
- Telegram gateway, Make activation, live LINE owner ID, and end-to-end UAT remain gated and unchanged. No production writes or customer sends.
