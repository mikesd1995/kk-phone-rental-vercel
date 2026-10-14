# KK Phone Rental — Security Tasks 2, 3, 6: 2026-10-14 Evidence / Hold Report

## Approved scope and non-negotiable guardrails
- **Task 2**: harden the existing owner-bound Apps Script private Core read path (no Google Service Account; prior owner choice removed that option).
- **Task 3**: repair CI source contract without paid/minute-consuming manual reruns, spending/billing changes or unsafe merging.
- **Task 6**: restrict public data/Browser/Apps Script error and log exposure.
- **Change surface**: `fix/core-sheets-privacy-private-read-gates-20261014` / Draft PR #739 only. NO merge, deployment, credential provisioning, Sheets/Booking/Price/ACL writes or new provider spending.

## Defects found and source changes performed
1. **Public feed projection/header drift / customer contact risk** — `api/kk-data.js`: HTTP `/api/kk-data` previously accepted derived feeds if a few required header names appeared. An unexpected/shifted source column could be returned to the public even when it contained an internal contact column. Added `PUBLIC_FEED_HEADERS`, `validatedPublicFeedRows` and fail-closed 502 when headers or row widths deviate; no original row data or sensitive column name is echoed. Canonical production schemas (read only): `08_Web_Ready` 11 columns; `09_Web_Packages` 14 columns, legitimate `A4:L`, `A4:M`, `A4:N` prefix ranges and historical `package_note` alias retained. Existing public text sanitization now redacts synthetic email/mobile markers in event notes or booking templates while leaving normal event/date/price copy. Schema is validated on HTTP response boundary to preserve smaller direct sanitizer test fixtures.
2. **Apps Script private reader failure disclosure** — `apps-script/Code.gs`: `privateCoreRead` errors now return a generic `PRIVATE_CORE_READ_UNAVAILABLE`, never an upstream error/stack/secret. New `kkRedactSecretText_` removes the configured Admin and dedicated reader secret values from serialized audit notes, errors and stacks; on inability to access secret properties it returns a generic string. Existing independent `KK_CORE_PRIVATE_READ_KEY` / `KK_ADMIN_API_KEY` dispatch remains intact, and `doGet` does not expose Sheet ID in staged source.
3. **Admin fallback cache cutover bleed** — `server/admin-sheet-fallback.js`: included explicit private transport identity and truncated SHA-256 of the reader-key identity in internal cache key. No raw credential is stored in cache key or returned in snapshot. New test verifies same key hits cache and rotated key causes independent 11-source read instead of stale reuse. Do not confuse cache isolation with verification of real owner Script deployment.
4. **Known CI source defect** — `.github/workflows/ultra-deep-v2-acceptance.yml`: old workflow executes `npm ci` with no `package-lock.json` or `npm-shrinkwrap.json`. Reused independently staged, source-reviewed zero-install exact-head fix from `fix/ci-v2-no-install-scoped-20261014`, including SHA-pinned checkout, read-only contents permission, `persist-credentials: false`, no package install, 10-minute cap, and cancellation of superseded jobs. Added `tests/ci-ultra-deep-v2-workflow-safety.test.js` as workflow guard. This addresses **source defect**, NOT the unrelated zero-step runner/job admission failure.

## Verification — exact GitHub branch bytes read back
| Suite | Isolated JS V8 mock cases | Result |
| --- | ---: | --- |
| `tests/public-data-proxy.test.js` | 16 | 16 PASS |
| Apps Script private/read-key/public `doGet` suites | 16 | 16 PASS |
| `tests/admin-sheet-fallback-private-reader.test.js` | 5 | 5 PASS |
| `tests/ci-ultra-deep-v2-workflow-safety.test.js` | 6 | 6 PASS |
| Core private source + 13-source preflight suites | 15 | 15 PASS |
| **Total isolated mocks** | **58** | **58 PASS / 0 FAIL** |

