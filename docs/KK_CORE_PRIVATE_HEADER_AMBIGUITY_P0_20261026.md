# KK Phone Rental — P0 Private Core header ambiguity guard — 26 Oct 2026

**Status: DRAFT SOURCE ONLY / SECURITY P0 HOLD.** This is the continuation of the owner's Stable Business V1 requirements; keep costs at zero, do not merge/deploy/revoke Core ACL before exact-head native CI and owner-reviewed live private-read/booking/LINE acceptance.

## Verified canonical inputs (owner-connected, read-only)
- Core workbook has **13/13 exact required source tabs** for `AdminFallback.SPECS` (11) and the two preflight extras, with **13/13 required-first-row headers** present; checked 13 direct header ranges A4 or A1, no Booking/customer data rows accessed. All **13/13 header rows have unique nonblank column names** and none contains the dangerous object property names below. The `_Rental_Dashboard_Data` required heading is literally `Booking ID`, not `booking_id`; archive header is present.
- Current Google Drive Core file metadata: **type=anyone / role=reader**, `allowFileDiscovery=false`. Not evidence of exfiltration; customer-data exposure remains P0 until approved zero-downtime reader cutover.
- Vercel project environment names-only metadata: **23 entries**; **none** of `KK_CORE_PRIVATE_READ_KEY`, `KK_CORE_PRIVATE_TRANSPORT`, `KK_CORE_SHEET_REQUIRE_PRIVATE` is present. Values were never decrypted or logged. Therefore the owner's chosen Apps Script private transport cannot be declared ready.
- Live Vercel alias `kk-phone-rental.vercel.app` still points to READY main SHA `64cec7bfa75e8c1f5cfe56570ee701f27bf540fe`, not Draft #739.

## Actual source defect and narrow fix
A previous first-row-only private schema check used `.some(requiredHeader)`, which could admit **two matching `booking_id` columns** or any duplicated header names. Downstream `valuesAsObjects()` loops through columns and assigns by header key, so a later duplicate silently overwrites an earlier booking/customer field. Likewise `__proto__`, `constructor`, `prototype` must not be accepted as keys for a plain JavaScript object. An archive (no single required header) containing only `[[]]` was incorrectly treated as present by the readiness probe. This is a fail-closed data integrity and security hardening; actual current headers were verified clean, so it is not evidence that a live exploit occurred.

Updated only the existing Draft PR #739 branch `fix/core-sheets-privacy-private-read-gates-20261014`, **not main**:
1. [b3c7bf2](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/b3c7bf2038a84eb068524f070f2a9d6db915500b) — `scripts/core-private-cutover-preflight.cjs`: require nonempty first-row names, **zero duplicates** after trimming, no object-prototype property names, exactly present required heading. Continue emitting only opaque dataset status, never values or upstream error text. A valid sparse header and ordinary optional empty cells stay accepted.
2. [84a1c25](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/84a1c250814f536847488aade1b418755ca5abf6) — `server/admin-sheet-fallback.js`: apply the same strict header check **only** when `KK_CORE_SHEET_REQUIRE_PRIVATE=1` and fail with generic `CORE_PRIVATE_SCHEMA_INVALID`. Preserve old flexible parsing in non-strict mode; do **not** silently change Production fallback or disclose any booking field in errors.
3. [1bb13c7](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/1bb13c7c7117edc4ae56d572416280e9f873f134) — preflight regression: duplicate required/other columns, trimmed duplicates, `__proto__`/`constructor`/`prototype`, blank/duplicated archive header, 13-dataset synthetic probe rejects exactly Booking and Archive with no PII in diagnostics.
4. [2613581](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/2613581eaaf3f57bf10c1f70522f18cf6f2b2cc6) — Admin regression: duplicate Booking/customer columns and prototype keys fail closed before public fallback, for all five synthetic malformed cases.

**Readback SHA (GitHub exact blobs):**
- `scripts/core-private-cutover-preflight.cjs`: `1827313939abf2bc1df249cbd9ea3e410c068e70`
- `server/admin-sheet-fallback.js`: `80f0b3854d6573c987e70d3467bf6fee270cdd19`
- `tests/core-private-cutover-preflight.test.js`: `8a823e3ac9c2d8c388cbb64caf36c0f3ab9edbcd`
- `tests/admin-sheet-fallback-private-reader.test.js`: `e9739a7ba2875717f68883d84e8130a48899d450`

