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