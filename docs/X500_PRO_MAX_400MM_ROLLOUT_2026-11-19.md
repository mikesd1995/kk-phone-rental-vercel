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

Future active `PHONE-002` bookings observed: Nov20 Jan; Nov21 Nook; Nov22 Pha; Nov28 Syaz; Dec18/19/20 Syaz. Owner may choose **Nov21 Nook** for the X500+200mm bundle, with no charge change. Other future reservations using PHONE-002 require reconciliation to an available active physical phone; do **not** leave any active booking referencing an inactive asset after cutover, and check same-day physical clashes.

## Hard migration hazard

`09_Web_Packages` A:G/K/L/N use INDEX/MOD/QUOTIENT keyed to `COUNTA('03_Packages'!A5:A)`. Adding template rows changes template count from **3 to 5** for **every** public event: previously generated rows rebind to different events/templates and hardcoded or event-overridden H prices can be mismatched. Google Sheets `09_Web_Packages` currently has 1552 rows; the current auto-repair in Code.gs only covers rows 5–1000. **Do not append new active package templates to Production before the source formula expansion/migration and a full public-feed QA plan are accepted.** This is a release blocker.

## Governed cutover plan (no actions below have been performed in Production)

1. Take readback snapshot of `02_Assets`, `Model_Master`, `03_Packages`, future active `00_Master_Booking`, `04_Event_Overrides`, full generated `09_Web_Packages`, and public feed. Record row counts, IDs, prices, bookings, owner locks.
2. Land/deploy the Apps Script compatibility + model-stock patch to the actual backend **only after owner release gates, independent reviewer approval, passing CI and preview UX/visual QA**. The committed repo copy by itself does not deploy Apps Script.
3. Under the governed write lock, insert Model_Master rows for `VIVO_X500_PRO_MAX` and `ZEISS_400MM`, create asset rows `PHONE-003`, `LENS-005`, and prepare `PHONE-002` retirement. Confirm no existing rows use those new IDs; never guess serial numbers.
4. Reconcile future confirmed bookings formerly assigned PHONE-002. For the owner-approved selected X500+200mm customer (Nov21 Nook if still valid at cutover), preserve event, negotiated price and original 200mm lens. For other future reservations, do an exact-date audit, preserve customer contract, and document any physical device substitution. Stop if any date has a capacity conflict.
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