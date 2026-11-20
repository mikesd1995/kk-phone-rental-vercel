# KK Core Private Reader — 19-range ordered-header acceptance gate (2026-11-21 ICT)

**Scope:** Security P0 #738, current Main `ad69ffa15caa3fcaf0e14580e370433c26ba663f`. This patch is **Draft / source-only**, with zero Production, customer data, ACL, Apps Script, Booking, pricing, inventory or deployment mutations.

## Defect and reason for fix

`server/core-private-range-contract.js` previously required the configured `header` to occur *somewhere* in most Core ranges. This permitted a column-order drift (e.g., `customer_contact` and `customer_phone` swapped in `00_Master_Booking`) to pass a 19-range security acceptance probe even though downstream code relies on fixed column offsets. Public projection headers already had stricter order checks; other Core private datasets did not. **This is a pre-release fail-closed gap, not evidence of any actual customer record corruption or breach.**

## Exact implementation

1. Introduce the one canonical `CORE_HEADER_ORDER` mapping for 13 Core tabs, based on owner-connected **header-only** readbacks dated 2026-11-21 (no booking data rows). Each of the 19 existing `RANGE_SPECS` now acquires a versioned ordered prefix without adding a second range registry or changing data consumers.
2. `schemaResult` rejects missing, reordered, renamed, extra-named or shifted header columns with the fixed, non-sensitive `PRIVATE_SCHEMA_INVALID` classification. Blank trailing cells are allowed only for intentionally wider read ranges such as `01_Events!A4:Z` and `13_Event_Archive!A1:Z`.
3. Preserve the existing `09_Web_Packages` `package_note`/ `web_note` compatibility exception at field 12; preserve no-leak result formatting, the 4,000-row bound, 19-range reader contract, client public projection and fail-closed/private key requirements.
4. Add two existing-suite regression tests for all 19 datasets, including a deliberately swapped contact/phone column and confidential synthetic data that must **not** appear in preflight diagnostics.

## Verification / release gates

Expected local commands on **exact proposed SHA**:
```bash
node --test tests/core-private-cutover-preflight.test.js tests/core-private-range-contract.test.js tests/core-apps-script-private-reader.test.js tests/core-sheet-privacy-cutover.test.js
npm run check
npm test
```
If one named test does not exist, select the current exact tests via `npm run code:test`; do not treat a missing test as a PASS.

**Not yet accepted:** CI on exact head, independent Reviewer, owner-approved Apps Script release, `KK_CORE_PRIVATE_READ_KEY` and `KK_CORE_PRIVATE_TRANSPORT` provisioning, 19/19 authenticated Core reads, Admin/LINE/Booking parity, source-private API readback, client browser QA after switch, or Core `anyone/reader` permission revoke. Existing Production still reports `public-gviz-fallback`; no zero-downtime migration until these gates pass.

## Rollback / blast radius

- The current Production flag `KK_CORE_SHEET_REQUIRE_PRIVATE` remains OFF. This is a validation-only change in the preflight contract; it does not alter existing public data feeds or require a deployment to protect customers.
- If an authorized private probe rejects changed real headers, stop the cutover, inspect owner Core schema and update the versioned contract under review; **never** weaken the check, alter booked rows automatically or revoke public access first.
- Roll back by reverting only this PR's source/test changes; no external state was written.

## Cross-chat state

- Event visibility booking-date policy separately verified on live Chrome 390px and 1440px, 12/12 expected cards, 0 extras; 46 unrelated events hidden+owner-locked, two Happy BUSDAY exceptions, 0 production customer writes. Evidence #713.
- Private security P0 remains #738; old PR #739 is diverged and draft (137 ahead/97 behind versus current main on 2026-11-21). **Do not merge #739 blindly.**
- This branch is intentionally a minimal rebase-free change against current main to avoid carrying stale booking, LINE, pricing, visual or release diffs.
