# LINE Booking owner full-path acceptance — 2026-11-11 ICT

## What this change actually implements
- Adds 2 deterministic, **entirely synthetic** end-to-end source tests to the *existing* `tests/line-booking-owner-approval.test.js`. No runtime source, datastore, API route, environment variable or customer-facing UI change.
- Exercises production source handlers: inbound booking text -> public WebReady/Packages canonical validation -> `createLineBookingPending` payload -> canonical booking ID -> owner Flex card with two signed decisions -> `decideLineBookingPending` on the **same** booking -> exact status readback -> outbound customer result -> owner reply.
- Runs both Confirm and Reject paths. Validates unique create/decision action, pending + unpaid, no hardware allocation at Pending, correct canonical price rather than customer-typed price, signed postback binding, owner recipient, same customer recipient, and delivery ordering.
- Every external URL is intercepted by injected `fakeFetch` and synthetic JSON/CSV fixtures. **No real LINE sends, Google Sheet writes, Supabase writes or Apps Script calls.**
- Test location is the already-scoped Booking E2E CI target, not a redundant test workflow or unexecuted standalone fixture.

## Incident findings grounded in actual read-only services
- Parent P0: [#861](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/861).
- Vercel production READY `dpl_2CyyhK7vyUm2cUMeiDzEgBdSBN2n`, SHA `735bbf7c159df7f2fd6b93e5324df131727f91c9`.
- The **Production variable names** `KK_LINE_BOOKING_AUTOMATION_ENABLED` and `KK_OWNER_LINE_USER_ID` remain **absent**. Therefore owner approval is deliberately fail-closed. No secret values were decrypted.
- Vercel grouped failure `[line-webhook] LINE booking reply failed` last at `2026-11-11 14:21:24Z` (21:21:24 ICT). Read-only Supabase Inbox also records a booking-like inbound at **21:21:24 ICT** for public event My Chemical Romance – South East Asia Tour, 17 November 2026; this aligns exactly in time but does not provide an independently joined Vercel request ID.
- Public canonical Sheet `08_Web_Ready` row 206: same event/date/venue, action `show`, booking status `เปิดจอง`, 1 available phone. `09_Web_Packages` row 607: Vivo X300 Pro + Lens, 690 THB, available. Inbound line's public package label matches. The event poster source is on a host not in the current LINE poster-proxy allowlist; this should yield **text-only Flex**, not prove actual LINE provider rejection. Do not assign causality without redacted provider status.
- The canonical Booking master already contains **BK-20261117-001** (row 94), confirmed, bundle, assigned assets, payment unpaid. No duplicate row or replay is permitted. Customer identity/contact withheld from public issue/docs.
- Existing `kk_private.inbox_outbound_attempts` is an Admin Inbox send ledger; it is **not established** as an atomic LINE Booking decision outbox.
- Official LINE Reply Tokens are short-lived and single-use, and the current source awaits canonical data/owner notifications before replying. This is a timeout risk, not a verified 400/401/429/provider root cause: https://developers.line.biz/en/reference/messaging-api

## Existing work; avoid collisions
- [PR #862](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/862): sanitized LINE reply diagnostics + per-event shared upstream read; existing protected Preview READY exact `f3274ce7dd51c72bf8d98518955be9c131ed3604`. Separate release HOLD; no merge.
- [PR #866](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/866): separate replay/failed-customer-delivery offline tests + outbox design. This change adds integrated inbound-to-owner coverage instead; it does not supersede #866.
- [PR #868](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/868): Terms UX removing LINE legal lines — remains draft and changes acceptance evidence semantics; cookie is not signed customer LINE acceptance.
- #865/#852 supply stock and owner-lock correctness gates; do not enable automation before those gates and canonical Apps Script Gate #9.

## Release/activation acceptance (still blocking)
1. Native exact PR HEAD Booking E2E tests **must run and pass**; full suite and independent reviewer required. Do not claim CI pass from file write alone.
2. #862 diagnostic release requires its separate independent review, protected Preview and owner exact-SHA go/no-go; only then capture a fresh **sanitized** real Reply API error category. Do not replay old LINE Reply Tokens.
3. Verify bounded Apps Script deployment/source equivalence and owner-signed authorization; confirm the actual owner's LINE User ID via owner-verified LINE event. Do not guess recipient.
4. Design/accept a durable, atomic notification outbox so ambiguous provider failures/replays cannot duplicate owner or customer cards.
5. Synthetic hosted E2E and then owner-authorized production test: exactly one Pending, owner card once, owner Confirm/Reject on distinct fixtures, canonical readback and customer notifications, no unintended stock/price/Owner Locks changes.
6. Only after exact-SHA CI + independent review + owner acceptance may the production flag be activated and a staged release promoted. Reread production alias and error logs.

## Status
**Test coverage patch, not a provider delivery fix.** Live incident #861 remains OPEN. No production, webhook send, booking data, provider, Secret, Vercel Production or Apps Script change made by this branch. Rollback: close the test-only PR.
