# X500 pre-start stock reconciliation — 21 Nov 2026 (Asia/Bangkok)

## Authority, scope and safety

- Owner requested closure of the single-booking X300-first / X500-open allocation work and systematic technical-debt prevention.
- Live Google Sheet: `KK Phone rental backend`, spreadsheet ID `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`.
- This GitHub branch is a **non-production candidate**. `DEPLOY_README.txt` explicitly states repository `apps-script/Code.gs` is not currently the authoritative bound Apps Script source. Do not copy/deploy it, merge automatically, or bypass source-equivalence / independent review / exact-head CI / Preview gates.
- All live Sheets inventory writes were explicit owner-authorized, narrowly scoped, and immediately read-back verified. No customer booking, price, asset-status, owner visibility lock, transfer, LINE send or Vercel Production deployment changed during this reconciliation.

## Incident and verified evidence

1. Two newly appended active events on **2026-11-25** reported **2 X500 Pro Max + 200mm** units even though `PHONE-004` (the second X500) may only be sold from **2026-11-28**, leaving just `PHONE-003` eligible on Nov25:
   - `EVT-20261125-SHEEP-RAINY-DAY-TLEFIRSTONE`
   - `EVT-20261125-SF-FRIENDS-SCREENING-INHERIT`
2. Correct current Sheet row addresses were **3101:3106** and **3107:3112** (do not use stale earlier row references). In each group, five `09_Web_Packages!M` formula cells used the older 3195-character unguarded formula; the final phone-only row `M3106` / `M3112` already held the valid 3741-character pre-start guard.
3. Applied 10 guarded source-equivalent formulas from `M3106` to `M3101:M3105` and `M3107:M3111`, preserving prices, bookings and owner locks. All 12 `M` formulas now include `PHONE-004` / cutoff `20261128`.
4. Readback:
   - Two X500 + 200mm packages: `available_count` **2 → 1 each**.
   - Two X500 + 400mm packages: `available_count=1` remains valid, sharing the same one X500 handset with 200mm and phone-only options, **not independent concurrent capacity**.
   - `08_Web_Ready` rows **522–523**, `available_phone_count` **3 → 2**, `action_for_web=show`.
   - Live public `https://kk-phone-rental.vercel.app/api/kk-data?sheet=09_Web_Packages&range=A4%3AN` and event API both returned corrected data.
5. Live safety health indicator in `10_Admin_Health_Check!A27:D27`: `B27=0, C27=OK` after correction. It watches *all* published X500 package rows dated **21–27 Nov 2026** for `available_count>1`, including appended rows. **Detection only:** this is not an atomic reservation guard and does not automatically block erroneous bookings.
6. Detailed live immutable-seeming owner reconciliation logs retained in `19_Booking_Reconciliation` rows **287–288**.

## Source-code root cause and proposed prevention

The canonical **repository** Apps Script `kkFormulaPhoneRawCount_` in `apps-script/Code.gs` previously included every available X500 asset, including `PHONE-004`, with no eligibility cutoff; later generated formulas could therefore resurrect the pre-start overcount even after a manual Sheet fix.

This candidate adds a model- and date-scoped `PHONE-004` deduction to that one pure formula builder. It subtracts the second handset **only if**:
- `D<row>="VIVO_X500_PRO_MAX"`,
- the canonical event ID's `EVT-YYYYMMDD` date is **strictly before `20261128`**,
- `PHONE-004` is actually a rentable X500 asset with `status=available` and `rentable_now=TRUE`.

The existing cross-event same-day booking holds and lens availability calculation remain untouched. The guard applies to both raw and clamped inventory formulas generated for any package type using `kkFormulaPhoneRawCount_`. A built-in Node regression test at `tests/x500-prestart-stock-generator.test.js` pins the generator syntax and both public count paths without invoking Apps Script, Google Sheets or Vercel.

**Source authority caveat:** passing this repo regression does not prove that the bound production Apps Script uses these bytes. The production Apps Script write/deployment gate in `DEPLOY_README.txt` remains blocking until independent source-equivalence and controlled release approval.

## Owner's X300-first policy and preserved exceptions

- **2026-11-22:** the only active booking (พา, `BK-20261122-002`) uses `PHONE-001` X300 as originally requested; `PHONE-003` X500 is available for one new booking, with mutually exclusive 200mm/400mm lens package options. `PHONE-002` is inactive and is never to be allocated.
- **2026-12-13:** the only active booking (เบียร์, `BK-20261213-001`) already uses `PHONE-001` X300.
- **2026-12-19:** `BK-20261219-001` (Syaz) uses `PHONE-003` X500 because it is the middle night of a linked **18–20 Dec** rental with one device/one lens; do not silently change the agreed model or split the physical custody without customer confirmation. The third-day handover and booking remain unchanged.
- The source change **does not** introduce an automated asset reassignment algorithm: this is a distinct business-write workflow with contractual constraints and release gates. Never represent the X300 preference as implemented automation.

