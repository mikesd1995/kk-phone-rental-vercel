# LINE Booking P0 Webhook Visibility/Reply Error Safety — 2026-10-15

Scope: Draft #742, pre-change HEAD `01842f448fb27e6484e4a9c733e743c104731a6e`. No merges, Production deploy, customer sends, paid actions, Google Sheets writes or Gemini-owned #744/#739/#737 edits.

## Reproduced root cause (synthetic, read-only)
- Verified existing server webhook accepted stale `available` package when WebReady event action was `hide`, `show_full` or `booking_status_for_web=เต็ม`; 0 available phones also did not block package resolution. Could enqueue pending hidden/full event. This is a synthetic path reproduction, not evidence of an actual customer booking.
- Existing `replyFlex` copied provider HTTP429 body `MOCK_PRIVATE_CUSTOMER_CONTACT` to the thrown error potentially logged by outer webhook.

## Patch
- Apply exactly the existing storefront/X admission contract: `action_for_web=show`, `booking_status_for_web=เปิดจอง`, integer `available_phone_count>0`, to BOTH public event-to-package canonical resolution and poster lookup, before any pending Booking writer.
- Sanitize LINE reply HTTP and fetch thrown errors to stable codes `LINE_BOOKING_REPLY_FAILED` / `LINE_BOOKING_REPLY_TRANSPORT_FAILED` and optional numeric HTTP status, no upstream body in logs.
- Replace log echo of customer-provided event title and webhook event identifier with a fixed fail-closed reason.
- Update 2 existing WebReady CSV test fixtures and add 3 regression cases within already-gated `tests/line-webhook.test.js`.

## Acceptance / remaining gates
- Pre-commit isolated source V8 mock: 3/3 new regression cases and 33 assertions PASS, no network, no business writes. This is not native Node CI.
- Existing Booking E2E workflow runs Node20 on PR source, includes `tests/line-webhook.test.js`; require exact-head check, baseline comparison and reviewer before acceptance. Historic #742 Native Booking E2E 61/61 PASS on different SHA; full suite 21 preexisting failures.
- Gemini PRs #744/#739/#737 have zero changed-file overlap at this patch. PR #700/#706 LINE versions require later conflict reconciliation.
- Since this is backend booking-flow admission behavior, registered UX/owner review still holds for Production release; no Merge/Deploy permitted.

Rollback: revert only the isolated #742 commit. Do not replay LINE events or modify Sheet/Booking/ACL.
## Verified hosted Native Node 20 completion — final source SHA (15 October 2026)

**Native CI evidence:** [Booking E2E run 38693684661](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38693684661), exact `pull_request` head `c05bcc23bad4bf75a38b093dac6c60626cb42d0f`, ubuntu-22.04 Node20; existing workflow includes exact SHA checkout, source syntax, E2E tests, full `npm test`, pinned-main checkout and failure name equality comparison.

| Check | Observed result |
|---|---|
| Booking E2E targeted | **64 / 64 PASS**, 0 fail |
| Full candidate `npm test` | **1,522 tests: 1,501 PASS, 21 FAIL** |
| Pinned main `d6dc3bfe...` | **1,498 tests: 1,477 PASS, 21 FAIL** |
| Compared failed test names | `introduced_failure_names=[]`, `resolved_failure_names=[]`, `same_failure_set=true` |
| Workflow syntax + exact SHA checkout | PASS |
| Safety post-condition no provider env activation | PASS |
| Overall workflow | **FAIL/HOLD**, because 21 baseline full-suite failures remain |

### Resolved new regression after first candidate
- Initial [run 38693193467](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38693193467), code SHA `495f76e8234e35bfe18a69eeb8551207650f7e2f`: Booking E2E 64/64 PASS, full 1,522 tests 1,497 PASS / 25 FAIL vs baseline 21. Four introduced names were legacy canonical bundle price, comma price, multiday event/date resolver and safe proxy poster tests.
- All four introduced names arose from older synthetic WebReady fixtures missing the source-governed `action_for_web`, `booking_status_for_web`, `available_phone_count` fields. Neither test runtime logic nor production business data needed changes.
- Test fixture-only commits [`bab067e`](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/bab067e820ff6aa60aed9fb3ce4cb05c8f5e20d5) and [`c05bcc2`](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/c05bcc23bad4bf75a38b093dac6c60626cb42d0f) supplied legitimate `show,เปิดจอง,1` to positive and package-negative fixtures. New hide/full/zero-phone tests remain negative and enforced. Final exact run proves the four new failures are cleared with no weakened gate.

### Guard behavior & integration boundary
- `server/line-booking-webhook.js` requires `action_for_web=show`, `booking_status_for_web=เปิดจอง`, and positive integer available phones before canonical package selection or poster; stale available packages never reopen hidden/full events.
- LINE reply HTTP/transport error messages never reflect untrusted provider response bodies; a missing canonical source logs a constant static reason, no raw `webhookEventId` or customer-entered event title. This is a source-level risk mitigation, not a certified absence of all possible privacy leaks.
- No merge, Production or Preview deployment was authorized. No customer LINE push or real Apps Script/Booking/Sheets/ACL write happened in these tests. `main` remains unchanged. No new dependency, package.json, Gemini workflow or paid integration.
- **Merge remains blocked**: full global 21 baseline failures, registered product/UX reviewer and owner acceptance for this Booking flow change, confirmed deployed Apps Script writer version, durable outbox/recipient receipt / exactly-once semantics with #700 and owner postback version binding with #706, real end-to-end provider UAT. Reconcile #700/#706 later; never cherry-pick blindly.

### Cross-chat handoff
- Current PR: [#742](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/742), Draft/HOLD. Last native tested code: `c05bcc23bad4bf75a38b093dac6c60626cb42d0f`; this documentation-only commit will follow.
- Never edit Gemini branches #744/#739/#737. Check exact shared-file lists at any future commit, and keep rollback scoped to this PR's commits. Any merge/deploy must be separately authorized under existing safety gates.
