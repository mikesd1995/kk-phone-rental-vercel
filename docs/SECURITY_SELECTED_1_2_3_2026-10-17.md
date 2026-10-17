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
