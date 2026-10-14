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
