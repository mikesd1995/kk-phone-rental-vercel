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