## Validation and explicit limits
- **PASS (limited isolated V8) 40/40, 0 failures**: full GitHub-fetched JavaScript source syntax compilation for all 4 files, `hasHeader()` 13 negative/positive combinations, strict Admin header validator cases, safe generic `readSpecPrivate()` rejection with **no fallback calls** and legitimate Booking row 5 parsing, all 13 synthetic specification shapes. These are mock/in-process tests against source extracted from exact GitHub blobs.
- **NOT RUN / NOT CERTIFIED**: actual native Node `node --test` against a complete exact-head checkout; full `npm test`; GitHub-hosted CI; real owner Apps Script deployment; live 13/13 authenticated private range reads; public anonymous denial checks; Owner Admin/Booking/LINE/browser/Revenue E2E; permission role revocation/rollback.
- Fresh GitHub commit checks at `2613581...`: **0 associated pull-request workflow runs** and **0 combined statuses** returned. This is **not** CI PASS. PR #739 remains Draft/mergeable=false; comparison with fresh main `64cec7b...` reports **125 commits ahead / 38 behind and 39 changed files**. Do not blind merge/cherry-pick; parallel UX, booking, finance and privacy paths need exact-head conflict review and tests.
- No production or provider writes: **Google Sheets 0**, **Google Drive permissions 0**, **Vercel env/deployment 0**, **Apps Script production 0**, **Booking/LINE/Make 0**, **GitHub merge 0**, and **no paid CI/rerun**. The 4 Draft source/test commits plus this documentation are the only intended writes.

