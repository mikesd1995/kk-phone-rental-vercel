# Storefront V6.8 Mobile Completion — Implementation Record

Date: 2026-10-03
PR: #559
Branch: `fix/storefront-mobile-finish-20261003`

## Owner-reported defect
Mobile screenshots showed the final visible event cards ending before their price / availability / CTA, followed immediately by “Show more events” and the booking journey. This made the lower storefront look clipped and unfinished.

## Implemented
- Removed mobile content/grid max-height and overflow containment that could clip card bodies.
- Restored natural card height and visible price, availability and CTA surfaces.
- Added minimum mobile information-body height so two-column cards retain a complete hierarchy.
- Tightened 360–430px spacing and typography.
- Kept the lower-page journey hierarchy compact.
- Cache-busted the authoritative storefront stylesheet to V6.8.

## Preserved invariants
No change to booking semantics, package/pricing data, inventory/availability calculation, event visibility, API contract, LINE booking payload, Make, Google Sheets, or production-write behavior.

## Verification state
The PR is mergeable at the GitHub metadata level. Automated acceptance is currently not green: Storefront Automated Visual QA, Admin Regression, and Project Memory Enforcement reported failure on the first V6.8 head. The Vercel preview also failed because the free deployment quota exceeded 100 deployments/day. Therefore no claim of rendered production acceptance is made.

The GitHub job-log blob endpoint returned 404 for these failed jobs, so the first-pass failures could not be decomposed safely from logs in this session. The implementation remains fail-closed: no merge and no production deployment until rendered acceptance evidence is available.

## Required rendered acceptance
- widths: 320 / 360 / 390 / 430 / 768
- TH and EN
- every visible card: poster, date, title, venue, price, availability, CTA
- no card clipping/overlap
- Show-more boundary does not cover card content
- sticky LINE does not obscure actionable content
- journey and footer remain readable and compact

## Rollback
Revert the V6.8 CSS completion block and restore the previous stylesheet query string in `index.html`.


## V6.9 second-pass audit
A second source-level audit found that the V6.8 emergency rule used a fixed minimum information height. That prevented clipping but could create unnecessary blank card area and did not explicitly guarantee each commercial row participated in layout. V6.9 replaces that with content-driven height.

Changes:
- card rows align to their own content rather than stretching to the tallest sibling
- information body uses natural flex-column flow; no fixed minimum card-information height
- title is bounded to three lines and venue to two lines to preserve two-column scanability
- price, availability and tap CTA are explicit visible block rows
- spacing between event catalogue, Show more and booking journey is deterministic
- cache marker advanced to `20261003-v69-mobile-catalogue-completion`

Audit notes:
- the supplied screenshots also showed mixed English/Thai states; source inspection confirms this is an intentional persisted TH/EN preference path, not hard-coded badge leakage: badge text is selected from the active i18n dictionary.
- poster failure behavior is deterministic event-summary fallback and does not substitute unrelated artwork.
- no business/data semantics changed.

Acceptance remains fail-closed until the exact V6.9 head receives fresh automated/rendered evidence.
