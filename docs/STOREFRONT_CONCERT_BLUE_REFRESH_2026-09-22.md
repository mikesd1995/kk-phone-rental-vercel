# Storefront Concert Blue Refresh — 2026-09-22

## Scope
Visual-only refresh of the public KK Phone Rental storefront to match the user-supplied concert-blue header artwork.

Target storefront:
- `https://kk-phone-rental.vercel.app/?q=bts`

Explicitly out of scope:
- booking logic and LINE booking flow
- pricing and package rules
- event/query filtering behavior, including `?q=bts`
- public/private data sources and `/api/kk-data`
- admin, Apps Script, scanner, verifier, canary, CRM, inventory, and production routing

## Source artwork and optimized web asset
- Source artwork: user-supplied PNG, 2048×682, 2,454,018 bytes.
- Storefront asset: `assets/kk-brand-hero-concert-blue-20260922.avif`
- Storefront asset dimensions: 900×300.
- Storefront asset size: 17,669 bytes.
- Asset SHA-256: `e78b014dc58ac19f37484fc121e912102596abd73cdfcef6a30bf7f7d2b64c7f`
- Size reduction versus the supplied PNG: ~99.28%.
- The storefront caps the hero at 900 px so the optimized asset is not intentionally upscaled on desktop.

## Visual system
Primary storefront palette:
- Electric blue: `#0A76F8`
- Strong blue: `#0868DE`
- Deep blue: `#18428D`
- Bright cyan: `#43A1FD`
- Light cyan: `#95CEFD`
- Ice blue: `#C7E5FD`
- White: `#FEFEFE`
- Navy text: `#102A5C`
- Body text: `#17345E`

The previous violet-heavy accents are neutralized to cyan/blue. LINE actions intentionally remain LINE green for channel recognition.

## Files changed
### `assets/kk-brand-hero-concert-blue-20260922.avif`
Added the optimized header artwork.

### `index.html`
- Switched the visible hero/header to the new AVIF asset.
- Added intrinsic `width=900` and `height=300` to reduce layout shift.
- Updated the image preload to AVIF.
- Updated the browser theme color to `#0A76F8`.
- Bumped the stylesheet cache key to `concert-blue-refresh-20260922`.
- Kept the existing PNG Open Graph/Twitter image for crawler compatibility.

### `config.js`
- Updated `KK_CONFIG.headerImage` to the new concert-blue hero URL.
- No public-data or API guard behavior changed.

### `style.css`
Appended an isolated final override block:
`KK PHONE RENTAL — CONCERT BLUE HEADER MATCH 2026-09-22`

The override aligns:
- page background and ambient glow
- hero frame
- value box
- quick links and language switch
- search field
- filters and active states
- section headings
- event cards and CTA buttons
- skeleton/empty states
- footer
- modal/FAQ surfaces
- focus-visible accessibility ring
- mobile hero radius/shadow

## Safety / behavior preservation
No JavaScript business logic was modified.
No package, event, pricing, booking, inventory, API, admin, scanner, or data-source code was modified.

## Rollback
Revert the storefront refresh commits or restore:
- the prior hero path `/assets/kk-brand-hero-final-20260920.png`
- the prior `config.js` headerImage
- remove the final concert-blue CSS override block

## Delivery status
Work is isolated on branch:
`storefront-concert-blue-refresh-20260922`

Production is intentionally unchanged until explicit approval to merge/deploy.
