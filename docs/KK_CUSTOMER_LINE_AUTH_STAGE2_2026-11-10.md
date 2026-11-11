# KK Phone Rental — LINE Login & Accept Once / Stage 2 handoff (2026-11-10)

STATUS: DRAFT / SOURCE ONLY / FEATURE OFF / RELEASE HOLD. Read this checkpoint when continuing from another chat. Original source Main SHA inspected: eec14200cb087173ca555fa0c21b99e54c1c3961.

## Tracking
- Draft PR: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/856
- Issue: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/855
- Isolated branch: feat/line-accept-once-policy-prep-20261110
- Current Terms: KK-TERMS-2026-11-06 from server/kk-booking-terms-evidence.js
- Prior document: docs/KK_LINE_TERMS_ACCEPTANCE_2026-11-06.md
- No Merge, Deploy, LINE, Supabase, Google Sheets, Booking, pricing, inventory, Owner Lock, customer messaging, X or Production writes were performed.

## Owner's goal
Let returning LINE-identified renters skip the repeated Terms checkbox **only when** they previously made an affirmative, evidenced acceptance of the current version. Browsing stays guest-friendly; no marketing-data consent should be bundled. The original signed/sent LINE message remains the real evidence for the existing booking path, not the unsent draft or browser checkbox. No retroactive acceptance is inferred from old chats, bookings, display names or phones.

## New source files in Draft #856
- server/kk-customer-accept-once-policy.js: pure fail-closed decision verifying current Terms version, same LINE Provider/user, genuine session marker, persisted evidence, timestamp.
- server/kk-customer-line-oauth.js: state, nonce, PKCE S256, encrypted short-lived OAuth-flow cookie, code exchange, LINE ID token verification via official endpoint and issuer/audience/expiry/nonce/sub checks.
- server/kk-customer-auth-store.js: server-only PostgREST RPC adapter, exact RPC names and service-role bearer; no public keys.
- api/kk-customer-auth.js: default-OFF action=start/callback/session/accept/logout, exact callback HTTPS host, 7-day opaque revocable session stored as a SHA256 token hash in database, Secure+HttpOnly+SameSite=Lax cookies, Origin/HMAC CSRF and explicit affirmative current-version POST for acceptance, no-store and sanitized errors.
- supabase/kk_customer_auth_v1.sql: proposed tables for sessions and unique versioned Terms evidence, RLS, least-privilege grants, default privilege revokes including sequence, SECURITY INVOKER RPCs and idempotent repeated acceptance. **Source-only SQL; not applied.** Turn into a reviewed versioned migration before authorized execution.
- tests/kk-customer-accept-once-policy.test.js: original eight scenarios.
- tests/kk-customer-line-auth.test.js: OAuth/PKCE/provider claims, PostgREST/SQL/CSRF cases with synthetic data.
- tests/kk-customer-auth-endpoint.test.js: synthetic end-to-end start, callback, login session, first-time acceptance, returning customer, CSRF rejection, logout, fail-closed.
- docs/KK_LINE_ACCEPT_ONCE_STAGE1_2026-11-10.md: prior stage summary.

No customer-facing index.html/script.js/stylesheet, webhook, Booking or legacy Terms modal was modified. No code is enabled on production; nothing can yet skip the customer's current checkbox.

## Read-only source and provider discovery
- GitHub Main was unchanged at the above SHA during this run. Existing Draft #851/#852 and the security/source-of-truth review tracks are separate; do not overlap their files or make unapproved owner/codex changes.
- Current API directory had 8 root JavaScript functions; this proposed new function would make 9; revalidate against Vercel limits before release.
- Official LINE docs confirm LINE Login and Messaging API share the same user ID ONLY if the channels belong to the same LINE Provider. The real channel/provider binding has **not** been verified. Do not create a new provider blindly.
- Supabase connected Primary account has ACTIVE_HEALTHY project mxjnjujqjybqughsnqbz named kk-unified-inbox (2026-11-10 read-only). Repo docs confirm this is canonical Inbox project. Another connected account has inactive projects and must not be chosen by guess. Public schema metadata returned 4 existing tables, not the proposed customer tables. The target project/migration has NOT been approved or modified. Never use the unrelated runtime ledger or Admin writer as a substitute.

