# LINE Owner Approval — replay and canonical booking identity guard (2026-10-12)

## Problem and risk
The signed LINE owner postback in `server/line-booking-owner-approval.js` previously verified the owner user ID and HMAC then called the pending-only Apps Script decision RPC. The RPC returns `idempotent_replay=true` when a prior identical decision is already applied, **but** the handler then still sent the customer push notification and owner reply again. This creates duplicate LINE messages on webhook retries, repeated taps, or ambiguous delivery. Separately, it checked the resulting booking status but did not insist the canonical returned `booking_id` match the owner-selected ID, creating a potential wrong-customer send if an upstream response is misrouted.

## Changes in Draft PR #706
1. After the governed Apps Script result, enforce `data.booking_id===parsed.booking_id` *before any LINE customer or owner notification*. Wrong IDs throw `LINE_OWNER_DECISION_BOOKING_ID_MISMATCH` and no provider call occurs.
2. Keep existing exact status readback: `approve` => `confirmed`, `reject` => `cancelled`.
3. When `data.idempotent_replay===true`, return `ALREADY_APPLIED`, `customer_notifications:0`, `owner_notifications:0`, `requires_manual_delivery_review:true`. Never auto-repush on uncertain previous delivery. This intentionally avoids duplicate sends at the expense of requiring manual reconciliation if a previous provider send failed.
4. No changes to booking statuses, source-of-truth bookings, prices, owner hidden dates, deposit-free business logic, apps script deployment, or Telegram/X actions.

## Tests
- New tests in `tests/line-booking-owner-approval.test.js`: repeated approve sends 0 provider messages; repeated reject sends 0; mismatched backend booking ID sends 0 and fails closed.
- Existing tests retained: owner actor/HMAC validation, no-owner denial, pending creation, canonical receipt/status check, missing customer contact denial.
- The original Apps Script source-specific test was moved unchanged into `tests/line-booking-owner-approval-apps-script-contract.test.js` because Vercel's `.vercelignore` excludes `apps-script/`. Run that source test from the repository via `npm run test:line:apps-script-contract`; Vercel Preview executes the runtime suite only.
- As an independent cross-check, the connected GitHub file `apps-script/Code.gs` (blob `6f923036855cd13e58a0ed9c1154fef746ca1ad8`) was inspected, and 11 source contract assertions passed (pending-only lock, actor decision transition, idempotent replay, readback and contact guards).
- Vercel Preview initial attempt `dpl_CDDu67TgPpZhFYy5DuoFzVQBfWe8` failed **only because of an excluded Apps Script file**; after splitting tests, Vercel Preview `dpl_HLxqgA1LvN59JcZsoFg4yC7uoBec` at commit `a7777414534022d38fe8df19f2cc78d9ee70c02f` = READY, runtime LINE approval tests **10/10 PASS**, 0 failed.

## Required gates before production
- Production LINE booking automation feature flag remains independent; do NOT enable it just because Preview tests pass.
- Complete record-version-bound expiring decision challenge and exact booking snapshot revalidation (date, price, inventory, owner hidden/booking locks) before declaring full end-to-end owner approvals finished; existing signed v1 postback does not embed version or expiry.
- Test actual owner-only LINE postback in the correct provider channel with canonical updated booking readback, single customer notification on first valid approval, zero duplicate pushes after retry, and manual review path for a prior uncertain send.
- No customer messages, business writes or owner decisions were performed while writing/testing this Draft PR.

Cross-chat project changelog: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/696.
