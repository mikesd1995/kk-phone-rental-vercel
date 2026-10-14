# KK Phone Rental — Owner execution log / cross-chat audit
Date: 2026-10-14 (Asia/Bangkok)
Scope: owner-selected tasks **2–13 only**. **Task 1 intentionally EXCLUDED** (no upcoming customer appointment reconciliation). No merge/deploy, quota purchase, LINE send, X post, customer/booking/price/status mutation or ACL mutation. This is a checkpoint, not complete acceptance.

## Immutable baseline and evidence
- GitHub repo: `mikesd1995/kk-phone-rental-vercel`; production baseline `main d6dc3bfe4cc0c4dd6fdfec407823752da0572464`.
- Vercel Prod deployment `dpl_7TYLb87ir9qNzXRtkeb49543dwVm`, READY, home HTTP200. Vercel grouped 7-day runtime errors returned none, not E2E proof.
- Owner Core Google Sheet `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`.
- This run's source/private findings and readbacks are logged in Issues [#489](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/489#issuecomment-6165895383), [#733](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/733#issuecomment-6165955975) and [#738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738#issuecomment-6165991354).

## Actual production data repairs completed
### Task 5 — orphan ID in Core Master, single-cell scope
- Preflight: `00_Master_Booking!A15` held `BK-20260913-001` only, `B15:T15` no entered business values, 11 calculated fields `U15:AE15` are independent formulas; `12_Booking_Archive!G66` holds actual completed record with same identity. Preserve archive and formula cells.
- Used Google Sheets `updateCells` exactly range row index14–15, col index0–1, `fields:"userEnteredValue"`; cleared A15 only.
- Post-readback: A15 empty; 11/11 U15:AE15 formulas preserved; Archive completed record unchanged; entire inspected grid `00_Master_Booking!A5:D1000` now 51 BK records, Archive `G2:J1000` 65 BK records; duplicate IDs 0 within either set and 0 across Master/Archive.
- Core Dashboard Actual ฿67,125 / Future ฿29,660 / Forecast ฿96,785 unchanged.
- Does NOT establish 30-tab cell/formula integrity acceptance. No appointment (task 1) action.

### Task 8 — FORTREASURE poster source drift, exact-date repair
- Owner-approved original image ID `1OVYGQIlzt-n_la8eKKwgFIBcrrVxix78` already present in Nov28 and Nov29 event rows. Nov27 Core `01_Events!E319` and derived `08_Web_Ready!E320` were blank despite earlier claim of success.
- Preflight exact event/date (Nov27), owner visibility and same-event image provenance; metadata confirms image exists; poster ACL is **still anyone/writer** (Task 4 outstanding).
- First attempted batch rejected HTTP400 due to wrong guessed sheetId (no changes); re-read metadata, actual `01_Events` sheetId `416044968`. Re-ran exact `E319` `updateCells` with only `userEnteredValue` and preserved all other cells.
- Verified Core E319 and derived E320 owner image exact ID. Nov28 remained hidden/0 phones; Nov27 show/2 phones; official same image unchanged Nov29.
- **Production HTTP readback PASS**: `/api/kk-data?sheet=08_Web_Ready&range=A4%3AK` returned HTTP200 and Nov27 E image ID / show / 2; Nov28 hide/0. `09_Web_Packages&range=A4%3AN` HTTP200 Nov27 phone-only ฿790 avail2, bundle ฿990 avail2, lens-only hidden.
- Remaining: real rendered guest/mobile image decode acceptance, Task 4 ACL, monitor why E319 regressed, exact official posters for remaining events.

