# KK Phone Rental — LINE Login / Accept Once Stage 1 (2026-11-10)

**Status: DRAFT / SOURCE ONLY / NOT LIVE / RELEASE HOLD**  
Tracking: [issue #855](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/855).

## Problem and verified baseline
`assets/kk-booking-agreement.js` currently unchecks the Terms checkbox on every LINE booking/waitlist link click. This is frustrating for returning renters. Current real acknowledgement evidence is the customer-sent LINE message matched against `KK-TERMS-2026-11-06` after a signature-verified webhook, as documented in `docs/KK_LINE_TERMS_ACCEPTANCE_2026-11-06.md`. A clicked checkbox, a local flag, an opened LINE draft, or a signed-in LINE account alone is **not** evidence that a customer accepted Terms.

Same LINE User ID across LINE Login and LINE Messaging API is guaranteed **only under the same LINE Provider**. Check provider membership on the authorized LINE account before any identity migration or linking; do not create a duplicate provider.

Main observed during source review: `eec14200cb087173ca555fa0c21b99e54c1c3961`. Recheck exact main head and conflicts before any integration.

## This branch
- Adds **only** `server/kk-customer-accept-once-policy.js` (pure read-only decision helper) and `tests/kk-customer-accept-once-policy.test.js`.
- Ties a potential skip decision to the imported current Terms version, same LINE Provider and user ID, server-verified session marker, durable evidence source/reference, verified evidence status, and bounded acceptance timestamp.
- Different provider, old Terms, missing durable record, untrusted local checkbox, fabricated IDs or out-of-range timestamp all fail closed.
- Returns a minimal decision with no LINE identifier, name, phone, booking data, or credentials.
- **Nothing imports the helper in any running API or browser code.** No frontend changes, Auth API, callback, cookie, database migration, acceptance write, or new external service.

## Mandatory future integration — NOT implemented
1. Run `npm run code:context -- "LINE Login and Terms repeat acceptance UX"` before expanding code. This couldn't be executed in this isolated connector-only pass; full code intelligence and native regression remain OPEN.
2. Verify existing LINE Login channel belongs to the **same provider** as the existing LINE OA Messaging API channel. Confirm callback path/origin, quotas, Vercel function budget and credentials without copying secrets into GitHub.
3. Implement LINE Login v2.1 authorization code with cryptographically random state, nonce, PKCE S256, exact redirect allowlist, server-side token exchange and verified ID token claim; server-only signed HttpOnly Secure SameSite session with expiry and logout. Never accept browser-supplied `verified=true` or LINE ID.
4. Implement minimal private durable acceptance store with a server-only atomic write/read, source evidence reference and version; authentication of write intent, idempotency and retention/deletion policy. Only a verified server-side session and persisted verified record may feed this pure helper.
5. Make the current booking/waitlist flow optional-login at checkout; if accepted current Terms, avoid the repeat checkbox; if not, present and capture a new affirmative Terms action. Preserve original LINE draft/send and owner-confirmation semantics until exact end-to-end evidence is independently tested. Do not retroactively infer acceptance from old bookings.
6. Invoke registered `storefront_ux_review` **before** customer-facing implementation, then `storefront_visual_qa` for 320/375/390/430+ widths, desktop, keyboard/a11y and LINE internal browser. These invocations have **not** been performed.
7. Validate provider mismatch, no cookies, login cancellation, CSRF state/nonce replay, token/session expiry, database outage, duplicate webhook, Terms update, cross-device return, user privacy, existing Booking and Owner Locks, and single-writer conflict protection.
8. Independent review, exact PR HEAD native CI and regression, protected Preview readback, release authorization/rollback and owner exact-SHA approval before enabling anything.

## Safety / acceptance evidence
- **No LINE Login service now exists on this branch.** No customer can skip Terms using the new helper yet.
- No Production, Vercel, LINE, Google Sheets, Supabase, Booking, prices, inventory, owner-lock, Admin or public-page changes.
- GitHub connector stage/write readbacks only; no repository checkout and no native Node tests or registered UX agent invocation were available in this run.
- Existing owner security/release holds, including #489, remain in force.
- New code must not be treated as a certified security boundary until integrated with real server-verified identity and durable evidence, independently reviewed and run through CI.

## Official LINE references
- https://developers.line.biz/en/docs/line-login/integrate-line-login/
- https://developers.line.biz/en/docs/line-login/integrate-pkce/
- https://developers.line.biz/en/reference/line-login/
- https://developers.line.biz/en/docs/messaging-api/getting-user-ids/
