# KK Phone Rental — X500 Pro Max / 400mm staged rollout (2026-11-19)

## User-approved business contract

- **Physical phones**: exactly 1 active `VIVO_X300_PRO`, 1 active `VIVO_X500_PRO_MAX`. Preserve `PHONE-001`; change `PHONE-002` to **inactive, rentable=false**, never delete or change its model: historical bookings refer to it. Add `PHONE-003` as X500.
- **Lenses**: `ZEISS_2_35X` / G1 corresponds to 200mm and can attach to either phone. Add 1 `ZEISS_400MM` lens, `LENS-005` (LENS-002 retired, LENS-004 used; verify uniqueness again at actual cutover).
- **Allowed pairings**: X300+200mm; X500+200mm; X500+400mm. Never X300+400mm, including package templates, physical assignments, admin pricing, and public feed.
- **Pricing per event**: `x500_200_price = x300_200_bundle_price(event) + 400`, `x500_400_price = x300_200_bundle_price(event) + 700`; preserve price overrides and original negotiated booking charges. Existing X300 phone-only and lens-only entries are preserved as-is unless owner later directs otherwise.
- **No implicit event visibility change**. Retain current owner-hidden and locked events.
- User authorized the owner to select *any* already-confirmed customer for X500+200; do not delete/reprice bookings.

## Current production evidence (READ-ONLY; before cutover)

`02_Assets`: PHONE-001 and PHONE-002 are active X300; LENS-001 and LENS-004 are active 200mm; LENS-002 (G2) is inactive. No X500 or 400mm physical assets currently exist. `03_Packages` has only X300 phone-only, lens-only, X300 200mm bundle.

Future active `PHONE-002` bookings require reconciliation by **booking ID and event day**, without copying customer identifiers into this repo. Owner permits choosing an existing 200mm-bundle booking for the X500+200mm device without changing any negotiated price. Do **not** leave active bookings referencing an inactive asset; check same-day collisions and verify each affected booking from the live authorized source immediately before cutover.

## Hard migration hazard

`09_Web_Packages` A:G/K/L/N use INDEX/MOD/QUOTIENT keyed to `COUNTA('03_Packages'!A5:A)`. Adding template rows changes template count from **3 to 5** for **every** public event: previously generated rows rebind to different events/templates and hardcoded or event-overridden H prices can be mismatched. Google Sheets `09_Web_Packages` currently has 1552 rows; the current auto-repair in Code.gs only covers rows 5–1000. **Do not append new active package templates to Production before the source formula expansion/migration and a full public-feed QA plan are accepted.** This is a release blocker.

## Governed cutover plan (no actions below have been performed in Production)

1. Take readback snapshot of `02_Assets`, `Model_Master`, `03_Packages`, future active `00_Master_Booking`, `04_Event_Overrides`, full generated `09_Web_Packages`, and public feed. Record row counts, IDs, prices, bookings, owner locks.
2. Land/deploy the Apps Script compatibility + model-stock patch to the actual backend **only after owner release gates, independent reviewer approval, passing CI and preview UX/visual QA**. The committed repo copy by itself does not deploy Apps Script.
3. Under the governed write lock, insert Model_Master rows for `VIVO_X500_PRO_MAX` and `ZEISS_400MM`, create asset rows `PHONE-003`, `LENS-005`, and prepare `PHONE-002` retirement. Confirm no existing rows use those new IDs; never guess serial numbers.
4. Reconcile future confirmed bookings formerly assigned PHONE-002. For one owner-approved existing X500+200mm bundle booking selected at cutover, preserve event, negotiated price and original 200mm lens. For other future reservations, do an exact-date audit, preserve customer contract, and document any physical device substitution. Stop if any date has a capacity conflict.
5. Add exactly two package templates for X500+200 and X500+400, both `phone_lens_bundle` and model `VIVO_X500_PRO_MAX`. The public/generated package grid needs 5 rows per event, not 3. Plan sufficient Google Sheets rows and formula generations first. Preserve overridden X300 H prices and apply per-event relative X500 pricing by package ID, not row offset. Restore overridden H values from the authoritative `04_Event_Overrides` rather than carried row numbers.
6. Test complete future events after regeneration: each displays the correct X300+200, X500+200, X500+400 (subject to availability and owner locks), with no X300+400 and no double-booking; check 200mm shared lens capacity and X500 phone shared across its two lens options; test phone-only legacy and lens-only conditions.
7. Read back native sheet values, formulas and pricing; inspect real public `/api/kk-data`, mobile package modal, and LINE prefills. Verify `eventId`, `package_id`, `price`, `available_count`, `package_status`, and booking guard independently.
8. No PROD merge/deploy until gate approvals. On failure, revert only staged rollout data/code using snapshot; preserve all original bookings and owner locks.

## Implemented in this branch

