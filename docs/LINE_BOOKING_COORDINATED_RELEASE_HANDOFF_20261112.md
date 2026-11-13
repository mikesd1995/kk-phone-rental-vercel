# KK Phone Rental — coordinated LINE Booking release candidate (2026-11-12 ICT)

STATUS: **SOURCE ONLY, NOT PRODUCTION. RELEASE HOLD**. Parent P0: #861. Owner has approved the release effort, NOT bypassed independent review or missing real provider/DB evidence.

## Why one source candidate
The Production LINE draft appends the Terms/Privacy footer and LINE webhook returns `LINE booking reply failed`; owner card remains disabled without verified owner LINE User ID + feature gate. Independent PR #871 introduced clean booking text and signed LINE identity consent lookup; stacked #873 fixes false booking acknowledgment without verified Terms; #874 adds durable owner-decision write-ahead outbox and depends on #852 GAS phone-stock safety. These branches conflict semantically: replacing owner approval wholesale erases the verified-identity Terms badge; rolling out individual branches is unsafe.

## What was actually integrated in this isolated branch
1. Exact base: **PR #871** source `7f4cd985d9c895af20d98d723444d19ea2087118`. It includes the clean customer prefilled LINE booking/waitlist draft, first-use checkbox, opt-in LINE Login and server-only verified Terms receipt, signed webhook lookup, sanitized Reply API errors + shared event-local WebReady fetch; customer Login stays OFF.
2. From **PR #873**, identity Terms evidence missing/foreign/expired/unavailable now returns an explicit `ยังไม่ได้บันทึกคำขอจองค่ะ` LINE text, **not** the old generic "received booking" Flex. No canonical Pending or owner push before evidence. Integrated on newer #871 source without reverting its latest diagnostic/missing-nickname test.
3. From **PR #874**, retain canonical GAS write-ahead owner-decision outbox + 11-column private schema, protected dispatch credential preflight, one-time claim/retry-key, provider ID receipt and no unsafe replay. Source includes dependent **#852 GAS stock/phone-only preflight**; requires explicit combined review. Do not merge independently alongside #852/#874.
4. **Semantic owner merge:** Keep the exact owner-card verified LINE User ID Terms badge from #871 while adopting #874 durable decision dispatch. New integration test explicitly asserts both together; the existing #874 synthetic crash/receipt tests and #871 signed receipt tests remain.
5. All tests are offline/synthetic, no real bookings, LINE sends, Supabase writes or GAS execution. Neither LINE Login nor outbox nor owner automation is auto-enabled.

## Invariants that must remain
- Signed LINE webhook identity only + authenticated same LINE Provider's persisted receipt for current Terms version. No cookie/unsent LINE text/claimed nickname = no acceptance.
- Blank nickname or non-private LINE source does not create Pending; tell customer to fill details, no owner push. A screenshot with blank nickname is NOT a confirmed booking.
- Canonical Booking ID, price, event/date and stock/Owner Locks are authoritative. Do not create duplicates for NAMTAN 13 Nov/other existing bookings.
- GAS outbox INTENT before Booking decision, lock+readback, immutable recipient, one CLAIMED before customer Push, stable provider retry UUID, SENT only after provider receipt. UNCERTAIN requires manual review; never blind re-send.
- No merchant secret, real LINE identity, customer phone, screenshots or private ledger in GitHub artifacts. No fake independent approval.

