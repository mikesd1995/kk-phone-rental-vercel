# Same-day inventory normalization — 2026-09-28

## Incident
Public storefront showed two phones available for ATOM PARIYA BIRTHDAY PARTY 2026 “SLAY DOWN” on 23/10/2026 even though a confirmed LYKN booking on the same date already reserved one phone and one lens.

## Root cause
The stock formula compared raw event-date cells. Older rows used native Google Sheets date serials, while 23 later-created event rows used dd/mm/yyyy text. For example:
- LYKN 23/10/2026 date cell = native serial 46318
- ATOM 23/10/2026 date cell = text "23/10/2026"

Those values display as the same date but are not equal in formula comparisons, so same-day bookings were not deducted from text-date events.

## Data repair
Converted 23 text-date event rows (01_Events rows 157–179) to native DATE values with dd/mm/yyyy display formatting.

Affected dates span 28/09/2026 through 30/10/2026.

Before repair, five current stock mismatches were confirmed:
- ATOM PARIYA BIRTHDAY PARTY 2026 “SLAY DOWN” — 23/10/2026
- NEXORA CARD FEST — 24/10/2026
- LEO PRESENTS SCREAM FEST กรุงเทพ 2026 — 24/10/2026
- LANDOKMAI YESTERDAY’S TOWN ALBUM RELEASE CONCERT — 24/10/2026
- DICE ALBUM CONCERT by CAT ALBUM — 24/10/2026

After repair, current same-day stock mismatch count = 0.

## Live formula hardening
09_Web_Packages columns I and M now reserve stock by the YYYYMMDD date key embedded in event_id rather than raw date-cell equality.

All current 01_Events IDs follow EVT-YYYYMMDD-* (174/174 checked), so the live stock rule is type-independent:
- booking date key: MID(00_Master_Booking!event_id, 5, 8)
- candidate event date key: MID(09_Web_Packages!event_id, 5, 8)

This means a native date cell and a dd/mm/yyyy text cell can no longer create false extra inventory for the same calendar day.

## Canonical backend hardening
apps-script/Code.gs now:
- uses event-id day keys in kkFormulaActiveBookingCount_;
- applies the same rule to both phone and lens reservation counts;
- explicitly parses dd/mm/yyyy in kkDateObj_;
- bumps KK_LENS_COMPAT_PATCH_VERSION to v16.7.0_PHASE3_9_5_11_SAME_DAY_INVENTORY_20260928 so future repair/install restores the hardened formulas.

Regression coverage: tests/same-day-inventory-date-normalization.test.js

## Acceptance
ATOM 23/10 now reads:
- available_phone_count = 1
- available_lens_count = 1
- phone-only package = 1 available
- bundle package = 1 available
- lens-only remains hidden under the separate lens-only policy

24/10 events sharing the confirmed LYKN booking date now also show one phone / one bundle available instead of two.

Lens-only policy remained intact: only BTS 03/12 and 05/12 are available as standalone lens rentals.

## Safety
No booking record, customer record, price, asset quantity, event visibility, or booking status was changed. The repair only normalized event date cell types and hardened stock-reservation formulas.
