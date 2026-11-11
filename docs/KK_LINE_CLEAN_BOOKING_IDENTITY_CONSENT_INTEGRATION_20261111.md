# KK Phone Rental — remove LINE legal boilerplate, stage identity-bound consent
Date: 2026-11-11 (Asia/Bangkok) | Incident: #861 | Existing source branches: #868 (UX) and #856 (auth).

## Owner requirement
Remove both trailing Lines from the customer LINE prefilled booking and waitlist messages:
- `✅ ยืนยันยอมรับเงื่อนไขการเช่า KK Phone Rental (KK-TERMS-2026-11-06)`
- `ℹ️ รับทราบนโยบายความเป็นส่วนตัว: https://kk-phone-rental.vercel.app/privacy/`
Record that **the verified LINE user** affirmatively accepted the current Terms **before booking** in a private backend, instead of echoing legal boilerplate to LINE chat.

## Coherent staged source (NOT live)
1. Start from existing Draft #868 exact source `916ba3bca0d34f37cfc00a1e3eb0ee18b1095aa8`. Its current `script.js` has the clean message builder (event, date, venue, model, price, pickup, nickname, phone) with **no legal lines**. Preserve the first-website-entry Terms checkbox and separate LINE booking action.
2. Reuse the 10 **exact source files** from Draft #856 `6ef986b62ceb42a9bc9d1385e94f47179c37bd25` for LINE OAuth, server-only private versioned consent evidence, RPC SQL, security tests, runbooks. They were staged as source only; SQL was **not executed**.
3. Integrate `assets/kk-booking-agreement.js` with the authenticated server `/api/kk-customer-auth` session/accept endpoints **only when** `window.KK_CONFIG.customerLoginEnabled === true`. Feature flag **absent/OFF** by default; the existing first-entry browser-only UX is unchanged on a disabled installation.
4. When enabled, **never** let localStorage or the functional first-party cookie stand in for user identity. Fetch server-authenticated session on entry; a returning user with a validated same-version DB receipt can continue immediately. An authenticated user without receipt must tick and explicitly POST acceptance; only a verified `ACCEPTED` response and exact version permits continuing. A guest is sent to a LINE Login OAuth initiation after clicking an explicit LINE linking CTA; after returning they must affirmatively tick and POST (no autoaccept from pre-login click). Unavailable store/login blocks verified mode, shows retry and never fabricates consent. No LINE booking automatically sent by consenting.
5. Cache-bust just the changed agreement JS asset. New synthetic in-process browser tests for returning accepted identity, first persisted acceptance, guest login, DB outage, rejected accept, and stale local-cookie bypass; legacy disabled-mode tests must remain green.

## Security invariants
- Only a LINE identity verified by LINE OAuth with correct same Provider may be associated with consent; **DO NOT infer it from browser cookie, user-typed phone, nickname or unsent LINE draft**.
- Session is HttpOnly Secure SameSite=Lax, revocable, with server-only service credential and protected RPCs. Exact Terms version, accepted timestamp, verified evidence source/reference are retained server-side. No ID/token/phone in public JS, cookie value, GitHub, or logs.
- The frontend CSRF token is issued by the authenticated server session; the acceptance POST checks Origin and exact version. Server readback is required.
- Existing LINE owner approval and canonical Booking writer must not change until incident #861 is repaired. **Important outstanding integration**: the current webhook's `TERMS_ACK` note depends on literal LINE attestation lines; clean messages will be `TERMS_NOT_CONFIRMED` in Booking until a separate, reviewed signed-LINE-user-ID-to-DB-acceptance lookup is wired. Do not silently mark it accepted. This staged source solves **durable server-side consent recording** for LINE-logged-in users; it is **not yet** a complete Booking/owner-consent readback.
- Do not run the proposed SQL blind. Verify owner-selected Supabase project, schema/grants/RLS, migration rollback, acceptance retention/erasure before write.
- Avoid increasing checkout friction by surprise: the enabled mode visibly explains the one-time LINE Login and second deliberate confirmation. Owner UX acceptance pending.

