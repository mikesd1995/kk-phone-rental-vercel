# KK Phone Rental — Stable Business V1 Closeout / Release Hold — 17 Oct 2026 (ICT)

## Scope, owner policies and verdict

The owner requested to **finish/close the KK Phone Rental project**, not to silently ship insecure changes. Stable Business V1 comprises: storefront, actual 2-device Booking/Stock, bound Apps Script, LINE/Inbox, canonical Revenue, Core Sheet and poster ACL privacy. Advanced AI Agent, Scanner/Verifier, Make activation, X autopublish, experimental pricing and new UX initiatives remain out of scope until separate acceptance. Zero additional expense. **NO MERGE / PRODUCTION DEPLOY / GOOGLE DRIVE ACL / BOOKING / CUSTOMER / PRICE / OWNER CREDENTIAL / LIVE AUTOMATION WRITES before verified safety gates and the necessary explicit approvals.**

**VERDICT AT THIS CHECKPOINT: NOT PRODUCTION-CLOSED. P0 OPEN / RELEASE HOLD.** Existing production is running; changing live ACL before authenticated private access would cause availability or booking outages. Do not conflate Draft source coverage, mock tests, or an HTTP 200 with a fully accepted secure business.

## Actual engineering execution this turn — PR #739

1. Added `.github/workflows/core-sheet-privacy-exact-head.yml`, a PR-only **standard ubuntu-latest Node 20** workflow. It checks out the exact `github.event.pull_request.head.sha` with `persist-credentials: false`, `contents:read`, an 8-minute timeout and cancellation of obsolete PR runs. It uses **no npm install/npm ci, provider API key, deployment, artifact upload, GitHub cache or paid larger runner**. It tests all 9 staged Core private/Public/Read-Key/Admin/Browser regression suites with Node's built-in test runner, and checks JS source syntax; `apps-script/Code.gs` is correctly checked through `node --check < apps-script/Code.gs` because Node does not natively accept the .gs extension in file-path syntax checking.
2. Added `tests/core-sheet-privacy-workflow-contract.test.js` 4 self-protection tests: PR-only exact checkout, zero-install/read-only/no-provider/budget guard, mandatory security test inventory, self-change trigger. Read back the exact GitHub blobs and ran an isolated JavaScript V8 source mock **4/4 PASS**. This is NOT hosted GitHub Actions or full Node project suite.
3. Reconciled `.github/workflows/ultra-deep-v2-acceptance.yml` to the **current Main blob** (`696c2c37053671f6e5cc090d644431aba7cd8a6a`) instead of the older PR version, retaining newer Main Detail / Identity / Recall checks while preserving exact-SHA, readonly, no-lockfile/no-install guards. No Main or Production writes.
4. Used GitHub compare API: PR #739 diverges from Main; it is about **80 commits ahead and 2 behind** at the checked snapshot. The two Main commits update numerous files. Actual overlapping changed paths include the Ultra Deep workflow (now reconciled to Main's content in PR) and `api/kk-intelligence-health.js`. Current Main has stricter nonnegative-integer validation for Apps Script trigger counts in Intelligence, while PR contains a different private-Core reconciliation patch: **safely reconcile and retest both semantics before Merge**. An attempted connector source update for this file was blocked by its safety gate, so **no successful health source edit** is claimed. Do not force merge or discard Main changes.
5. New exact-head workflow has **no confirmed GitHub Actions runs at the time of this readback**. Earlier HEAD run evidence has 3 PASS (Booking E2E, Vercel Source, Ultra Deep) and 2 FAIL (OpenAI layout 3 cases; Storefront visual/poster and owner screenshot acceptance). Earlier PASS **does not certify this new SHA**.

## Latest read-only live verification — do not publish customer rows

