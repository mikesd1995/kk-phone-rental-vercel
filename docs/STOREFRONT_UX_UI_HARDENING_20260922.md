# Storefront UX/UI Hardening — 2026-09-22

## Scope
Customer-facing storefront only. No pricing rules, booking logic, data source, admin, scanner, or production policy changes.

## Changes
1. Compressed the above-the-fold area so event cards appear sooner.
2. Added venue and truthful starting package price to each event card.
3. Added persistent event-result count and an explicit Clear Filters control.
4. Added a dedicated low-stock state when exactly one unit remains.
5. Improved very narrow mobile layouts by switching to one event card per row at <=360px.
6. Added mobile safe-area handling for the sticky LINE CTA.
7. Disabled fixed background behavior on mobile for smoother scrolling.
8. Cache-busted the updated storefront JS/theme assets.
9. Added regression tests covering the new UX contract.

## UX rationale
- Reduce decision friction before opening the package modal.
- Make filter state visible and reversible.
- Surface scarcity without relying only on text.
- Preserve readability on narrow devices.
- Keep the LINE conversion action visually distinct and safely tappable.

## Files changed
- index.html
- script.js
- assets/kk-concert-blue-theme-20260922.css
- tests/storefront-ux-ui-20260922.test.js
- docs/STOREFRONT_UX_UI_HARDENING_20260922.md

## Rollback
Revert the PR/commit that introduces this hardening. The previous Concert Blue theme remains independently versioned and can continue without the UX additions.

## Deployment note
At implementation time, Vercel preview/production deployment may be rate-limited by the account's daily deployment quota. GitHub CI remains the primary validation gate until a preview becomes available.
