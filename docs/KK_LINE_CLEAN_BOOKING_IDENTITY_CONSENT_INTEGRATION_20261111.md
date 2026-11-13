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

## 2026-11-12 ICT — signed webhook ↔ durable acceptance integration (new code)
**Supersedes previous note that authenticated identity receipt lookup was not implemented.** The source integration now exists in this PR; **this does not assert Production activation**.

### Flow, exact authority, zero customer text boilerplate
1. New website user explicitly checks the current Terms after LINE Login via `/api/kk-customer-auth?action=accept`; the backend requires a verified same-Provider LINE OAuth identity, server-held CSRF and a durable Supabase write/readback. Returning same user and Terms version can reuse that *server* receipt. No LINE text is sent merely by checking.
2. Clean storefront booking/waitlist draft from PR #868 ends with nickname and phone; neither Terms nor Privacy attestation line is appended.
3. On inbound LINE booking, `server/line-booking-webhook.js` first verifies the raw `x-line-signature` HMAC, then passes a handler-owned `signatureVerified:true` to `processEvent` (never client-supplied). Only if Owner Approval and canonical booking admission are ready does the verified identity lookup occur; no extra DB request on ordinary reply-only mode.
4. `server/kk-line-booking-terms-receipt.js` validates the exact Messaging API `event.source.userId` and same configured LINE Provider, requires verified migration/feature flags, and reads only `kk_customer_terms_lookup_for_line_webhook` over a server-only Supabase service key. Timeout is bounded to 1.2 seconds to reduce single-use LINE reply-token risk. On unsigned events, malformed identity, no receipt, wrong Provider/User/Terms, expired/invalid timestamp, revoked evidence, or upstream failure, it returns a **redacted fail-closed** status. No user ID or provider error is logged.
5. The pure `decideSignedWebhookAcceptance` in `server/kk-customer-accept-once-policy.js` validates version, source, verified flag, issued timestamp, opaque evidence reference, same provider and sender. It does *not* fabricate an OAuth session for a signed webhook.
6. In feature-ON mode, **never create Pending, send owner Confirm/Reject card or write `TERMS_ACK`** without a verified durable receipt. Failed or absent evidence returns `TERMS_EVIDENCE_REQUIRED`; the existing safe customer acknowledgement is preserved without claiming a confirmed Booking. Even the legacy two LINE legal text lines are not a bypass when identity mode is ON.
7. With a verified receipt, the existing governed Apps Script pending writer remains untouched. `server/line-booking-intake.js` writes an explicit `TERMS_ACK_BACKEND:<current version>` in the existing Booking note, different from legacy `TERMS_ACK:<version>` (direct LINE message); owner Flex card explicitly says verified LINE identity from backend, with no actual User ID displayed.
8. Feature-OFF / legacy owner approval path remains unchanged; the existing direct LINE warning is preserved. The automated card flow still requires independent verification of booking writer, customer reply, delivery and stock/locks under #861.

### Changed paths since first source checkpoint
- `server/kk-customer-accept-once-policy.js`: signed sender pure receipt decision
- `server/kk-customer-auth-store.js`: service-role RPC + configurable timeout
- `supabase/kk_customer_auth_v1.sql`: bounded, SECURITY INVOKER, server role ONLY `kk_customer_terms_lookup_for_line_webhook` (source-only)
- `server/kk-line-booking-terms-receipt.js`: identity/flag gate and fail-closed lookup
- `server/line-booking-webhook.js`: signed handler handoff, receipt required before Pending (identity mode ON)
- `server/line-booking-owner-approval.js`: distinct legacy vs authenticated Terms label
- `server/line-booking-intake.js`: distinct source marker written to pending Booking notes
- `server/kk-booking-terms-evidence.js`: clarify legacy source meaning
- `tests/line-webhook.test.js`: 6 injected-provider regression tests for valid, absent, mismatched, legacy bypass, unsigned and unavailable cases
- `tests/kk-customer-line-auth.test.js`: private service-role RPC existence/grant/revoke invariant

### Test and release boundaries
- Initial Booking E2E test run #43074098037 failed on (a) a stale variable in the owner card color, fixed, and (b) an incomplete synthetic customer name, fixed. These were genuine CI catches; **do not cite the initial run as acceptance**.
- Following run #43074394598 **passed** the targeted E2E test suite, but the separate full regression #43074394566 caught a changed legacy owner warning, fixed without weakening its test.
- The test addition was corrected for malformed escaping in the SQL security assertion. **Re-verify exact HEAD after this documentation commit before claiming all CI green.**
- No migration was applied; the Supabase project/role/retention approvals, LINE Login and Messaging API same-Provider external proof, customer signed identity UAT, independent reviewer, protected exact-SHA Preview, and Production source/Booking readback are STILL MISSING. Full end-to-end provider acceptance (including no duplicate bookings or owner pushes) remains blocked. Incident #861 and #855 are OPEN. Do not Merge, Deploy or enable production features based solely on mocked CI.
- Canary rollback: both `KK_CUSTOMER_LOGIN_ENABLED` and public `KK_CONFIG.customerLoginEnabled` must default OFF until simultaneous approved release; no automated Pending on missing receipt when ON. Preserve existing bookings, stock and Owner Locks, do not replay LINE Reply Tokens.

