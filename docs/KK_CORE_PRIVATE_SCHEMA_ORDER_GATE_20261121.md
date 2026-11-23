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

## 2026-11-23 additional fail-closed provider boundary hardening

**New regression discovered:** The server's `verifiedRange()` previously accepted any syntactically valid A1 range on any alphanumeric sheet name, even if not in the 19 explicit owner-reviewed `RANGE_SPECS`. The owner Apps Script transport has its own 19-pair allowlist, but the legacy service-account transport could pass out-of-contract Core ranges to its provider. This was an unactivated latent permission-breadth defect; no demonstrated customer leak.

**Minimal diff on existing Draft PR #881:**
- `server/core-sheet-private-reader.js` now builds an exact sheet + range Set directly from the **existing shared 19-range contract**, rejects unknown/expanded/shifted ranges with the existing opaque `CORE_PRIVATE_RANGE_INVALID` before **either** Apps Script or service-account I/O. No second independently maintained list; trimming/validation still precedes key lookup.
- `tests/core-sheet-privacy-cutover.test.js` verifies all 19 accepted pairs, six syntactically valid but unauthorized probes, and asserts both `readCsv` and `readValues` never call the provider for forbidden ranges.
- `.github/workflows/core-private-range-ci.yml` triggers on these provider-boundary changes, checks exact checkout SHA, runs focused privacy tests, `npm run check`, and full Node suite. No secrets, deploy, data or permissions writes in CI.

**Real current owner-only evidence (not application-side private transport):**
- Authenticated Google source-read probes for 19/19 range prefixes succeeded. This establishes schema/data presence, **not** an active Apps Script key flow.
- Core rollback snapshot in the owner-only private Drive folder has 32/32 tabs with matching grid dimensions. Independently compared header plus first three data rows from 13/13 operational tabs; values matched. The copy is **not** a proven functional database rollback.
- Vercel production env NAME-ONLY read: dedicated `KK_CORE_PRIVATE_READ_KEY`, `KK_CORE_PRIVATE_TRANSPORT`, `KK_CORE_SHEET_REQUIRE_PRIVATE` absent. Core source still `anyone/reader`.
- Existing GAS Project authority/equivalence #9 and independent reviewer have not been proved. **Do not revoke source Core Anyone ACL or merge the Draft** before all actual private transport, wrong-key/independent read-vs-write key, Admin/Booking/LINE E2E and rollback safety gates pass.

**No production/release/secret/booking data/ACL modification in this Draft.** The source fix is intended to be read and accepted on its exact commit, independently of runtime cutover.

## 2026-11-23 W7 — runtime schema enforcement (additional pre-release hardening)

**Gap found:** Previously the exact 19-range list and ordered header validation ran in owner preflight, but did not run on each real backend read. A late schema drift (e.g. swapped `customer_contact` and `customer_phone`) could therefore affect positional Booking/Admin consumers between successful preflight and production use.

**Minimal change:** `server/core-sheet-private-reader.js` now delegates `readValues` and `readCsv` to one common `readPrivateValidatedValues` boundary. This first enforces the existing exact 19 (tab,range) allowlist, reads through the explicitly selected existing Apps Script or service-account transport, then calls the **same canonical `schemaResult` with ordered header order** used by preflight. Invalid/missing/shifted headers or excessive/incorrectly typed rows fail closed as `CORE_PRIVATE_SCHEMA_INVALID`; returned row values and Google error bodies are never logged. CSV output uses existing `privateSheets.valuesToCsv` over the already-validated display values; the previous service-account `readValuesCsv` was itself only `valuesToCsv(await readValues(...))`, so response encoding is unchanged.

**Tests:** `tests/core-sheet-privacy-cutover.test.js` now tests 19 approved pairs, six unauthorized ranges before provider I/O, runtime valid Booking header, and explicit contact/phone column swap rejection on **both CSV and values paths**. `tests/core-apps-script-private-reader.test.js` tests the same runtime failure under Apps Script transport. Existing `tests/admin-sheet-fallback-private-reader.test.js` rotation-cache test was updated to emit a complete synthetic ordered header instead of its previous one-column stub; cache identity and key-rotation semantics are preserved and must pass full regression. The focused CI workflow now tracks that test file too.

**Runtime/Release hold remains unchanged:** No Production deployment or customer data/ACL writes in W7. Live owner's bound Apps Script source and Script Properties remain unverified due missing Apps Script-specific authority, Make connection discovery tool errors and inaccessible extension browser. Do **not** merge Draft #881 or revoke Core Anyone Reader on green CI alone. Require independent reviewer, signed owner E2E for 19/19 actual private reads + wrong-key tests, Booking/LINE/Admin parity, rollback dry-run, then separate ACL readback.