## Source-code repair staged; NO release
### Task 2 — strict private reader must never fall back to anonymous
- Core Sheet Drive metadata readback: `shared=true` permission `type:anyone,role:reader,allowFileDiscovery=false`. Customer/contact/Booking fields exist in same workbook; confirmed exposure-risk ACL, **not** proof of exfiltration.
- Production `api/kk-data.js` has `KK_PUBLIC_SHEET_REQUIRE_PRIVATE` and historically falls through to `readPublicGvizCsv` when `readPrivateCsv()` resolves `''` without throwing. Strict error path already handles thrown private errors, but not empty strings.
- Created isolated branch [`security/core-private-empty-failclosed-20261014`](https://github.com/mikesd1995/kk-phone-rental-vercel/tree/security/core-private-empty-failclosed-20261014) from exact production SHA. Commit [`6292fba9`](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/6292fba9eccd0980bfe477829adec0e68eea1710) inserts `if (requirePrivate && !text) return HTTP503` with `X-KK-Sheet-Source:private-empty` before public GViz fallback. Commit [`d811240a`](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/d811240a12ed6f1806d7c8526406f98d26801b67) extends `tests/public-data-proxy.test.js` with 3 cases: empty strict, strict valid, thrown strict; each asserts 0 public fetch. GitHub exact content/blob SHA readback PASS, V8 static JS syntax compilation PASS. **Node tests/GitHub Actions/Preview NOT RUN**; spending/quota unknown.
- **SECURITY NOT REMEDIATED in Production**. Next: safe authenticated Core private service-account reader, projection-only public events/packages with no PII, strict 1 exact-read/negative tests/Admin+Rental parity, then owner-authorized removal of anyone Reader and post-cutover anonymous gviz denied + rollback. Never revoke ACL first or expose Master X via unauthenticated quote join. Issue [#738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738).

## Unresolved task status and acceptance dependencies
| Task | Status | Required next work / evidence |
|---|---|---|
| 2 Core Security | STAGED ONLY | Finish private reader E2E, strict flag, ACL removal after verified cutover; see #738 |
| 3 Revenue Future | DRAFT PR #737 | Core+CRM Future must use canonical Master X. Source V8 6/6 reported, not Node/CI/E2E; compare live Actual 67125/Future 29660/Forecast 96785 and test duplicate joins/PII/auth. No production merge. #710 |
| 4 Poster ACL | OPEN | Owner Drive evidence shows dozens of Drive poster assets anyone/writer (35–36 depending census). PR #721 owner-only dry-run ACL downgrade. Actual permissions still unsafe; execute only after owner scope/readback, verify full public image accessibility. #718 |
| 5 Data Integrity | PARTIAL FIX | Orphan A15 fixed, Master 51 Archive 65 IDs duplicate-free; full formula/event/package/asset/status audit and actual API reconciliation pending. #489 |
| 6 CI / Hobby | BLOCKED | Zero-step Actions jobs don't prove source test failed; inspect GitHub billing/runner admission and `npm ci` missing lockfile bug (#707). 10GB Deployment Storage alert historical; current GB headroom not measurable from connected tools (#692). No paid runners/previews. |
| 7 Storefront | DRAFT | PRs #711/#727 unmerged. Main `script.js:startingPriceFor` includes unbookable packages, `buildBookingMsg` Thai line hardcoded in English; poster CSS/scroll/modal need rendered mobile visual QA and production post-release readback. #713 |
| 8 Posters | PARTIAL FIX | Nov27 owner original restored; missing other exact official sources (LE7EL, VVV, AFTERLIFE, POPPAH4, SUPER SUN, MizuMi, LYKN, K-Pop Masterz) require visual event/date provenance and stable guest URLs; #731 |
| 9 LINE Inbox | DRAFT | Supabase 44 conversations / 214 messages (180 text, 23 image, 11 stickers), 0 linked_booking_id; private media storage has 0 objects. PR #700 unmerged. Live new-image ingestion, real owner browser, durable outbound/dedup and explicit booking link acceptance pending. #715 |
| 10 Ultra Deep | DRAFT / HOLD | PR #732 based on closure branch (not main), verification of provider availability/detail follow-up/monthly recall and natural production ledger absent. No unsupervised writer or re-add hidden events. #49/#368 |
| 11 Make/Control Plane | SAFE DEGRADED | Legacy writer quarantine documented #696; new outbox and signed owner-only Telegram receipt have no production acceptance; control-plane runtime observation/task/agent tables in selected Supabase ledger empty at audit. Zero paid credit. |
| 12 X Marketing | DRAFT | Posting Log 164 rows: 22 confirmed_posted, 65 assumed_posted, 16 planned, 61 superseded. PR #716 shadow only; no fabricated X engagement, owner approval and dedup 06:00 day. #555 |
| 13 Price parity | READ-ONLY HOLD | #717 found 0 eligible current 3-independent-shop medians for sampled Q4 events; do not auto-change booked or unbooked prices absent fresh exact-event, exact bundle verified quotes. |

## Release blockers / no-oversell criteria
- **Task 1 excluded**, no upcoming customer handling.
- **No merge/Production deploy/automatic X posts/LINE customer sends/permission changes** from this checkpoint.
- **No additional spend**: no GitHub-hosted test rerun, Vercel build, Make credit use, HF/Exa paid scan, TinyFish.
- Do not label pending tasks green because of V8 syntax or historical tests. Need exact-head actual Node/CI, Production authenticated E2E, public data no PII, ACL and rollback readback, customer/booking safety before release.
- This report is NOT claim of every line of repository, every Sheet formula, every deployed Make module audited.