## Required external releases / critical blockers
- **Independent reviewer** must approve this exact integrated SHA (and #852 GAS delta); no self-approval or unreviewed merge.
- **Correct deployed GAS source/version** checked against repository source; owner-private protected 19_Line_Decision_Outbox schema+ACL and dispatch secret provisioned in Apps Script and Vercel after privacy/rollback review; do not execute Code.gs or migrate without that authority.
- **Actual LINE Messaging API owner user ID and provider** verified from owner-controlled authenticated source; production currently has NO `KK_LINE_BOOKING_AUTOMATION_ENABLED` or `KK_OWNER_LINE_USER_ID` environment key names. Never guess LINE ID. Future flags must start OFF until paired release.
- **Same LINE Provider LINE Login channel** + exact callback registered; private Supabase customer acceptance migration, retention/deletion policy, RLS deny tests, approval and real record readback required before activating `KK_CUSTOMER_LOGIN_ENABLED` and public `customerLoginEnabled` together.
- **Real reply failure cause not diagnosed**: Production older code logs generic `LINE booking reply failed` without HTTP category. Need reviewed diagnostics-only release or safe stage actual LINE provider validation; do not invent 400/token-expired reason.
- **Real end-to-end** customer signed inbound → unique Pending → owner Flex → owner postback → canonical decision → durable notification/retry/receipt plus negative replay tests. Respect one real booking and rollback/incident plan. Owner UAT and exact SHA Production readback needed.
- Keep existing Live customer flow intact until acceptance evidence is ready: removing LINE legal attestation while disabled identity evidence would erase the current signed acceptance proof.

## Verification
CI evidence must reference the FINAL PR HEAD, not the donor branches. Require full Node + poster ACL, booking E2E, outbox synthetic, Apps Script source, storefront browser visual and independent source/security review; separately provider and DB gates. A green CI or READY Preview is **not** provider delivery or authorization to deploy.

## Dependency order
Main → #852 GAS phone-only safety → combined candidate from #871/#873/#874 + #862 diagnostics → independent review → owner-authorized protected staging + LINE provider and DB evidence → controlled production and readback. #872 is an alternate competing outbox implementation; **do not deploy both**.

## Rollback
Before activating any new live owner decision, snapshot Booking/Owner Locks and private schema, maintain known-good Production SHA, pair deploy GAS+Vercel flags. On failure, first stop `KK_LINE_BOOKING_AUTOMATION_ENABLED`; never revert old outbox-confirmed Booking to legacy automatic re-push. Manual reconciliation for UNCERTAIN/CLAIMED. Remove public source clean-footer feature only as permitted by valid user-specific evidence on rollback.

## Current evidence snapshot
Production Vercel `READY`, deployment `dpl_2CyyhK7vyUm2cUMeiDzEgBdSBN2n`, `main` SHA `735bbf7c159df7f2fd6b93e5324df131727f91c9` (still older code); last Runtime Errors 24h grouping contains `[line-webhook] LINE booking reply failed`, last at 2026-11-12T00:18:10Z. No provider HTTP status known. Current production lacks owner and customer-login/outbox env names (read-only key inventory).

Cross-chat sources: #861, #855, #871, #873, #874, #852, #862, #872. **Do not close #861 until real customer and owner receipt verified in Production.**

## 2026-11-12 — Blank nickname fail-closed correction (follow-up)

### Owner evidence and reason
The owner's screenshot of the `NAMTAN FILM GLAMOROUS FANCON` 13 Nov draft shows a **blank nickname** while both legal lines are still present on legacy Production. Prior integrated candidate `#875` already rejected a missing nickname **when** owner automation was enabled, but the default `REPLY_ONLY` path could emit the generic `ร้านได้รับคำขอเช่าแล้ว` Flex without any canonical Pending Booking. This could falsely reassure a customer while the owner card remained disabled. No user-supplied screenshot is a booking receipt and no user-specific booking state was inferred or changed.

### Minimal source fix in #875 (not a parallel system)
- In `server/line-booking-webhook.js`, after the canonical event/package admission check, reject **missing nickname for a bookable event even if `KK_LINE_BOOKING_AUTOMATION_ENABLED` is OFF**. Send one safe `text` correction via the existing LINE Reply API; return `CUSTOMER_DETAILS_REQUIRED`, `booking_id:''`. Keep legacy sender-identity requirement scoped to owner-automation-enabled mode. Preserve canonical hidden/full fail-closed behavior and no provider/send retry.
- In existing `tests/line-webhook.test.js`, add a synthetic OFF-mode test: expect one correction, no `ร้านได้รับคำขอเช่าแล้ว`, no Terms/Privacy footer, no Apps Script/consent DB/Owner Push, and no Booking ID. No new workflow, endpoint, database, or customer data.
- This fix addresses **misleading acknowledgement only**; it is not a claim that actual customer Reply API delivery or owner-card automation is fixed in Production. The known provider error status remains unknown until the governed diagnostic source is deployed, and owner/identity/outbox settings are still absent in Production.

### Release/retention safety
- The rest of unified #875 remains unchanged: no duplicate Booking, no inventory/Owner Lock modifications, no real provider traffic, no Supabase schema change, no GAS runtime, no production deploy or flags.
- Reconfirm **exact new HEAD** and 8 targeted/full workflows before accepting any technical success; independent review, same LINE Provider and customer Login setup, privacy/retention approval and private Supabase migration, owner identity, GAS deployed source/11-column owner outbox and dispatch secret, actual provider E2E and visual owner acceptance remain mandatory.
- Parent incident: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/861 ; coordinated candidate: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/875. Keep #861 OPEN until customer+owner receipts and canonical Booking decisions are verified in actual Production.