- Canonical Core Google Drive workbook ACL: **`anyone/reader` + owner**; this is a link-based customer-data exposure risk, not evidence that third parties actually stole data.
- Vercel Production uses separate latest READY main deployment (verified READY `44de0066f0c7edd59e153b2d31c22d65b84de5af` in this session), NOT PR #739.
- Live `https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK`: HTTP 200; `X-KK-Sheet-Source=public-gviz-fallback`, strict `0`, configured `0`. Public Master Booking table attempted through `/api/kk-data` responds HTTP 400 `Sheet/range not allowed`; the **underlying Core Drive file remains public**. Browser `script.js` live HTTP 200 still embeds canonical Core workbook ID.
- Vercel encrypted environment **key names only** (values NOT decrypted) include `KK_ADMIN_SCRIPT_URL`, `KK_ADMIN_API_KEY`, `GOOGLE_SHEET_ID`; **`KK_CORE_PRIVATE_READ_KEY` and Strict Mode/transport flags absent**.
- As of 15 Oct Issue #718 read-only re-audit, **35/35 active poster images and 4/4 image folders** had `anyone/writer`; original patch had 33-image pin/42 references versus latest 35 images/44 references. Re-verify exact current scope before permission changes, preserve signed-out poster availability.
- Issue #714 / Stable V1 report: 17 and 18 Oct each have two confirmed devices with **missing owner-verified pickup/return windows**. No invented contact, booking time, status or automatic schedule.
- Issue #49 and current Draft #744 contain parallel cleanup/Admin/Revenue work. Do not blindly merge 119-file #744 with this 30-path Security Draft. Pick **one** exact tested integration candidate after a reviewed conflict resolution.
- Do not infer Google Script Properties, a new reader key, live private 13/13 reads, deployed Apps Script version or owner permission from this GitHub/GDrive/Vercel metadata alone.

## Stable Business V1 strict completion gates (finish in this order)

| ID | Workstream | Current state | Necessary production acceptance |
| --- | --- | --- | --- |
| G1 | Booking/Stock Oct 17–18 | OPEN / cannot invent customer windows | Owner-confirmed actual handover/return times; both device allocations/available days validated, no ghost booking |
| G2 | Core Sheet privacy #738 / #739 | OPEN / high risk | Owner local independent read key in Script Properties + encrypted Vercel env, approved bound Script revision/rollback, strict 13/13 actual private read, key separation and no-GViz negative probes; only then authorized removal of current `anyone/reader`, verify anonymous 403 and app parity |
| G3 | Poster image & folder permissions #718 | OPEN / high risk | Current exact manifest/owner dry-run; scoped removal of `anyone/writer` with correct reader access, signed-out poster rendered, rollback |
| G4 | Apps Script version & triggers #9 | OPEN | Owner validates currently installed source vs repo, triggers, timezone and preserves existing client Booking/LINE workflows; governed deployment |
| G5 | LINE/Inbox #715/#742/#750 | OPEN | One signed owner approval, receipt and reply path, replay no duplicate sends, private images and media retention proof |
| G6 | Revenue #710/#737 and #744 | OPEN | Actual completed-only, Future allowed statuses, canonical quoted Master X not cash O, cancellations/no_show excluded; full privacy/parity across Core/CRM |
| G7 | GitHub CI / Storefront QA | PARTIAL / HOLD | Exact-HEAD Core privacy workflow native PASS, OpenAI design regressions resolved, mobile Visual QA screenshot evidence owner-reviewed, booking and version gates green, current main drift reconciled |
| G8 | Release and live readback | NOT STARTED | Owner grants release, exact SHA with rollback, no spend, safe merge/deploy (within free tiers), live Storefront/Admin/LINE/Revenue negative PII tests; signed-out access rejected post ACL cutover |

## What was NOT done or asserted

No Production or Main Merge/Deploy, no Google Drive permission edit, no change to Script Properties, no real read key creation/transport enabling, no booking/pricing/customer/LINE/automation mutations, no paid services or provider calls, no unsupervised rollback. No new GitHub-hosted or authenticated 13-source PASS was available in the current-turn readback. Because all these remain required, **closing Issue #49 / #738 now would be false reporting**.

## Continuation / evidence

- Draft security: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/739
- This checkpoint: `docs/KK_STABLE_BUSINESS_V1_CLOSEOUT_2026-10-17.md`
- Canonical privacy runbook: `docs/CORE_SHEET_PRIVACY_P0_CUTOVER_2026-10-14.md`
- Exact scoped prior source/test report: `docs/SECURITY_CORE_TASKS_2_3_6_EVIDENCE_2026-10-14.md`
- Source/real runtime holding tasks: Issues #49, #738, #714, #718, #9, #715, #710 and CI #707, Drafts #739, #744.