### Future release checks, in order
1. Independent reviewer/security/DBA signs current exact PR SHA, provider ownership verified, user identity consistency approved.
2. Approve target Supabase project; check no name/privilege conflict; test schema as service_role, deny anon/authenticated, retention/erasure policy, rollback and exact evidence readback. Migration via governed write path, not blind application.
3. Bind owner-only secrets/config and **both** public/server feature flags behind explicit cutover. Avoid public LINE User IDs or secret values.
4. Protected Preview LINE Login & first visit/return acceptance; actual signed LINE inbound association and readback of the current version; reject cross-Provider/old/unsigned; verify a single Pending row, one owner card, exact decision and notification receipts.
5. Fix independent P0 LINE Reply API provider failure (Issue #861 and PR #862) before enabling live sends; confirm no duplicate stock holds or Owner Lock violations.
6. Owner exact-head go/no-go, merge/deploy/Production alias and Booking readback, monitored rollback. No other runner shall concurrently release overlapping donor #856/#868.

## 2026-11-12 ICT — Booking template incomplete-field preflight (follow-on)
The owner-provided storefront template intentionally leaves **nickname** and **pickup time** blank for customers to complete. The governed Apps Script pending writer requires `customer_name`/nickname but allows a missing phone, and previously an otherwise valid LINE booking with blank nickname would trigger `CUSTOMER_FIELDS_REQUIRED` and a webhook 500 before the LINE reply. This is now prevented in **owner automation READY mode only**:
- `server/line-booking-webhook.js` validates the canonical event/stock first, then nickname and LINE sender ID **before** private Terms lookup, Apps Script pending write and owner notification; hidden/unverified events retain their existing fail-closed diagnostics.
- On missing nickname, one LINE text reply asks the customer to provide their nickname and resend. On missing LINE user ID, one text reply asks for a private chat with LINE OA. Neither reply appends Terms/Privacy boilerplate, creates Pending, reserves stock, changes owner locks, nor suggests a confirmed booking.
- When owner automation is OFF, preserve the existing ordinary reply-only behavior unchanged.
- Two new injected-fetch tests in `tests/line-webhook.test.js` prove exactly one mocked LINE reply, the necessary canonical public reads, and **zero** private DB/Apps Script/owner calls on either incomplete-input path.

**Snapshot:** All changes remain review-only; the source integration was not merged or activated. Earlier test and Preview receipts apply only to the exact SHAs recorded with them; do not infer an up-to-date run before this amendment. Keep #855/#861 open, and respect Owner Locks/Booking reconciliation and the release gates above.


## 2026-11-12 03:02 ICT — owner screenshot correlated to Production P0 provider error
- Owner supplied a LINE chat screenshot: a newly sent request for NAMTAN FILM GLAMOROUS FANCON, 2026-11-13, still includes the two automatic Terms/Privacy lines in the sent text. The screenshot was inspected **in the conversation only**, not uploaded to GitHub or stored with customer identifiers.
- **Verified Production** deploy `dpl_2CyyhK7vyUm2cUMeiDzEgBdSBN2n`, SHA `735bbf7c159df7f2fd6b93e5324df131727f91c9` (READY), still has both lines in `script.js::buildBookingMsg/buildWaitlistMsg`.
- **Exact Vercel correlation:** `2026-11-11T20:02:25.592Z` = **2026-11-12 03:02:25 ICT**, request `9bxjs-1794427343517-e4275104e518`, POST `/api/line-webhook`, error `[line-webhook] LINE booking reply failed` on that unchanged deployment. This proves provider reply failure was observed concurrently with the screenshot, not its HTTP status or root cause. Error group last=2026-11-11T20:02:23Z. We cannot claim LINE replied successfully or owner received a card.
- The submitted booking text has **blank nickname**. The candidate's preflight now returns a specific customer prompt on this incomplete field rather than writing a Pending Booking or sending a misleading owner card; this behavior only becomes live after governed release. Preserve pre-existing 13 Nov Booking; do not blindly replay LINE webhook or create duplicates.
- **Read-only Production env key inventory:** `KK_LINE_BOOKING_AUTOMATION_ENABLED`, `KK_OWNER_LINE_USER_ID`, `KK_OWNER_LINE_TARGET_ID`, `KK_CUSTOMER_LOGIN_ENABLED`, LINE Login channel and Supabase consent env keys are **absent**; Messaging API credentials and Apps Script URL/API key key names exist, but their values/authority were not decrypted/verified. Thus owner-card activation and user-bound consent are blocked on Production, irrespective of source CI.
- Source CI on earlier exact integrated SHA `98a91f1f291284589cf8b0de0a1fd230484340e7`: Booking E2E, Storefront Visual QA, canonical owner v2, deployment source contract, ultra-deep and zero-cost workflows all SUCCESS. No independent GitHub PR review (0). Preview deployment had only older source SHAs; do not imply current HEAD Preview is ready.
- Follow-on **one minimal webhook hardening delta** copied from previously tested diagnostics-only #862 into integrated #871: privacy-safe `safeLineReplyDiagnostic` categorizes LINE Reply HTTP 400, 401/403, 429, 5xx and network failures without exposing provider response body, secrets, customer text or user IDs; it also shares the **per-event** public `08_Web_Ready` fetch across poster/package resolvers to avoid duplicate upstream calls. No cross-event booking cache. Four donor redaction/status tests were appended in the existing `tests/line-webhook.test.js` and one WebReady read assertion added. Existing standalone #862 must not be merged independently without conflict reconciliation.
- Do not say the actual HTTP status is known. The only observed live error string remains `LINE booking reply failed`. The diagnostic source change will have effect **only on a governed deployed release and a future legitimate event**. It does not replay a spent reply token.
- Re-run **exact CURRENT HEAD** CI after this documentation mutation; earlier successful runs belong to older SHAs. Preserve no-merge/no-deploy/no-flag-flip until independent review, identity/provider/DB authority, Apps Script owner recipient, true end-to-end provider acceptance and owner release gate are satisfied.
