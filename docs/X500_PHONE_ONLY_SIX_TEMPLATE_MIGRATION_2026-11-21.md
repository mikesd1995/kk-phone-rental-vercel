# KK Phone Rental — Vivo X500 Pro Max phone-only / six-template migration

Date: 2026-11-21 · Change request: owner-authorized; **NOT PRODUCTION RELEASED**.

## Problem

The public storefront reads `09_Web_Packages!A4:N`. Only five master
`03_Packages` templates exist; none represent
`TPL-VIVO-X500-PRO-MAX-PHONE` (model `VIVO_X500_PRO_MAX`,
type `phone_only`, lens `NONE`).
All **108 visible future event-day cards** have two X500 lens bundles but no
bare X500. This is a data-schema failure, not an out-of-stock or UI sorting issue.

**Do not append the sixth template on the live Core sheet by itself.**
The old `09_Web_Packages` uses `QUOTIENT(ROW()-5, COUNTA(03_Packages))`
and `MOD(ROW()-5, COUNTA(03_Packages))` in its live formulas.
Adding one master row without migrating every output formula remaps historical
events, prices, package identities, stock and owner visibility locks.

## Real migration rehearsal — completely isolated workbook

Source (production, untouched):
`12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`

Private QA workbook (never connected to the production storefront):
`181He3OqUtnkzqA3U3JTllpDG6fSeMNyZA0xGbKEQB3g`

In the QA copy:

1. Saved **2,550 nonblank V1 package rows** to hidden
   `_X500_V1_BASELINE_READONLY`: package ID, event ID, price, availability,
   status and raw availability.
2. Found **518 event slots**, of which 510 have real event IDs and eight are
   deliberately empty. The blank slots must remain in the Cartesian generator:
   removing them shifts event associations.
3. Expanded `09_Web_Packages` to **3,112 grid rows** (header 4 + 518×6).
   Replicated the canonical generic row-5 formulas A:N with adjusted references
   over rows 6:3112. This preserves dynamic event IDs, model names, owner locks,
   package status and shared-stock calculation.
4. Added new active master template at `03_Packages!A10:J10`:
   `TPL-VIVO-X500-PRO-MAX-PHONE`, `VIVO_X500_PRO_MAX`,
   `phone_only`, `NONE`, base 890 THB, sort order 35.
5. Replaced the derived H column in QA with *exact published pre-cutover*
   numeric list prices for all 2,550 old package IDs, plus per-class owner
   prices for the sixth product. The direct admin per-event Override writer
   continues to own future price changes. **Never bulk reset nonblank H prices**
   during a repair.
6. Added 108 X500 bare Override rows for visible future events, with
   `active_override=FALSE` for the three existing owner-hidden X500 package
   events: RUNAWAY, BUY MY BOSS, SINEHA (29 Nov).
7. Validation of the QA copy:
   - **Old package IDs retained:** 2550/2550
   - **Old list prices retained:** 2550/2550; 0 differences
   - **Old package statuses retained:** 2550/2550; 0 differences
   - **Old raw/available stock counts:** 2548/2550 unchanged;
     two intentional **safety corrections** in X500+200mm for SHEEP × Rainy Day
     and SF Friends Screening, both 25 Nov. Legacy M formulas incorrectly
     counted PHONE-004 before its start on **28 Nov** (2 instead of 1).
   - **New bare X500 rows:** 108/108 visible future event IDs
   - **New bare X500 bookable:** 104 events, with four full/owner-hidden
   - **Formula #REF/#ERROR/#VALUE failures:** zero in QA 09 output
   - New CAT EXPO 22 Nov phone-only: **1090 THB**, count 1, available.
   - New mass bare floor: 1290 THB, with event-specific higher rates when
     supported by the pre-existing bundle price: e.g. BTS 3/5 Dec 1690,
     STARLYMPICS 28 Nov 1390.
   - X300 and both X500 bundle prices remain as published at cutover.
8. Production API remained on source workbook during rehearsal; **zero
   production changes** were made by this migration test.

## Code changes on migration branch

`apps-script/Code.gs`:

- Preserve exact selected `TPL-...` ID in private booking note via
  `[KK_TEMPLATE:...]`; strip marker in customer/staff display.
- During pending LINE booking transition to `prepared`, resolve the exact
  template, rather than selecting the first `phone_only` template (X300).
- Shared phone-stock formula uses booking AJ/AL model hints, unknown-model holds,
  and PHONE-004's 2026-11-28 eligibility. Phone-only consumes the SAME X500 pool
  as the two lens bundles.
- Pending booking price resolves the model from the template marker when the
  physical phone ID is not yet set; avoids a 0-THB quote.
- Price and override lookup ranges cover the entire six-template feed and
  all current override rows, not only rows 5:1000.
- Price repair only fills blank H cells and **does not overwrite any nonblank
  per-event published price**.

Regression tests in `tests/x500-phone-only-*.test.js` cover wrong-model
allocation, note privacy, price range, fixed-date stock, and preservation.

## Release gating: hard STOP until all pass

1. Run `npm run code:context -- "X500 phone-only six-template booking migration"`
   and `npm run code:test -- "X500 phone-only six-template booking migration"`
   on an authenticated checkout; run `npm run check` and `npm test`.
2. Independent reviewer validates code, data migrations, sample reservations,
   pricing and security invariants. Mandatory registered
   `kk-storefront-ux-reviewer` `storefront_ux_review` and
   `storefront_visual_qa` with mobile and desktop screenshots.
3. Deploy the fixed Apps Script backend first using its governed versioned
   deployment process. Verify exact deployed version, new template marker
   handling, `pending→prepared` asset choice, and package-bookability check
   against a private test dataset; do not upgrade live backend blindly.
4. Re-run source snapshots and compare against rehearsal source revision.
   Abort on divergent booked reservations, changed package statuses, owner
   locks, missing source events, or unexpected schema.
5. Execute six-template mutation in one validated migration using the
   `copyPaste`/master/Override/H snapshot procedure *only* after independent
   acceptance and a verified rollback backup.
6. Re-read **all** old price/status/stock rows and all 108 new bare rows;
   verify exact CAT EXPO rate and start-date stock restrictions.
7. Perform production unauthenticated `/api/kk-data` readback and live
   responsive storefront card + LINE booking handoff checks.
8. Merge/deploy only after reviewer, exact-head CI, acceptance and rollback
   evidence. If any gate fails, leave Production unchanged.

## Reversal

The initial rehearsal is not a Production mutation; it can simply be discarded.
For eventual production, retain the original 5-template full workbook revision
with a verified owner-controlled backup and restore through an explicit
rollback process. Never delete or alter confirmed bookings to make a migration
pass.

Tracked in [Issue #882](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/882).