## Server-only environment variables required before any enablement
KK_CUSTOMER_LOGIN_ENABLED=true (must stay OFF until approval);
KK_LINE_LOGIN_PROVIDER_VERIFIED=true (only after owner/Provider confirmation);
KK_CUSTOMER_AUTH_MIGRATION_VERIFIED=true (only after DB installation and privilege readback);
KK_LINE_LOGIN_CHANNEL_ID;
KK_LINE_LOGIN_CHANNEL_SECRET;
KK_LINE_LOGIN_PROVIDER_ID;
KK_LINE_LOGIN_CALLBACK_URL (registered exact https callback host + /api/kk-customer-auth?action=callback);
KK_CUSTOMER_AUTH_SESSION_SECRET (independent 32+ char secret);
KK_CUSTOMER_AUTH_SUPABASE_URL;
KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY.
Never copy real secret values to a public PR, client JavaScript or log. Separate Preview callback registration and verification are needed if Preview host differs.

## Actual validation completed
- GitHub connector exact-branch files/commit source readbacks on new paths.
- V8 JavaScript syntax compilation of OAuth, store, policy, API, and initial tests: PASS (not native Node).
- Pure original acceptance policy executed in isolated V8 with first-time/returning/cross-user/old-version cases: expected PASS/FAIL decisions.
- Supabase project metadata read-only, official LINE/OAuth/Supabase RLS documentation reviewed.
- No GitHub Actions exact-HEAD statuses or workflow runs observed at earlier check.
- Direct container git clone failed with DNS resolution error. Therefore native npm code:context, code:test, node --test, full npm test, UX Agent Gateway, independent review, Preview, SQL execution, live LINE OAuth, Supabase advisors/negative security checks and Production readback are NOT done. Never claim full completion.

## BLOCKERS / next exact actions
1. Run repository AGENTS gate: npm run code:context -- "LINE Login and Terms repeat acceptance UX"; then selected code:test and native/full tests, fail-closed fixes and independent reviewer.
2. Before editing website, invoke registered storefront_ux_review via Agent Gateway with real viewport/checkout evidence. Implement optional login UI preserving selected booking, show deliberate current Terms accept CTA only if no verified receipt, use session/accept/logout API. Run storefront_visual_qa and responsive/mobile accessibility. This gate is NOT bypassable by a source-only unit test.
3. Confirm actual LINE Provider, active Login channel and callback with authorized owner; same Provider as Messaging API is required for safe identity linking. Validate secrets and feature flags only in approved Vercel env. No secret is stored in repo.
4. Obtain approved target/schema and retention/erasure decision; independently review SQL RLS/privileges, test anon/authenticated denial and service-role scoped RPC; run DB security advisors; use governed migration with exact rollback/readback, not a blind write to active Inbox.
5. Test OAuth state/nonce/PKCE/code replay, token expiry/provider mismatch, session expiry/revoke, forged Origin/CSRF, duplicate accept, current Terms update, DB failures, rate limiting, new/returning device, LINE internal browser, guest flow and existing webhook/Booking/Owner Locks. Real LINE provider and protected Preview evidence required.
6. Preserve signed customer LINE-send and owner booking confirmation workflow until reviewed replacement evidence is operative; never auto-book or auto-accept from login or page view.
7. Only after exact HEAD CI, independent reviewer, registered UX/visual QA, protected Preview, owner exact-SHA approval and original #489 release gate, may authorized deploy occur. No spending/provider writes/Production changes are allowed merely from this source staging.

## Rollback
Keep KK_CUSTOMER_LOGIN_ENABLED false (default). On release incident, turn it OFF through owner-controlled environment change and verify legacy Terms popup + LINE send are unchanged. Do not erase historical Terms evidence, customer data or Booking rows as a blind rollback. Coordinate revocation and retention rules separately.

Official references:
https://developers.line.biz/en/docs/line-login/integrate-line-login/
https://developers.line.biz/en/docs/line-login/integrate-pkce/
https://developers.line.biz/en/docs/messaging-api/getting-user-ids/
https://supabase.com/docs/guides/api/securing-your-api


## Vercel configuration readback (read-only; 10 Nov 2026)
- Connected Vercel project: kk-phone-rental-vercel, ID prj_snbAmpya7YGmOuMbv1o8T16ouxl6.
- Environment KEY NAMES ONLY, not secret values: production currently has LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, KK_INBOX_SUPABASE_URL and KK_INBOX_SUPABASE_SERVICE_ROLE_KEY. No KK_LINE_LOGIN_* or KK_CUSTOMER_AUTH_* key was present in the 38-entry environment-variable inventory.
- This confirms existing Messaging API + Inbox bindings, **NOT a configured LINE Login channel**. Runtime flag stays OFF and calls to the new endpoint would return 404 until an independently approved release.
- Do NOT re-use LINE_CHANNEL_SECRET or the Messaging API access token as the LINE Login client secret. Provider/channel relationship remains an external owner-console validation.
- No environment variables were created, changed, decrypted or printed.
