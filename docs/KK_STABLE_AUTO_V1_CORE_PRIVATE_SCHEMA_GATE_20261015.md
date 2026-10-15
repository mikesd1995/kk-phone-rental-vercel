# KK Stable Auto V1 — P0 Core Private 13-dataset schema acceptance (2026-10-15 ICT)

**Stage: SOURCE-ONLY | Release HOLD | No ACL/secret/Production change.**

## Actual authenticated read-only evidence
On 2026-10-15 read canonical `KK Phone rental backend` workbook's exact 13 Admin + Analytics header rows with Google Sheets connector (including `01_Events`, `00_Master_Booking`, `02_Assets`, `03_Packages`, `04_Event_Overrides`, `08_Web_Ready`, `09_Web_Packages`, `11_Customer_Stats`, `10_Admin_Health_Check`, `Model_Master`, `18_Event_Visibility_Locks`, `_Rental_Dashboard_Data`, `13_Event_Archive`). **13/13 tabs EXIST / 13/13 expected headers present**. The actual `13_Event_Archive!A1` header is `archived_at`. No Booking/contact/customer values stored in this document or GitHub.

**Important distinction:** This is a *native-owner Google Sheets read-only header check*, NOT authentication or readback through the proposed Apps Script private transport. Private 13/13 and authenticated negative tests remain NOT ACCEPTED; Core Sheet is still `anyone/reader` and must not lose that permission until the protected reader is proven in production and rollback prepared.

## Fixed false-green vulnerability
`scripts/core-private-cutover-preflight.cjs` originally declared archive `header:null`. `hasHeader(values,null)` accepted any nonempty sheet, including a fabricated data-only row with no archive schema. Private 13-dataset probe could thus say PASS for a corrupted/misrouted archive response. Fixed to `header:'archived_at'` for exact first-row enforcement, without printing any row content.

**Fixed diagnosability without leaking PII:** Classified only 8 exact, audited, fixed `CORE_APPS_SCRIPT_*` failure codes from the already-staged server private-transport reader (NOT_READY/ID_MISMATCH/FETCH_UNAVAILABLE/BAD_REDIRECT/HTTP_FAILURE/RESPONSE_INVALID/TIMEOUT/UNAVAILABLE). Any provider-supplied arbitrary error code, PII or appended secret still maps to `CORE_PRIVATE_PROBE_FAILED`. No raw provider response or credentials ever printed.

## Source regression
- 8 existing + 2 new `tests/core-private-cutover-preflight.test.js` test callbacks executed against patched source in isolated V8 with stubbed credential-read state and Admin schema: **10/10 PASS, 0 real network/ACL/Booking writes**. Native Node/GitHub Actions exact SHA **NOT RUN**.
- Core release sequence remains: verify Apps Script bound owner script identity/rollback and 9.5.13, separate read-only key (not mutating Admin key), private strict 13/13 *real* reads and negative authorization/redirect tests, Admin/Storefront/Revenue functional parity, then owner-approved selective ACL change and signed-out direct/gviz denial with rollback.
- Refuse to interpret 13/13 owner-sheet headers or mocked tests as a live private-reader PASS.

## Booking boundary readback (no production edits)
Confirmed 28 active bookings overall; 16 missing pickup times and 28 missing return times. Oct 17 confirmed at Master rows 60/63 and Oct 18 rows 52/58, two devices on each day, each with assigned device asset ID but all four lacking pickup/return times. No inference about cross-day collision or customer identity. Require owner/customer time confirmation and locked device validation before auto-dispatch.

## Release gates and cross-chat links
Canonical Draft [PR #744](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/744) is the only source candidate for Stable Auto V1; maintain Issue [#49](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/49) OPEN, Core privacy [#738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738), Booking [#714](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/714), Apps Script [#9](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/9). Never merge/deploy or change ACL/Booking/LINE/Agent/Make/Scanner/Marketing Production before Safety Gates and required owner approval. No extra spend; no Actions rerun or preview deployment in this step.

**Verdict: CORE_HEADER_PRESENCE=PASS; ARCHIVE_HEADER_FALSE_GREEN_FIXED_SOURCE_ONLY; PRIVATE_READER_AUTH_E2E=HOLD; RELEASE=HOLD.**