## Release gates
1. Full source/Node regression and actual browser/visual QA across 320, 375, 390, 430, 480, 768, 1024, 1440 px; registered `storefront_ux_review` / `storefront_visual_qa`. Technical CI is not human acceptance.
2. Independent security/privacy review of both donor lineages and integrated diff; evaluate exact deployed source SHA.
3. Confirm LINE Login channel and Messaging API belong to **the same LINE Provider**. Configure callback and credentials through the protected owner console, never in repo.
4. Review + migrate private Supabase schema with negative anon/authenticated tests, exact accepted-row readback and retention deletion policy. Customer Login env stays **OFF** until all gates proven.
5. Reconcile existing signed inbound LINE booking and canonical Booking state; implement reviewed identity-to-evidence reconciliation (and durable delivery) before owner automatic cards are enabled.
6. Coordinated exact-SHA release: set server `KK_CUSTOMER_LOGIN_ENABLED=true` and public `customerLoginEnabled:true` together only after verification. Confirm session, accept, return, LINE message contents, provider reply and no duplicate Booking; retain rollback.
7. Until these gates pass, **do not Merge, Deploy, activate LINE Login/Booking, write SQL, create Booking, send messages, or claim user-specific consent is live**.

## Existing work / conflict management
- #868: first-visit Terms and clean LINE message.
- #856: standalone authenticated backend preparatory code (feature OFF).
- #862: sanitized LINE provider diagnostics pending review.
- #870: synthetic owner Confirm/Reject full path.
- #861: actual failed customer reply; do not replay or duplicate live requests.
This integrated branch is a **review candidate** that unifies #868 and #856 for one release; it should not be merged concurrently with those donor branches without a fresh three-way conflict review.

## Rollback
Leave both feature flags OFF or roll back integrated release to verified pre-merge Production SHA. No independent webhook/Bookings/price/stock/Owner Lock changes are included; any reviewed DB migration needs a separately planned privacy-safe rollback.

## Integrated source acceptance checkpoint — 2026-11-11 ICT (exact head before docs receipt)
- Source commit tested and Previewed: `4bbbb8e102c2af92544d8d3c2f7e389ff2671c33`.
- GitHub Actions Storefront Automated Visual QA run [#43056127274](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/43056127274): both jobs **COMPLETED SUCCESS**. Full Node **2650/2650 PASS**, poster ACL **29/29 PASS**, routed code-context test 111/111. Newly added identity backend UI synthetic cases executed and passed. User-facing technical browser screenshot/interactions reported `technical_visual_pass:true`, `interaction_pass:true`, no runtime page errors. **Human screenshot review remains BLOCKED, `owner_visual_acceptance:BLOCKED`, `release_ready:false`.** Do not call it visually accepted.
- Additional exact-source workflows **COMPLETED SUCCESS**: Canonical owner v2 source and native regression #43056127290, Vercel Deployment Source Contract #43056127240, OpenAI Optional Zero-Cost Acceptance #43056127706, Ultra Deep V2 Acceptance #43056127460.
- The first CI attempt failed due to a wrongly escaped test-only regular expression; it was corrected. The second attempt surfaced a genuine **Vercel Hobby API-function budget** violation (`13 > 12` JS files under api). No gate was weakened. Repaired by moving the existing pure `api/lib/crm-freshness.js` to `server/crm-freshness.js` without changing module logic and adjusting the 2 production API imports, its test import and package syntax check. Full suite and function budget now PASS.
- Protected Vercel Preview `dpl_EX3o7my9fhjhctvTNVxqPK4kPTgp` **READY**, `target=null` (Preview), exact SHA `4bbbb8e102c2af92544d8d3c2f7e389ff2671c33`, URL https://kk-phone-rental-vercel-16c5x1r12-mikesd1995s-projects.vercel.app. Preview READY is not proof of live LINE Login or SQL.
- **No** migration applied, env flags toggled, LINE Login channel created, live LINE OAuth, real consent records, Booking, customer messages, Merge or Production deploy. Provider/DB and regulated privacy gates remain as described above.
- Official LINE same-provider identity policy: https://developers.line.biz/en/tips/2026/06/25/provider-design-basics/ ; Supabase service-role server-only principle: https://supabase.com/docs/guides/database/postgres/row-level-security
