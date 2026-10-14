# KK Phone Rental — Privacy + Revenue Integrated Release Candidate (DRAFT / HOLD)
Date: 2026-10-14 Asia/Bangkok. Owner selected tasks **2–13 only**, explicitly **excluded task 1** (upcoming customer booking follow-ups).
**This is a source-only candidate. Do not merge, deploy, revoke Drive ACL, change Production ENV, raise spending limits, trigger paid CI, contact customers or modify booking/business data from this document.**

## 1. Why integration is necessary
- Production Vercel is READY on main `d6dc3bfe4cc0c4dd6fdfec407823752da0572464`; Core Google Sheet is link-readable (`anyone/reader`) and contains private booking/contact data. Vercel Production environment key inventory includes `GOOGLE_SHEET_ID` but **does not include service-account email/private-key/JSON or a Core private strict flag** as of this read-only audit.
- PR [#739](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/739) (privacy) adds new opt-in `KK_CORE_SHEET_REQUIRE_PRIVATE=1`, safer private public API, Admin and Analytics read pathways; it does **not** fix Future revenue.
- PR [#737](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/737) (analytics) replaces Future cash O with canonical Master quote X; however its Master read uses historical `fetchCsv` (public GViz). Shipping revenue fix alone before privacy cutover is unsafe.
- The prior isolated branch `security/core-private-empty-failclosed-20261014` fixed legacy strict empty-reader fallback, while PR #739 fixed Core-flag strict empty fallback. **This branch integrates BOTH flags** (staged precursor `security/legacy-strict-privacy-integrate-20261014` commit `7010a0206c4aad135611a049b7eb929bca857536`).

## 2. Source changes made on this branch
Base: `security/legacy-strict-privacy-integrate-20261014` exact `7010a020...` (itself derived from PR #739 exact `5cc740b6...`). Not a Merge to main and no Pull Request opened due unknown private-repo GitHub CI included-minute balance.

1. `api/kk-data.js`: In Core-specific or legacy strict private mode, empty authenticated read cannot fall back to anonymous GViz. Core strict HTTP503 `core-private-unavailable`; legacy strict HTTP503 `private-empty`. Non-strict transitional fallback behavior unchanged. Three authored tests appended in `tests/core-sheet-privacy-cutover.test.js`; isolated direct-guard V8 scenario runtime **4/4 pass**, full Node not run.
2. `server/rental-analytics-booked-quote.js`: copied by exact blob from PR #737. Strict quote resolver from Master A4:X, active statuses, exact `booking_id + event_id + status + package_type` validation, positive Master X, duplicate identity rejection. No customer fields included in aggregate output.
3. `server/rental-dashboard-core.js`: rejects with HTTP503 `RENTAL_MASTER_PRIVATE_SOURCE_REQUIRED` unless Core strict flag AND private credentials configured; reads Master `A4:X` only with `CorePrivacy.readCsv`. Calculates Future from resolver-verified X, completed Actual from O, cancelled/no_show/blank excluded. Applies same verified amount in total/month/event/affiliation. On ambiguous quote, returns HTTP503 `RENTAL_ACTIVE_QUOTE_UNVERIFIED`. **No fallback to GViz for Master**.
4. `server/legacy/kk-rental-dashboard-v5.js`: same guarded Core-private Master quote requirement, while CRM helper remains private CRM reader. Does not silently fallback to Core for quote mismatch; error HTTP503. Preserves source metadata and non-PII aggregate contract.
5. `tests/rental-analytics-booked-quote.test.js`: transferred the exact PR #737 six regression tests.
6. `tests/rental-private-core-source-contract.test.js`: six authored tests ensure both aggregates use verified price, neither reads Master via public GViz, identities are checked, and no raw Master CSV is returned.
7. `package.json`: adds `test:revenue:private-core` to postinstall, as well as syntax coverage in `npm run check`; no new dependencies, paid APIs or runners.

## 3. Exact readback and verification
- GitHub exact branch file contents/SHAs re-fetched. V8 JavaScript grammar parsing PASS for six relevant source/test files. Isolated `BookedQuote.bookedPriceRows` fixture PASS: active confirmed X1290 O0 remains Future1290; completed and cancelled excluded from Future; duplicate active identity rejected with `RENTAL_ACTIVE_QUOTE_UNVERIFIED`.
- All **6/6 authored Source Contract** tests executed in a V8 in-memory Node-require shim with fetched exact branch source and PASS; not native Node.
- Core privacy guard excerpt tested directly in V8: 4/4 conditions PASS (Core empty strict 503; legacy empty strict 503; non-strict remains permissive; non-empty private success untouched).
- Native Core Sheet `00_Master_Booking` active count **26**, quoted X sum **THB 29,660**, received cash O 0. Native `00_Rental_Dashboard`: Actual THB 67,125, Future THB 29,660, Forecast THB 96,785.
- Real Helper `_Rental_Dashboard_Data` had **116** booking source rows, **26** active, matched by exact Booking ID + Event ID + status + package type against 51 Master records: **26/26 matched; 0 mismatches; 0 ambiguous; 0 invalid quote**; sum THB29,660. This is a live data-join read-only witness, not proof of hosted runtime output.
- **NO GitHub-hosted Actions, native Node full test suite, Preview deployment, authenticated browser, OAuth production read, negative anonymous access test, or Production release acceptance has run.** Source tests must NOT be represented as Production GREEN.

## 4. Zero-downtime release gates (fail closed)
1. Owner's actual Core Sheet is currently `anyone/reader` with customer PII; must prepare PRIVATE owner-authorized Sheets API access. User must provision Reader access for a trusted service account and configure encrypted Production environment variables **through the provider UI/secret manager, never GitHub/chat**. Existing prod env key list is missing service-account credentials.
2. Run an exact-HEAD private test from Vercel on the Core Sheet (including `00_Master_Booking!A4:X` without logging or responding with PII). Enforce `KK_CORE_SHEET_REQUIRE_PRIVATE=1`; verify public `08_Web_Ready` and `09_Web_Packages` only expose sanitized public fields, all Admin/CRM/Automation dependencies accepted. Test empty reader, expired token, auth fail, 403 and missing sheet; never fall back anonymously.
3. Reconcile frozen reference dataset across Core and CRM `actual 67,125 / future 29,660 / forecast 96,785` (subject to legitimate live changes). Monthly/event/artist breakdown must use identical definitions; verify known archive overlap logic and no duplicate counting.
4. Obtain zero-spend **real Node** targeted+full `npm test` and `npm run check`, plus exact-HEAD GitHub Actions only after quota/admission verified (#707). Inspect real Vercel Hobby storage headroom (#692) before any Preview/Prod build.
5. Do not merge two separate historic PRs blindly; review this staged integration as one candidate with source-diff, tests, privacy/cash semantics and rollback. Owner approval required for merge/deploy.
6. Only AFTER live Core strict private feed, booking/admin and revenue accepted: revoke **existing** public Anyone Reader ACL on canonical Core Sheet; anonymous direct file AND `gviz` must then deny, while signed-out site, LINE CTA, private Admin/CRM/Scanner still work; capture rollback plan and monitor. If any read fails, leave public permission in place and flag P0 HOLD—do not switch reader without tested fallbacks or leak PII.
7. Separately repair Anyone Writer image-folder/asset rights (#718) with owner-controlled ACL review (#721), verify all visible posters work signed-out after downgrade. Private Core ACL and public poster Reader are distinct security models.

## 5. Other tasks and cross-chat continuity (task 1 excluded)
- Task #5 Data integrity: previous run removed exactly one orphan Booking ID from `00_Master_Booking!A15`, preserved all 11 formula cells and valid Archive. Refreshed 51 Master + 65 Archive Booking IDs, zero duplicate IDs. [#489 checkpoint](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/489#issuecomment-6165895383). Wider schema audit remains open.
- Task #8 Poster: previous owner-provided original FORTREASURE 27 Nov restored to `01_Events!E319` and derived `08_Web_Ready!E320`, verified public Production CSV HTTP200 and 27 Nov show / 28 Nov hide; packages 790/990 unchanged. [#733](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/733#issuecomment-6165985013). Other official artwork/guest-render QA pending #731.
- Task #11 Make alerts: authenticated read-only check of Telegram ledger `6176241` still inactive; its owner send and Sheets update modules all disabled. Staging gateway `6600107` still inactive; Prepare, Send, ACK modules disabled; no executions since 10 Oct in legacy ledger. Connections reporting `ok` do NOT establish actual sends. **Never activate queued legacy workflow**; signed outbox + owner-only E2E still required (#740/#696).
- Task #9 Inbox: prior Supabase read 44 conversations/214 messages, 23 images, private media bucket 0 stored files, no linked Booking IDs, PR #700 DRAFT. Do not claim old images recoverable.
- Task #7 Storefront draft #711 fixes unavailable advertised starting price + English LINE template; #727 poster Hero/contain/QA remains unmerged. Browser full visual QA + exact-head required.
- Task #10 Scanner #732 is draft based on closure branch; provider availability/natural ledger acceptance and owner-lock preservation pending.
- Task #12 X log: 164 rows = 22 confirmed_posted, 65 assumed_posted, 16 planned, 61 superseded, no authenticated engagement verification; #716 DRAFT. No autopost.
- Task #13 Competitor: #717 has **no eligible current 3-independent-shop median** in audited Q4 samples, so no automatic repricing.
- Task #6 CI/Hobby #707/#692 blockers and Task #4 public poster Writer still open.
- **Task #1 remains excluded**: no customer communications, date/price/booking operations or asset transactions here.

## 6. Owner release verdict
**HOLD / SOURCE-ONLY IMPROVED**. No production permission, Google Sheet booking/pricing, Make activation, Telegram/LINE/X sends, OAuth secret, Vercel deployment, GitHub merge, quota purchase, or cost-bearing test was performed in this branch. This candidate must be reconciled against any concurrent changes to Draft #739/#737 before use. Do not merge or deploy this branch without exact-head tests and approval.