- Compatibility checks for physical assets and package creation/update and public package filtering.
- Model-group-aware active reservation counts (pending/confirmed/prepared/picked_up).
- X500 per-event derived price formula (+400/+700), preserving explicit package overrides.
- Node regression fixtures in `tests/x500-pro-max-compatibility.test.js`.

**Status: CODE STAGED ONLY. Model/asset/package and production deployment not changed by this branch.**

## Isolated Google Sheets cutover rehearsal (2026-11-20; no Production write)

An owner-only private copy of the actual Core workbook was created and transformed using native Google Sheets batched writes, not synthetic fixture data. The private copy is not published and is not the live Machine SOT.

- `01_Events` has **508 populated events in 516 positional rows** (`A5:A520`, including 8 blanks). The original generated package grid has **1,548 source slots / 1,524 populated packages**. Do **not** compress blank source rows when regenerating public formulas: the existing `INDEX`/ `QUOTIENT` / `MOD` mapping is positional.
- The 5-template rehearsal regenerated **2,580 source slots** (rows `09_Web_Packages!5:2584`) and **2,540 populated package rows**: 1,524 original + 1,016 new X500 bundles. The added 200mm and 400mm bundles share exactly one X500 physical phone, not two phones.
- Registered `VIVO_X500_PRO_MAX` and `ZEISS_400MM` in `Model_Master`; registered `PHONE-003` and `LENS-005`; disabled legacy `PHONE-002` without deleting or rewriting historical data; preserved 200mm lenses `LENS-001` and `LENS-004`.
- Reconciled **10 future active** bookings from `PHONE-002` to `PHONE-003` in the isolated copy, including a pre-existing booking with the 200mm lens, preserving the original booking identity, event, charge and lens allocation. A same-day phone-ID collision scan covered all 18 active future bookings and found zero collisions.
- Column `M` now derives raw stock using model-scoped `COUNTIFS` for `00_Master_Booking!AJ:AM` with event ID day keys and counts unassigned physical model IDs conservatively. Column `I` clips negative raw stock at 0. X500+200 and X500+400 both reserve the same `PHONE-003`; 400mm cannot be paired with X300.
- Column `H` for the 3 old templates retained the original event override formula; each new X500 200/400 row directly references that **same event's X300+200mm bundle H cell** and adds exactly 400/700. This avoids circular H-column `FILTER` dependencies and preserves all manually entered old prices, which were separately checked against the canonical overrides.
- Initial rehearsal revealed **5 hidden bundle events** where a naive new-template status formula would reopen X500 options. It was corrected: new X500 `J` status inherits `hidden` from the event's existing X300+200mm bundle; otherwise it uses its own `I` stock.
- After correction, **all 1,524 original package prices were unchanged**; **508/508 event pairs** met both price deltas; **0 missing new bundle pairs**, **0 hidden-package reopenings**, **0 invalid X300+400mm pairs**, and **0 Google Sheets formula errors**. Four original availability statuses changed due to the intentional physical reduction from 2 rentable X300 phones to 1, not because their prices or visibility locks changed.
- Representative same-day cases passed: both X300 and X500 full on Nov 21 Cat Expo, X300 still available when X500 phone-only is reserved on Nov 22, and unrelated hidden events' X500 bundles stay hidden. The real storefront was not changed by this rehearsal.
- Vercel **preview** of exact PR SHA `3ba2a942e75c40283731a70ee831933ed0f5e51b` reached `READY`; targeted Booking E2E and automated visual QA completed successfully. Preview does not expose the private rehearsal copy as Production content.

## Remaining hard gates before live cutover

1. Independent code Reviewer approval on the exact implementation/head, plus real authenticated visual QA on the exact Preview; repository CI pass alone is not production acceptance.
2. Integrate the tested 5-template regeneration and `PHONE-002` future-booking reallocation into the **existing governed Apps Script write path**, using the document lock, no overlapping writers, canonical booking IDs, audit entry, backup and rollback. **Do not copy the staging sheet directly into Production through an ungoverned Sheets API write.**
3. Re-read the live Core workbook immediately before the one-shot cutover: all source event positions, prices, owner visibility locks, active bookings/asset IDs, and physical inventory may have changed since the rehearsal.
4. Deploy/activate the compatible backend only after exact-head review and release gates; read back `02_Assets`, `Model_Master`, `03_Packages`, `00_Master_Booking` and `09_Web_Packages`; verify `/api/kk-data` and public mobile modal with explicit X300+200 / X500+200 / X500+400 labels, no X300+400, correct event-specific pricing and actual availability.
5. If any cutover validation fails, preserve existing booking charge and visibility truth, hold publication, and restore the snapshot under the same governed lock.

**Live status: NOT APPLIED.** This is a tested staging rehearsal and a code/preview candidate, not proof of a production rollout.