All 24 changed JavaScript/CJS/Apps Script/JSON sources syntax-parsed successfully from exact GitHub branch content at audit. **Qualifiers:** JS V8 mock execution is not the repo's Node `node --test`, Google Apps Script/Sheets authentication, Google Drive signed-out negative proof, browser test or production E2E. The owner key utility has separately documented earlier native Node 5/5 acceptance, but the complete suite is not hosted-CI certified. The connected provider has no installed Apps Script `PropertiesService` writer; a matching live dedicated key was not provisioned.

## Latest read-only live Production evidence
- Vercel READY Production stays on main `d6dc3bfe4cc0c4dd6fdfec407823752da0572464`, **not** Draft PR #739.
- Live `/api/kk-data?sheet=08_Web_Ready&range=A4:K` responds HTTP 200 with `X-KK-Sheet-Source: public-gviz-fallback`, `X-KK-Private-Reader-Strict: 0`. Current public production feed's 11 header names were checked without publishing any customer rows.
- Live `script.js` still embeds the Core document identifier (staged browser fix is not deployed).
- Core owner Drive ACL readback remains `anyone/reader` plus owner. The broad permission is CONFIRMED; successful third-party exfiltration was **not** established.
- Vercel Production env name/type metadata read with `decrypt:false`: `KK_ADMIN_SCRIPT_URL`, `KK_ADMIN_API_KEY`, `KK_ADMIN_PIN`, `GOOGLE_SHEET_ID`. **No** `KK_CORE_PRIVATE_READ_KEY`, `KK_CORE_PRIVATE_TRANSPORT`, `KK_CORE_SHEET_REQUIRE_PRIVATE` listed.
- Most recent checked exact-head PR #739 runs: Storefront Visual QA `38565679721`, Vercel Source Contract `38565677958`, Booking E2E `38565678029`, OpenAI Optional Zero Cost `38565678013`, Ultra Deep V2 `38565677940`: all report failure and affected jobs expose **no executed steps**. There was no verified hosted execution; do not assume tests failed or passed. No manual paid runner retries.

## Required follow-on acceptance, strictly ordered
1. On an authorized local Node runtime in free/included capacity, run:
   ```bash
   node --test tests/public-data-proxy.test.js tests/admin-sheet-fallback-private-reader.test.js tests/core-apps-script-private-reader.test.js tests/core-read-only-key-isolation.test.js tests/core-apps-script-public-get-privacy.test.js tests/core-sheet-privacy-cutover.test.js tests/core-private-cutover-preflight.test.js tests/ci-ultra-deep-v2-workflow-safety.test.js
   npm run check
   npm test
   ```
   Resolve any genuine failures, then obtain exact-SHA GitHub CI admission/runs when **free-minute status is confirmed**. Never raise billing caps.
2. Owner-controlled Script/secret prerequisite (separate prior task #1): install reviewed Apps Script revision with rollback, provision an independent CSPRNG reader key only in Script Properties and Vercel Sensitive Env; validate read key cannot mutate bookings and Admin key cannot read private Core; confirm no generated value enters GitHub/chat/logs. Keep strict flags OFF until accepted.
3. Run authenticated read-only 13-source preflight; test Core/CRM reconciliation, public safe projection, notes/PII negative probes, hidden booking-day rules, mobile browsing, LINE booking and Admin, Scanner, Revenue and Apps Script free quota/latency. Expect private outage to fail closed with **zero public GViz**.
4. **Only after explicit owner release approval** and verified production end-to-end private reads: merge/deploy exact accepted revision in available free quota, then revoke the *existing* `anyone/reader` Google Drive permission using an owner-capable permission delete/update operation, and prove anonymous Docs/GViz read denied without breaking rentals. Maintain tested rollback. Connected Drive `share_file` cannot remove that permission.

## Completion state
**Completed in source:** tasks 2,3,6 fixes with offline regression evidence and GitHub handoff.
**Not completed/blocked:** real Node full CI, hosted runner admission, Script deployment/key provisioning, mobile/real Google authorization/performance, customer-data privacy production confirmation, ACL revocation. **Security P0 #738 stays OPEN; PR #739 stays DRAFT / RELEASE HOLD.**
