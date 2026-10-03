# Storefront V6.11 — Real-device visual polish

Date: 2026-10-03
Base production: `5e30f41a73de6385c791a06294ddaa7853330638`
Branch: `fix/storefront-v611-real-device-polish-20261003`

## Evidence
Owner-supplied iPhone Safari screenshots covered:
- Thai / English
- Light / Dark
- top-of-page discovery flow
- first catalogue rows

The screenshots confirmed V6.10 restored complete card information, but exposed remaining mobile visual debt that source-only review did not establish.

## Findings
1. Header + hero + benefit proof occupied too much of the first mobile fold.
2. Benefit copy wrapped with inconsistent rhythm.
3. Search/filter controls were visually heavier than the catalogue they serve.
4. Clear-filter action consumed too much visual space.
5. Catalogue heading hierarchy was oversized relative to poster cards.
6. Card microtypography and CTA density varied between TH/EN.
7. Light/dark surfaces needed closer parity.
8. The black circular control visible at the left edge is not present in storefront source selectors/markup; no speculative storefront CSS was added to hide an unidentified external/browser overlay.

## Implemented V6.11
- tightened 360–700px header and hero proportions while retaining readable copy and large actions
- reduced hero image dominance and first-fold vertical cost
- normalized 2x2 benefit rows and icon/text rhythm
- reduced search/filter visual weight while retaining Safari-safe 16px search/select text
- made clear-filter treatment visually quiet
- tightened catalogue heading and timestamp hierarchy
- normalized card radius, gutters, badge, title, venue, price, availability and CTA rhythm
- kept CTA at 44px minimum height
- added 390–430px card gutter calibration
- added narrow-phone fallback and dark-theme parity
- advanced stylesheet cache marker to `20261003-v611-real-device-polish`

## Preserved invariants
No change to:
- event visibility
- pricing
- inventory / availability calculation
- booking status
- LINE destination or booking payload
- API / Make / Google Sheets
- production-write behavior
- modal scroll restoration logic

## Acceptance required before production
- rendered mobile widths 320 / 360 / 390 / 430
- TH + EN
- light + dark
- no horizontal overflow
- all visible card commercial rows remain present
- modal open/close restores scroll position
- filter/search interactions remain usable
- no content obscured by storefront-owned fixed controls

Rollback: revert V6.11 CSS block and restore the V6.10 stylesheet cache marker.


## Pre-merge second-pass audit
A second exact-diff audit found one regression risk in the first V6.11 pass: several header/filter/hero controls had been compressed to 40–42px while the established mobile interaction invariant is 44px minimum.

Corrected before merge:
- FAQ control: 44px minimum
- theme control: 44x44px
- TH/EN controls: 44x44px
- hero primary/secondary actions: 44px minimum
- month/status filter controls: 44px minimum
- clear-filter action: 44px minimum
- card CTA remains 44px minimum

Additional verification:
- PR diff remains presentation-only: stylesheet + cache marker + this implementation record
- no JavaScript/business logic changed
- Vercel Preview for the audited head lineage is reachable and serves the V6.11 marker
- GitHub hosted workflows are currently failing before reporting any steps (`steps=null`), so those failures are not being misclassified as visual/admin assertion failures
- no PR review comments or review findings are outstanding

The branch must receive a fresh preview/check cycle after the 44px correction before production merge.


## Final invariant sweep
A selector-level cascade sweep after the second-pass audit found one additional override: the V6.11 search input still declared `min-height:42px`, even though its containing search shell remained 44px. This was corrected to 44px so the input itself and its container share the same minimum interaction height.

The final V6.11 mobile overrides now retain 44px minimum for search, FAQ, theme, language, hero actions, filters, clear-filter and card CTA.
