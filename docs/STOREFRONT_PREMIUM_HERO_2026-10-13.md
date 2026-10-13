# KK Phone Rental — Premium Homepage Hero (2026-10-13)
## Owner request
Replace the existing storefront header/hero visual with the newly designed blue premium product concept supplied in the conversation screenshot. Preserve the real business journey and mobile UX.

## Scope of this branch
- `assets/kk-hero-product-20261013.webp`: isolated product-side crop from the owner-selected generated concept; 240×170 WEBP, 4,618 bytes. **Not a whole-page screenshot.** Generated illustrative marketing artwork, not an audited literal inventory photograph.
- `assets/kk-hero-premium-20261013.css`: premium dark-navy styling only for the hero, compact 701–1100/mobile/375px rules, reduced-motion support, CTA focus still governed by V6.32 stylesheet.
- `index.html`: load the new scoped CSS last, after V6.32; existing TH/EN translation logic, FAQ and theme controls, CTA anchors, benefit grid and catalogue preserved.
- `tests/storefront-hero-premium-20261013.test.js`: new structural/image-integrity assertions.
- No modifications to pricing, inventory, bookings, event states, content API, backend, LINE/Telegram, or event poster cards.

## Pre-change evidence
Owner screenshot (2026-10-13) shows the current dark hero with marketing image text/graphics bleeding into the product panel. Existing V6.32 isolated the hero image but retained the old raster brand artwork. Target visual is the recently generated premium dark-blue split-hero with separately rendered Thai headline and blue product card.

## Safety / acceptance
- Branch from main `d6dc3bfe4cc0c4dd6fdfec407823752da0572464` (production deployment `dpl_7TYLb87ir9qNzXRtkeb49543dwVm`, READY at inspection).
- Unit/contract tests: `node --test tests/storefront-hero-editorial-contract.test.js tests/storefront-hero-premium-20261013.test.js`
- Required UX invocation: `storefront_ux_review` via registered Agent Gateway, viewport evidence and ledger. **Not executed yet; release remains blocked.**
- Required post-implementation `storefront_visual_qa`: **not executed yet; release remains blocked.**
- Required browser visual QA: viewport 320, 375, 390, 480, 768, 1100, 1440 in both themes and TH/EN; verify no overflow, tap targets, image decode, screen reader labels, CTAs and same-origin booking flow. **Not executed yet; release remains blocked.**
- Verify CI from exact PR head and independent review. No manual production write or Vercel build without gates. Hobby free-tier quota protection remains enforced; Preview deployments for non-main branches are disabled intentionally.
- Production readback required after approved merge: current main SHA must match READY deployment metadata and fetch the new CSS+image from https://kk-phone-rental.vercel.app/ with HTTP 200.

## Rollback
Remove one `index.html` stylesheet link and revert the scoped CSS/artwork commit. No business schema/data migrations.

## Status
Prepared in a feature branch for review. **Not deployed / not production-accepted.** This document is the cross-chat GitHub handoff and must be updated with exact CI/QA/deployment evidence before closing.
