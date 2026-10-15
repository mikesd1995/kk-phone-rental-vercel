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

## 2026-10-15 — complete the bounded bookable-source port on current #744

- Reconciliation base: current canonical #744 `edcc8146f86ac81a573529412e1f035b4e0eb4d8`.
  Its seven previously ported #750 source/test/note blobs already equal
  #750 `72811d606db68e6811b7df767ccddad1a6772733`; no replay/privacy overwrite is needed.
- The omitted #742 guard was reproduced: a matching owner-hidden Web Ready
  row with available package stock resolved as canonical and reached the
  pending Apps Script writer. The two negative regressions fail before the
  source port (7/9 pass) and pass afterward (9/9).
- Port only the #742 public admission guard in `server/line-booking-webhook.js`:
  both canonical package lookup and poster resolution require `action_for_web=show`,
  `booking_status_for_web=เปิดจอง`, and a positive integer `available_phone_count`.
  Hidden, full, zero-stock and missing-stock event rows cannot be reopened by
  package stock. Existing sanitized error/replay handling is preserved.
- The three accompanying #742 test files retain positive price/date/poster
  behavior using complete Web Ready fixtures and prove that a hidden event
  performs no Apps Script write or owner/customer push and logs no private markers.
- Native Node `v24.19.0`: focused LINE suites **56/56 PASS**, routed
  `npm run code:test` **37/37 PASS**, full `npm test` **1,852/1,852 PASS** plus
  the separate poster ACL suite **26/26 PASS**; `npm run check` and
  `git diff --check` PASS. Independent source review found no blocking issue.
- Current #744 `buildBookingMsg` still emits the supported literal `รุ่น:`.
  A future #711/#700 integration emitting `รุ่น/แพ็กเกจ` or `Package / model`
  must port the bounded parser compatibility fix and regressions together;
  no private-media, outbound-ledger, UI, Apps Script or dependency changes
  are included in this reconciliation.
- Source tests use synthetic inputs and mock transports only. No merge,
  deploy, provider send, booking/data edit, migration, ACL change or paid
  operation occurred. Exact-head hosted CI and actual runtime/provider
  readback remain unproven; `RELEASE_READBACK=false` keeps the engineering
  execution gate **BLOCKED**. Keep automation OFF and release HOLD.
