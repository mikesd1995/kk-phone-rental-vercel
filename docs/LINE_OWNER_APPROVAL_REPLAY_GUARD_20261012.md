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

## 2026-10-12 continuation — opt-in Version 2 for owner-signed approval

**This section updates the earlier outstanding version-lock gate in the original document.** V2 source and tests are now implemented, but V2 is NOT deployed or activated; the existing v1 production behavior and all booking data remain unchanged.

### Source additions

- `server/line-booking-owner-approval.js`: optional `KK_LINE_OWNER_APPROVAL_V2_ENABLED` flag, with independent `KK_LINE_OWNER_APPROVAL_V2_SOURCE_READY` readiness gate (neither currently configured in Production). When enabled, approval/rejection postback is a `kkb2` HMAC of `[protocol,decision,bookingId,approvalVersion,expiry]`, with maximum 24-hour lifetime; tamper, expired/future timestamps, version changes, old `kkb1` tokens and non-owner actors fail closed.
- `server/line-booking-webhook.js`: source-returned `pending.approval_version` is passed to the owner Flex message; never generate version from unverified booking chat text.
- `server/line-booking-owner-approval.js` requires a valid `approval_version` in the Apps Script *canonical pending intake response* in V2 mode, calls `decideLineBookingPendingV2` with `expected_version`, then requires returned `approved_version` to match the signed challenge before any customer/owner LINE reply.
- `apps-script/Code.gs`: adds `kkLineBookingApprovalVersion_(row)` using SHA-256 of canonical A:T booking identity/status/contact/pickup/payment/receipt/note fields **AND** `kkLineBookingCommercialSnapshot_(row)`. The latter independently resolves the exact governed LINE request claim from script properties and current event/date/open state/active status plus the exact public package ID/price/status from `09_Web_Packages`; nonexistent/ambiguous price or mismatched claim fail closed. The historical v1 `decideLineBookingPending` route remains unchanged and V2 uses its own `decideLineBookingPendingV2` route.
- The V2 compare occurs **inside the existing Apps Script document lock, BEFORE any booking state mutation**, requires `pending`, enforces unpaid/no-deposit receipt=0, and blocks approval if event is no longer open/active or in the past. A genuine owner **reject** does not require the event to remain open, but does require the matching signed version. The response includes `approved_version` only for V2.
- Production-side Apps Script deployment and V2 env flags MUST be coordinated; source changes in GitHub alone do not update a live Apps Script deployment.

### Tests / evidence

- New `tests/line-booking-owner-approval-v2.test.js`: 8 Node test cases covering V2 readiness gate, 24-hour signed HMAC binding, tamper/mutation/expiry, legacy V1 rejection while V2 enabled, owner Flex signed payload, missing upstream version, exact v2 RPC/readback gate, wrong version denies sends, wrong owner denies all actions, and source version handoff. This runs alongside the 10 existing V1/replay tests in Vercel `postinstall`.
- Updated `tests/line-booking-owner-approval-apps-script-contract.test.js` (source-only command `npm run test:line:apps-script-contract`; Apps Script source is excluded from Vercel by `.vercelignore`).
- A direct isolated V8 evaluation of the **actual** `kkLineBookingCommercialSnapshot_` and `kkLineBookingApprovalVersion_` source, with mocked `PropertiesService`, `Utilities.computeDigest`, `kkGetEventById_`, and public package rows, verified eight conditions: 64-hex baseline, price changed invalidates, date changed invalidates, event status closed invalidates, package status changed invalidates, pickup changed invalidates, zero price throws, wrong claim booking ID throws. **This is a mock test of the real source, NOT a live Apps Script execution.**
- Exact-head Vercel Preview **`dpl_3tRAcqfHSmnL6vnnnmupa3hVGExT`**, SHA `3f30a290c8850c25eac2180bb7d53d6314f4afaa`, READY: **18/18 runtime LINE approval tests PASS**, 0 failed, as verified from deployment build logs. All changes after this commit are Apps Script source and source-only checks; repeat exact-head Preview if any new Vercel runtime source changes are made.

### Guardrails still outstanding

V2 remains OFF until the owner-controlled live Apps Script deployed version matches source and one approved *owner-only* noncustomer staging test proves the signed challenge round trip, exact immutable version, stale price/date rejection, no duplicate messages and readback. A canonical price/availability check for actual bookable stock, tombstone/owner-hidden day policy and X approval governance still require independent acceptance; **do not assume the A:T/price fingerprint is a substitute for verifying every event-day and equipment-lock business rule**.

No new booking, customer message, Telegram send, X post, event/image publication, paid upgrade, or production deploy was performed in this work.

### 2026-10-12 compatibility hardening — do NOT break legacy intake

An important post-implementation check found that unconditionally computing V2 `approval_version` in every Apps Script `createLineBookingPending` response would retroactively require new `09_Web_Packages` commercial data for **legacy V1 bookings**. That could fail AFTER an existing booking had already been created. Fixed before any deployment:

- `server/line-booking-owner-approval.js` now sends `approval_mode:'v2'` to canonical Apps Script intake ONLY when V2 is explicitly enabled. Legacy V1 sends the exact previous intake payload, without the mode field (commit `5c3d78867ade4db0eaa74b3212108172477d4659`).
- `apps-script/Code.gs` computes a 64-character approval fingerprint in all three create/replay result paths ONLY for explicit V2 mode; V1 always returns an empty version without a new source lookup. V2 must verify one exact current public package with a positive price **before** claiming a request or writing a new Booking (commit `7be7493431bba69d1c2a5a7a7c774705268f3250`).
- Added two runtime Node tests for both V2 source-backed request/return and V1 mode backwards-compatibility (commit `6030077a469bd84c5d457b4250ae6d0e9a5e9e23`). Added a source-only test asserting V2 preflight runs before claim/Booking writes and V1 route remains independently available (commit `9f1f61961c403eb6f279358c74e317f8d80efa6b`).
- Thus the V2 schema change is **opt-in on both ends**; never deploy the GitHub Source alone and infer that the active Google Apps Script Web App deployment changed. Verified official Google documentation: versioned Apps Script Web Apps must be explicitly updated to point to a new version; the repository source by itself does not update that live version.

The independent mocked helper tests (not live Apps Script) found changing price, date, event status, package status, pickup, invalid price and wrong claim all invalidate/reject. Source-only verification and app version readiness must be replayed after any change.

V2 remains OFF in Production, and all three PRs remain Draft pending actual acceptance.
