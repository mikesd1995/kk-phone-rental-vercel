# KK Phone Rental — Selected tasks 1, 2, 3 execution evidence (17 Oct 2026, ICT)

## Scope & release control
Owner selected: (1) repair three failing optional OpenAI/UI source contracts, (2) repair Storefront Visual QA defects with evidence, and (3) run/gate full Native Node Core security regression. **No merge, Vercel deployment, Apps Script release, live Booking/Customer/Price changes, Google ACL/secret changes, paid provider calls or approvals were authorized.** Work staged solely on Draft PR [#739](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/739). User cancelled the Google Service Account approach earlier; Apps Script read-only remains the chosen future cutover path.

## 1 — OpenAI zero-cost source acceptance (three actual old failures)
Prior hosted exact SHA `84713248674eb1035fbff2326883089f5f67a319` run [38605320815](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38605320815) completed **66/69 PASS, 3 FAIL** in `tests/storefront-visual-qa-automation.test.js`:
- Legacy V5.8 test asserted the retired `v67-lower-page-finish` and `FAR SEAT / CLOSE MEMORY` literal headline, while current UI has owner-directed Thai hero `ไกลแค่ไหน / ก็เก็บโมเมนต์ได้ใกล้กว่า`, appropriate discovery CTA, concert branding and the proprietary art direction.
- Legacy V6.1 test demanded `วิธีการเช่า`, while actual CTA is `เช่ายังไง?` and still links to the real `#booking-journey` instructional section.
- V6.5 localization test demanded `How it works` and shortened venue copy, while the implemented EN labels are `How to rent` and `Venue pickup & return · Setup help before the show`.

**Change:** align only stale literal assertions to the actual current customer-facing contract. New assertions still enforce semantic hero section/title, non-generic copy, correct #content/#booking-journey targets, trust/insurance and benefit labels, relevant CSS/mobile contracts and deliberate EN/TH microcopy. Did NOT disable tests, alter user-facing CTA copy or claim visual-owner acceptance.

**Verification:** re-read exact GitHub source for visual contract, HTML, CSS, JS, runner/workflow and related design source; **40/40 isolated JavaScript V8 source-contract tests PASS** after patch. **Not an actual Node GitHub Actions rerun**.

## 2 — Visual QA technical fixes without reapproval forgery
Previous hosted [Visual QA 38605320772](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38605320772) failed. Real screenshot/read-only evidence shows `CARD_CONTENT_ESCAPES`, `POSTER_LETTERBOX_UNTREATED`, `POSTER_SOURCE_DEGRADED_FALLBACK_RENDERED`, and `MOBILE_SHEET_NOT_ANCHORED`, owner screenshot review BLOCKED. Cross-origin poster failures remain honest, never replaced with other events' posters.

Fixes staged:
- `script.js` `setImgFallback` now invokes `onLoaded` when images settle, including cached pixel-complete Safari images with no reliable `load` event; card passes `syncPosterTreatment` through eager/lazy paths. Preserve uncropped `object-fit:contain`, the original official artwork and exact-event fallback rather than fake/cropped substitutions.
- `assets/kk-storefront-v5.css` final scoped **V6.33 mobile** correction restores `height:auto` for card and `poster-info` after an earlier, later-applied global 100%-height rule; preserve 4:5 poster and ≥44px CTA. Intended to address observed card content outside bounding box, but needs screenshot verification at 320/375/390/430/480/768/1024/1440.
- `scripts/storefront-evidence.cjs`: retired P1 bottom-sheet-only placement assertion conflicted with the owner-designed **centered dialog**. It now accepts EITHER a correctly centered/contained mobile modal or an anchored sheet, and still blocks genuinely off-center, clipped, horizontal-overflow, missing-focus or missing-title states. No 'always pass' bypass.
- Added source + behavioral regressions in `tests/storefront-visual-qa-automation.test.js` for cached/fresh image treatments and last cascade rule; added `tests/storefront-evidence.test.js` for centered vs anchored vs off-center/clipped dialog. Isolated exact source `stateFindings` runtime: **4/4 focused cases PASS**.

**UNPROVEN:** no fresh Chrome multi-viewport screenshot run or owner re-acceptance exists for these changed CSS/JS blobs. The screenshot review digest is intentionally NOT altered; original Visual QA P1 issues cannot be declared closed until fresh rendered evidence. Official poster URL/source failures require exact-event verified posters; do not suppress errors or display unrelated art.

## 3 — Full native Node Core Privacy regression
PR #739 already stages a separate **read-only, exact-head, 8-minute, no-install** GitHub standard-runner workflow `.github/workflows/core-sheet-privacy-exact-head.yml`, covering 10 security suites and safe source guards. Because this **new workflow is not installed on the existing main branch and had no associated runs** for recent PR SHAs, added a temporary `Full Core privacy source regression (zero provider / exact HEAD)` job step to already existing `.github/workflows/openai-platform-staging-acceptance.yml` (main-registered) reusing its Node 20 exact SHA checkout, no package install, no external keys and no production writes. It runs:
- `core-sheet-privacy-cutover`, `core-private-cutover-preflight`
- `core-apps-script-private-reader`, `core-apps-script-public-get-privacy`, `core-read-only-key-isolation`, `core-read-key-owner-setup`
- `admin-sheet-fallback-private-reader`, `public-data-proxy`, `public-data-browser-privacy`, `core-sheet-privacy-workflow-contract`.

**Source tests only:** exact fetched GitHub source mocked in isolated V8: Core reader **10/10**, preflight **8/8** after fixing a test-harness-only lack of deepEqual; workflow contract **4/4**. The new staged hosted test invocation is present; **NO exact-current-head hosted Native Node result was returned** via Actions. Container cannot clone GitHub (network DNS blocked), and no workspace clone was attached; do **not** count source tests as full Node test acceptance. Previous hosted 3/5 PASS belongs to different, older SHA `8471324...`; not to this changed revision. Do not rerun stale workflow run as if it tested new code.

## Last live read-only privacy safety snapshot
- Core workbook ACL still includes `anyone/reader` + owner, no evidence of actual third-party access; do not infer otherwise.
- Vercel metadata (no decrypted values) still contains only old `KK_ADMIN_SCRIPT_URL`, `KK_ADMIN_API_KEY`, `KK_ADMIN_PIN`, `GOOGLE_SHEET_ID`, **not** `KK_CORE_PRIVATE_READ_KEY`.
- Production main has **moved independently** while this Draft PR was staged; latest observed Production READY `44de0066f0c7edd59e153b2d31c22d65b84de5af`; never claim old base `d6dc3bfe...` is the live deployment. This activity did not merge/deploy #739.
- Strict Apps Script private authenticated 13-dataset probe, signed-out anonymous Google Docs/GViz deny, live Booking/LINE/Scanner/Revenue privacy readback remain **NOT DONE**.

## Next gate — KEEP P0 OPEN and PR Draft
1. On exact PR current HEAD, await/get genuinely completed zero-cost hosted `node --test` results; inspect failed step logs and fix only real failures. A test command committed to YAML ≠ CI PASS. Avoid paid providers or custom runners.
2. Run fresh read-only Chrome Visual QA on the exact HTML/CSS/JS blobs, all widths and TH/EN+light/dark+modal states; inspect `CARD_CONTENT_ESCAPES`, `POSTER_LETTERBOX_UNTREATED`, external asset failures and owner screenshot baseline. Obtain **new explicit owner visual acceptance** without manipulating old approval JSON.
3. Resolve branch divergence with latest Production/Main without blind merges; add safe independent owner Apps Script reader key, configure Script Properties and Vercel protected env, run real private Core 13/13 and public/PII, Booking/LINE/Admin/Scanner/Revenue acceptance before release approval.
4. Only after the owner's explicit release/permission approval: controlled merge and deploy in free quota, later revoke the existing public ACL grant, verify anonymous negative and business positive readback with rollback.

**Status:** 1 source contracts repaired; 2 targeted visual source defects patched but full screenshot acceptance OPEN; 3 comprehensive Native Node workflow staged but current-head hosted run NOT YET PROVEN. **No completion claim for Production Security P0 #738 or Visual Release.**

---

## 2026-10-17 continued execution — exact-current-branch gating checkpoint

**Owner selection:** 1 = repair failing optional OpenAI/design tests, 2 = technical Storefront Visual QA/Poster/Mobile without bypassing owner review, 3 = exact-head Core Privacy Node regression. No Google Service Account (removed by owner). No merge, deployment, credentials/ACL, customer/booking, automation, pricing or paid provider changes authorized.

### New source changes on Draft PR #739
- Commit `ef61fdbe309b1fd5de24188f34e5da65e5955a70`: moved `Full Core privacy source regression (zero provider / exact HEAD)` before `Zero-cost source safety regression` in the **already-main-registered** `.github/workflows/openai-platform-staging-acceptance.yml`. This ensures Core private-data tests run before optional storefront source/design assertions even if those fail. Standard ubuntu-latest / Node 20, no dependency install, no provider data or production writes.
- Commit `392e22e234e2f1c070743e655d9d963053de6882`: added two focused source regression cases to `tests/storefront-visual-qa-automation.test.js`. They assert Core test ordering and the complete read-only privacy test inventory; retained uncropped `object-fit:contain` poster treatment, mobile content-height override, `CARD_CONTENT_ESCAPES`, `POSTER_LETTERBOX_UNTREATED`, `MOBILE_DIALOG_PLACEMENT_INVALID`, exact screenshot blob digest and owner-review release gates. Never turn these blockers into unconditional PASS.
- Commit `30458155e7844e7f7d779cdeeeb9fb90bb600d7a`: set `persist-credentials: false` on the existing OpenAI/Native Core acceptance workflow checkout to prevent the read-only GitHub token from persisting inside the QA checkout.
- Commit `ba022c037ecfa61deade1dbbb241434c6aba2361`: added test asserting the non-persisted token to the Visual QA workflow contract. **Current verified branch HEAD at this checkpoint: `ba022c037ecfa61deade1dbbb241434c6aba2361`.**

### Exact GitHub-source unit execution (isolated JS V8; NOT Node hosted)
| Suite group | Result |
| --- | --- |
| Storefront visual source/contract and poster/Mobile policy | **42/42 PASS**, rerun after last workflow/test change on exact HEAD |
| Apps Script private reader / read-vs-Admin key / public doGet / owner-local key bootstrap / Core workflow contract | **26/26 PASS** |
| Public HTTP feed schema and synthetic PII protection | **16/16 PASS** |
| Admin fallback / private source preflight | **14/14 PASS** |
| Core SOT vs CRM private cutover and runtime source guards | **10/10 PASS** |
| Browser API-only Privacy guard | **2/2 PASS** |
| **TOTAL** | **110/110 PASS in isolated V8 mocked source checks; not proof of hosted Node/full business acceptance** |

All values are synthetic in the tests; no live client name, phone, booking, Sheet rows or private credential was written into GitHub or report. Full Node native suite was **NOT run** on this exact HEAD: this execution environment has Node v22.16.0 but no checked-out repository, and `git ls-remote`/clone to public GitHub fails DNS/network access; connected GitHub tool can fetch files but does not offer a workflow-dispatch or a complete authenticated checkout transfer. Tests executed by in-process source-evaluation mocks must not be misrepresented as `node --test`.

### Exact-head CI and screenshot availability
- GitHub `fetch_commit_workflow_runs` and combined commit status returned **zero workflow runs/status contexts** for `ba022c037ecfa61deade1dbbb241434c6aba2361` at readback. Having the workflow or source tests staged is not proof of execution; DO NOT say CI green.
- The last verified hosted job results on **older SHA** `84713248674eb1035fbff2326883089f5f67a319` remain: Booking, Vercel source and Ultra Deep V2 PASS; OpenAI optional **66/69** and Visual QA FAIL. These old jobs do **not** validate the present source fixes.
- Fresh Chrome read-only screenshot review for the current SHA is **NOT available**. The current branch already staged mobile CSS, backdrop/image cache treatment and center-modal containment fixes before this continuation. Their source checks pass, but actual `CARD_CONTENT_ESCAPES`, poster source degradation, image-treatment metrics, multiwidth light/dark TH/EN screenshots and owner visual acceptance remain unverified. Never alter old screenshot-review JSON to fake acceptance.

### Current read-only business safety
- Draft PR #739 still open and unmerged, GitHub mergeable=false; PR branch is diverged from the old main base and should not be merged without reconciliation.
- Vercel Production READY deployment most recently returned a different SHA `44de0066f0c7edd59e153b2d31c22d65b84de5af` on another branch; it is **not** this Draft SHA and was **not deployed by this operation**.
- Canonical Core owner Google Drive ACL still shows `anyone/reader` + owner. Vercel Production env metadata still lacks dedicated `KK_CORE_PRIVATE_READ_KEY`; strict Apps Script release and 13-source authenticated private read acceptance have **NOT** happened.
- No manual GitHub hosted rerun was available through this connected GitHub action set. Do not spend, disable auth, bypass approval, or trigger Preview/Production as a workaround.

### Required closure gates
1. **Owner/authorized CI invocation:** run registered `OpenAI Optional Zero-Cost Acceptance` on exact branch SHA `ba022c... ` with no provider spend and inspect native Node 20 test logs, especially the staged security step executed **before** optional storefront QA. Alternatively install/register the dedicated security workflow through separately approved governance, then run it. A run against main/older SHA is insufficient.
2. **Visual:** obtain exact SHA Chrome read-only screenshots at 320/375/390/430/480/768/1024/1440 in both languages/themes and modal/filters; verify zero P0/P1 defects and honest external-poster fallback behavior; present screenshots to owner for actual visual approval. No undocumented baseline/screenshot digest modifications.
3. **Production cutover remains a separate explicit approval gate:** independently provision Apps Script Reader Key, verify 13 datasets and downstream Booking/LINE/Admin/Revenue/Scanner, then approved merge/deploy, and only afterward remove existing Anyone Reader with anonymous negative tests. **Security P0 OPEN / RELEASE HOLD.**