## Next mandatory gates — preserve availability and customer privacy
1. Owner installs/updates an authorized private bound Apps Script reader revision using a rollback-ready route and securely provisions **a distinct locally generated read key** outside GitHub or chat. Admin mutation key must not authorize private reads and reader key must not authorize writes. No excluded Google Service Account provisioning.
2. With flags still OFF, independently authenticate the new route for 13/13 actual allowed datasets; validate **full header uniqueness** and API response bounds, read-key negative tests, user permissions, no credentials or PII in HTTP public interfaces/logs, and identical derived Web Ready and Packages output.
3. Run genuine zero-extra-cost exact-head native Node suites (minimum: `tests/core-private-cutover-preflight.test.js`, `tests/admin-sheet-fallback-private-reader.test.js`, `tests/core-apps-script-private-reader.test.js`, `tests/core-read-only-key-isolation.test.js`, `tests/core-sheet-privacy-cutover.test.js`) plus CI and public/mobile TH+EN/dark+light, Admin, Booking, LINE, Revenue and rollback E2E.
4. Only with owner approval, enable strict private reading on authorized Production and verify readback first. **Then** revoke the old Core `anyone/reader` role; verify anonymous direct Sheets/GViz access denied and front/back-office still works. Never revoke first.
5. Independent poster ACL scope is handled in [PR #721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721); the 26 Oct poster evidence is in [KK_SECURITY_P0_ACL_DUAL_SOURCE_READBACK_20261026_R2.md](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/security/drive-public-acl-owner-review-20261013/docs/KK_SECURITY_P0_ACL_DUAL_SOURCE_READBACK_20261026_R2.md). Poster permission repairs cannot substitute for private Core data protection.

Related: [Core P0 #738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738), [Stable V1 gate #49](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/49), [Draft PR #739](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/739).

**Result: source integrity hardened and current headers verified; Security P0 remains OPEN, live private cutover NOT DONE.**

---

## R3 — Opaque transport diagnostics and private preflight fail-closed — 26 Oct 2026 (ICT)

**User authorization/scope:** continue source-only no-cost P0 hardening, thoroughly record evidence across chats. **No Production, Google ACL, Apps Script, Vercel env, Booking, pricing, inventory or customer writes. No merge/deploy.** Owner previously chose the free Apps Script transport and excluded new Google Service Account provisioning. Preserve old public read until a separately configured validated private route is ready.

### Newly discovered source-level privacy defect

In `server/core-sheet-private-reader.js`, `state(env)` previously set `transport=String(env.KK_CORE_PRIVATE_TRANSPORT || 'none').trim()` and returned it. The owner-only `scripts/core-private-cutover-preflight.cjs` emitted `source.transport` unchanged to JSON stdout. If a secret/token/customer contact were mistakenly pasted as `KK_CORE_PRIVATE_TRANSPORT`, **Preflight would echo that raw value** in diagnostic logs even though it was not a recognized transport. The prior strict guard did fail to authenticate, but output confidentiality was not protected. This is a tested source flaw and credible accidental disclosure risk, not proof of actual secret exposure.

### Exact Draft-only fixes already committed and read back

1. [626b4728](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/626b4728c65c9e0a3db5335ff8e0fc562edf0893) — `server/core-sheet-private-reader.js`: allow only canonical `none`, `apps-script`, `service-account`; map every unsupported raw value to constant `invalid` without echoing it. A strict read rejects `invalid` with opaque code `CORE_PRIVATE_TRANSPORT_INVALID`. All supported modes retain behavior.
2. [a163f6b4](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/a163f6b4434cc5b6b6b256442399a24fbada4673) — `scripts/core-private-cutover-preflight.cjs`: adds `CORE_PRIVATE_TRANSPORT_INVALID` to the explicit diagnostic allowlist; any error-code suffix or untrusted prefixed secret still reduces to `CORE_PRIVATE_PROBE_FAILED`.
3. [8e6eb2e8](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/8e6eb2e870c3a5eced5abd34cfaaf958d2abb06e) — strict Core cutover test asserts malformed/secret-like transport does not leak, cannot read, does not infer service-account, and still accepts exactly the three known mode names.
4. [c34321a1](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/c34321a13be3d832466e65a15e419ac8fb297ec6) — preflight test exercises `plan` and `probe` without network, forbids raw credential echoes, ensures no dataset read on malformed transport and safe classified code.

After writing, re-fetched exact GitHub file blobs:
- `server/core-sheet-private-reader.js`: `516e2f7cfa283e5f3a5fb1cc42558a9485e3cdc1`
- `scripts/core-private-cutover-preflight.cjs`: `be34473829f11d480b943dd250cc6f591c5f27a2`
- `tests/core-sheet-privacy-cutover.test.js`: `362aaf0ccf01070bea357aa7d81285837a16b0c3`
- `tests/core-private-cutover-preflight.test.js`: `3cb72a75b6a6b27b24f4f3e1b3f5d5166886966d`

### Verification separated from acceptance

- **17/17 PASS (isolated synthetic V8 evaluation using exact GitHub source modules with stubbed private Sheets/Apps Script dependencies).** Includes full syntax compilation/readback for four files, seven malformed transport inputs (including long and secret-like strings), three supported transport modes, missing mode no-inference, safe diagnostic error classification, 0 calls on malformed mode, valid mocked 13-dataset probe, malformed Booking header blocks entire private probe. Data fixtures are synthetic.
- **NOT Native Node full repo suite**: no exact-head complete checked-out tree in the available container; GitHub clone DNS failed. Did not manufacture CI results, spend runner quota or deploy preview.
- Fresh GitHub PR latest source head `c34321a1...`: **zero associated Actions workflow runs, zero combined statuses**. PR remains **Draft / mergeable=false** and the checked divergence against main was **130 ahead / 38 behind**. A missing check is not PASS.
- Fresh read-only Core Google Drive metadata: `anyone:reader` persists. Vercel project environment (23 entries, names only, never decrypted) is missing `KK_CORE_PRIVATE_READ_KEY`, `KK_CORE_PRIVATE_TRANSPORT`, `KK_CORE_SHEET_REQUIRE_PRIVATE`. Main Production deployment `dpl_HJtYdCsornZ2jngQovaiNj9r7rbe` is READY SHA `64cec7bfa75e8c1f5cfe56570ee701f27bf540fe`, unchanged by this Draft work.
- Earlier direct owner-connected Core header-only audit: 13/13 required data sources had canonical/unique first-row headers. **This is not 13/13 real authenticated Apps Script reads.** No real Bookings/PII were fetched to perform the source tests.

### No-cost zero-downtime exit gates (NOT DONE)

1. Under owner-controlled secure channels, install/verify the private read action on protected Apps Script. Provision an **independent high-entropy read-only secret in owner-local environment** and corresponding protected Vercel environment; never reveal it in GitHub/chat/CI.
2. Verify real private route: exact 13/13 allowed ranges + schemas, negative auth/reader-key/admin-key isolation, no public fallback under strict mode, public projection contains only safe fields, Admin/Booking/LINE/Revenue/Inventory E2E, browser image/search and rollback rehearsal. Run exact-head native Node/CI on an approved no-cost runner.
3. Reconcile current main vs Draft #739 minimal commits and overlapping finance/booking/frontend source before release candidate; owner approval and Safety Gates first.
4. Only **after** strict private source is confirmed working in Production with rollback available, revoke Core workbook `anyone:reader`, then verify signed-out access denied and production operations remain intact. Do **not** revoke first.
5. Independently handle poster Drive `anyone:writer` via Draft #721 owner-reviewed current manifest/fingerprint and image QA. Poster metadata audit documents 37/37 current assets with broad writer permission; role changes still require separate authority.

**Actual writes this R3:** 4 source/test commits on existing Draft #739 and this GitHub handoff edit only. **Production/App Script/Drive ACL/booking/price/inventory/customer/automation/merge/deploy writes: 0.** **Security P0 HOLD; Stable Business V1 not yet accepted.**
