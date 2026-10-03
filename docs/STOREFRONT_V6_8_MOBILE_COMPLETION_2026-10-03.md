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


## V6.10 final mobile polish
The third audit pass addressed remaining small-screen UX debt rather than changing the catalogue architecture.

Implemented:
- raised customer-facing microcopy that had fallen to 8–10px into a more readable mobile range
- preserved 44px minimum action targets for card CTA, filters, modal close/share and clear-filter controls
- made the narrow filter row horizontally recoverable below 360px instead of compressing labels into unusable widths
- added deterministic scroll margin and lower-page spacing around booking journey / divider / LINE CTA
- constrained mobile bottom sheets with `dvh`, internal scrolling, overscroll containment and iPhone safe-area clearance
- added narrow-width 320–359px spacing treatment
- advanced the presentation marker to `20261003-v610-final-mobile-polish`

Unchanged invariants:
pricing, availability calculation, booking status, event visibility, inventory, LINE destination/payload, APIs, Make, Google Sheets and production-write behavior.

Fresh exact-head rendered acceptance remains mandatory before merge. Source-level completion is not represented as production visual acceptance.


## Exact-head acceptance attempt 2 — 2026-10-03
Head: `f62ab79bc71a530cdb7b107db07f11f2a0ee0f09`

The failed jobs were rerun in-place rather than creating new deployment work:
- Storefront Automated Visual QA `37053843185`, attempt 2: failure
- Admin Regression `37053843202`, attempt 2: failure
- Project Memory Enforcement `37053843282`, attempt 2: failure

All three attempt-2 jobs terminated in roughly 2–3 seconds with **zero reported steps**. The GitHub Actions job API exposes no executed step and the runs expose no artifacts. This failure shape occurs before the repository test/visual commands can provide normal test evidence; it is therefore recorded as an execution/runner-level acceptance blocker, not as evidence that V6.10 rendered incorrectly or that an Admin test assertion failed.

No speculative source change was made in response. Merge/deploy remains fail-closed. Production writes remain zero.


## Fallback source-level acceptance — 2026-10-03
A new exact-head run on `d4efddb64a06a55967e7cfd5167797bf1f066a93` reproduced the same pre-step failure shape:
- Visual QA `37099776141`: failure, job steps null
- Admin Regression `37099776106`: failure, job steps null
- Project Memory Enforcement `37099776200`: failure, job steps null

Because hosted Actions still produced no executable steps, a read-only source-level fallback audit was performed against the branch. Confirmed:
- V6.10 cache marker is loaded by index
- Safari search input remains 16px
- card focus-visible treatment exists
- reduced-motion handling exists
- iPhone safe-area handling exists
- bottom sheet uses bounded dvh height and internal scrolling
- sub-360px filter recovery exists
- price / availability / tap CTA are explicitly restored as visible block rows
- TH/EN `badge_soon` strings both exist
- render path still emits commercial metadata, availability and CTA rows

This fallback validates source invariants only; it does not substitute for rendered screenshots or successful hosted CI. No further presentation mutation was justified by the evidence. Merge/deploy remains blocked until executable rendered acceptance is available.
