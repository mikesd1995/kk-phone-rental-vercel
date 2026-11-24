# Operations Dashboard V4 — R17 live-source audit & safety hardening (10 Nov 2026 ICT)

**RELEASE STATUS: HOLD / NOT PRODUCTION.** This document is a cross-chat readback checkpoint. No live business data mutations, customer PII writes, secret reads, or Production deploy.

## Baseline and authoritative exact PR
- Repository: mikesd1995/kk-phone-rental-vercel
- Integration: [PR #860](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/860), branch \`release/ops-dashboard-v4-gated-main-20261110\`, base \`main\` exact \`eec14200cb087173ca555fa0c21b99e54c1c3961\`. Work is isolated from Codex and existing #851/#854/#857/#858.
- Parent #851 includes read-only Admin UI, server allowlisted PII projection and signed session. R14 #857 adds venue fail closed; R15 #858 adds stale/public/date fail closed; R16 includes actual Chromium 8-width screenshot/DOM evidence. Preview-only synthetic fixture PR #854 is excluded from integrated release.
- At start of R17, #860 HEAD \`1d8aca585951824fe7e0b00a1415bf8159570366\`, exact CI Actions #42680653392 PASS both regression and browser visual jobs, Vercel Preview READY \`dpl_5Cih5yHR3DpoQUDBHxX2YYcQavWf\`. Vercel Production still READY on main \`eec1420\`, **not** Dashboard V4.

## R17 source code changes
1. \`admin/operations-dashboard.js\`: physical inventory no longer yields green \`phoneReady/bundleReady\` when Owner Locks are missing, blank, conflicting or locked, when Booking ID/status is ambiguous, or when package identity/pricing fails safety checks. Audit rows and numerical stock remain readable; availability badge becomes \`ต้องตรวจ\`. The historical X Post Log/Production verification gate remains HOLD.
2. Dedicated QA panels for \`Owner Locks ต้องตรวจ\` and \`Booking ผิดปกติ\`; dashboard lets owner locate affected rows without modifying Sheets.
3. \`tests/operations-dashboard-readonly.test.js\`: explicit regression tests for missing/locked/conflicting lock, unknown/duplicate/missing Booking identity, missing/ambiguous pricing, and known-good private source, plus new QA panels.

## Actual connected Google Sheet read-only schema/aggregate verification
Source chosen by **exact title**, avoiding obsolete backup sheets: \`KK Phone rental backend\`. Its metadata confirms **Asia/Bangkok** timezone. Only event metadata, stock/package, and Lock fields were read; **no customer name/phone or Booking data cells** were read.

- Bounded reads: \`01_Events A5:G999\`, \`08_Web_Ready A5:J1000\`, \`09_Web_Packages A5:J1360\`, \`18_Event_Visibility_Locks B2:G1000\`, with header schema verified separately. Nonempty rows: Events **438**, Web Ready **438**, Web Packages **1,314**, Owner Locks **366**.
- Web Ready visibility: **94 SHOW**, **12 SHOW_FULL**, **332 HIDE**.
- By Event ID on these ranges, **0 orphan Web Ready IDs**, **0 Core/WebReady nonempty venue mismatches**, **0 nonempty date conflicts**, **0 SHOW-without-package**, **0 SHOW with Core explicitly closed/not-active**.
- **52 SHOW events with positive phone stock have no matching Owner Lock evidence**. They must remain \`ต้องตรวจ\` until owner verifies canonical lock records. This does **not** establish a real booking collision; do not auto-create/reopen locks.
- **4 SHOW events have no Web Ready poster URL or placeholder/fallback marker**. Inspect exact-event verified poster source before any production poster write.
- Among Web Ready, **92 SHOW** events have positive stock in the source view; positive stock alone is insufficient to assert bookability.
- Additional sampled status-column read only: Owner Lock states include \`SEEN_CORE\`, \`LOCKED\`, \`REOPENED\`; these are real source values accepted/held by code. No names or customer IDs were included in this document.
- Data statistics are a read-only snapshot, not claims about future availability; do not use for marketing without live re-verification.

## Verified gates and blockers
- Integrated candidate full CI and Chromium eight-width visual QA initially passed. Re-run required for each new exact source HEAD; don't report a previous CI as latest if HEAD moves.
- Real signed-in **hosted** Admin + authenticated private Sheet/V5 read parity + customer PII network audit have **not** been completed. Existing tests use synthetic local HTTP only.
- Vercel Preview env metadata (names/scopes only; values never decrypted) shows a branch-scoped \`KK_ADMIN_PIN\`/\`GOOGLE_SHEET_ID\` set for parent #851, but **not** integrated release branch #860. Production holds \`KK_ADMIN_PIN\` and \`GOOGLE_SHEET_ID\`; thus a READY release Preview cannot prove branch #860 login or direct private Sheet access. Do **not** expand production secret visibility or copy/decrypt keys to force UAT. Dedicated \`KK_ADMIN_SESSION_SECRET\` is not listed for Production (the current Admin session implementation has PIN-scrypt compatibility fallback); plan separate approved hardening.
- **Independent PR Reviewer: 0** at audit. Do not represent CI, Codex, or the author as independent Reviewer.
- Vercel project SSO/deployment protection is enabled for noncustom Preview domains; never disable it to automate a test.
- No production merge, promotion, secrets/ACL edits, booked-day edits, Google Sheet writes, or X posts made.

## Next actions (ordered)
1. Obtain exact-HEAD regression and Chromium QA PASS, confirm candidate Preview corresponding to latest exact SHA.
2. Arrange legitimate independent security Reviewer and signed-session hosted private-source UAT with owner-controlled credentials and protected browser; collect **redacted** readbacks on event/booking/lock counts, cache headers, negative auth and PII-free network response.
3. Resolve 52 missing-lock QA records *after operator validation*, and 4 poster QA records only with exact-event proof; do not auto-open booking dates.
4. Verify final integration relative to current main, then owner-controlled release with rollback candidate and exact Production SHA + \`/admin/operations-dashboard.html\` + API readback.
5. If any gate fails, keep HOLD and add failure evidence on PR #860 and Issue #49.

**Do not claim this Dashboard is on the live admin until production deployment and authenticated readback actually prove it.**