## Verified boundaries and remaining release requirements

- **Live corrected:** Sheet formulas, two affected public API event/package responses, source-only Health Check and owner logs.
- **Review candidate only:** repository Apps Script generator fix and regression test. The commit/PR is not live Apps Script.
- **Not verified:** interactive storefront package modal and the final LINE booking click end to end. Read-only browser automation was blocked by the external testing service's insufficient wallet balance; no credits were purchased.
- **Existing unrelated QA:** seven active future booking records warn on incomplete name/contact fields; do not fabricate private customer contact to make their indicators green. PHONE-001 handover Nov21 → Nov22 requires a real return/inspection/charging check before pickup. `10_Admin_Health_Check` also reports accessory kit capacity shortfall two units, requiring physical/inventory reconciliation, not a synthetic asset entry.
- **Must pass before accepting the candidate as production safe:** source-authenticity and parity assessment; independent reviewer; targeted Node test and full applicable regression; exact-head CI and Preview readback; owner-approved Apps Script deployment with safe rollback, verified live formula generation from new event rows, no accidental price/owner-lock mutation.

This file is a cross-chat, reviewable evidence log, **not** a claim that any blocked source deployment has been completed.


## 2026-11-23 owner SOT correction — SUPERSEDES the old 28-Nov plan

**Verified native live source:** `02_Assets!A12:G12` has `PHONE-004`,
`VIVO_X500_PRO_MAX`, `available`, `rentable_now=TRUE`, and the owner-controlled
notes `PUBLIC_BOOKING_START_2026-11-22`. The second phone was activated on
**2026-11-22**, not 2026-11-28. Historic incident evidence above documents the
older plan at the time and must not be treated as current authorization.

**Verified public source sample:** the 2026-11-21 CAT EXPO X500 packages are
`full` with zero remaining; the 2026-11-22 CAT EXPO X500 +200mm and phone-only
packages show at most 2 phones, while the 400mm package shows at most the single
400mm lens. Different package choices **share** the same 2 physical X500 handsets
and must never be summed as independent capacity.

**Source-only remediation in this Draft PR:** `kkFormulaPhoneRawCount_` now
uses `phone004PublicStartYmd=20261122` in the model-specific and asset-ID-scoped
deduction. Existing same-day Booking hold and lens criteria are untouched.
`tests/x500-prestart-stock-generator.test.js` now checks the Nov 21 exclusion,
Nov 22 inclusion, absence of the stale Nov 28 delay, and shared raw/clamped
formula paths.

**Health indicator reconciliation:** `10_Admin_Health_Check!A27:D27` must
reflect the Nov 22 authorization; the old label/pre-28 predicate generates
false CHECKs on otherwise eligible Nov 22–27 stock. Editing the health
indicator is a separate, bounded spreadsheet operation with its own formula
readback; never force a green indicator by editing customer bookings or
`09_Web_Packages` generated inventory values.

**Mandatory release hold still applies:** repository `apps-script/Code.gs`
is not verified to equal the bound Production Apps Script (issue #9).
No merge, Apps Script redeploy, customer booking, asset mutation, reservation
transition, LINE provider operation or storefront release is implied by this
candidate. Source equivalence, reviewer, exact-head CI, controlled rollout
and authenticated acceptance remain required.


## 2026-11-23 verified live health repair

Owner-authorized **monitoring-only** change in the existing native source workbook,
`10_Admin_Health_Check!A27:B27,D27`, leaving `C27` intact:
- Before: label said pre-28-Nov; `B27=36` and `C27=CHECK`, all 36
  matches in the 22–26 Nov window under the now-superseded stock rule.
- New: on 21 Nov the cap is 1 PHONE-003; from 22 Nov the cap is
  2 physical X500 phones. A result is flagged only if a published
  X500 package exceeds the **applicable per-date physical handset cap**.
  Phone-only, 200mm and 400mm packages remain alternative allocations
  against one common phone pool; the 400mm lens count remains independently 1.
- Live full-range read of `09_Web_Packages!B5:J3112` counted
  **3,108 package rows**, 36 false positives under the old predicate, and
  **0** violations against corrected date-specific cap.
- Native post-write readback: `B27=0` and `C27=OK`; source asset
  `02_Assets!F12` still `PUBLIC_BOOKING_START_2026-11-22`.
  The publicly available 22-Nov CAT EXPO packages continue to show
  `X500+200mm=2`, `X500+400mm=1`, phone-only `=2`.
- No change to any customer, booking, event, prices, owner locks,
  package inventory output, Apps Script deployment or Production Vercel.

**Caveat:** This is a non-blocking health detection formula, not a
transactional reservation, nor a signed Booking/LINE acceptance. If the
asset availability date or stock count changes again, source generator
and monitoring invariant must be changed together, with re-verification.
