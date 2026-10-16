# Storefront Hero Reference Recovery — 2026-10-16

## Owner request and production issue

Source: owner's supplied 1536x543 screenshot of intended KK Phone Rental dark-header/hero, duplicated in this conversation. Owner explicitly rejects using the original promotional banner as a live hero and requests direct production update.

Observed faulty production (owner mobile screenshot): `kk-phone-rental.vercel.app` showed a large full-page KK promotional banner in the hero art area, making hero extremely tall and pushing event discovery down. Root cause: `assets/kk-storefront-v5.css` reused `/assets/kk-brand-hero-final-20260920.png` as hero background, with conflicting `auto 130-235%` crops. Hero CSS overrides were appended several times and obscured earlier rules. The reference image has a **standalone panel of three phones on a pedestal**, not text-bearing advertising.

## Changes

- `assets/kk-hero-reference-20261016.svg`: separate image panel extracted from x=790..1354, y=88..490 of the owner-provided 1536x543 reference. Cropped image downsampled to 480x342 AVIF quality 40 and embedded in self-contained SVG. Contains only device panel, no embedded shop tagline or large lettering; identical asset shared between light and dark.
- `index.html`: real text for eyebrow and heading, actionable booking filters / how-it-works CTA unchanged, three mini service trust statements in desktop hero. Active CSS URL query bumped to `20261016-reference-art-v1`.
- `assets/kk-storefront-v5.css`: removed stale conflicting V6.32 art overrides and temporary 2026-10-16 banner-crop rules; replaced with final `Hero V7` two-column navy card, inset art, desktop trust icons, dark/light palettes, and mobile single-column layout. Hero `::before/::after` promotional graphic disabled.
- `tests/hero-reference-art-contract.test.js`: regression checks for the actual isolated asset, both CTA links, responsive/theme selectors and file format.

## Explicit safety boundaries

This change does **not** edit booking, prices, inventory, customer data, admin functions, LINE webhook, or event poster data. Promo banner file remains available for OG image/other intended use. On desktop, the existing full four-item marketing benefits row is hidden to avoid duplicating the three benefits inside the hero; on mobile, four-item benefit row remains.

## Checks and limitations

- Asset reproduced from owner's reference and rendered in local headless Chromium using SVG/embedded AVIF; three phones visible on blue platform (checked).
- GitHub fetch and structural checks passed 12/12 before added tests; SVG data base64 length 9808 equals source, all twenty FNV32 block hashes match local source.
- GitHub `Storefront Automated Visual QA` job 117050375174 for asset commit 45953a2 was **FAIL** for wider site criteria including `CARD_CONTENT_ESCAPES`, `POSTER_LETTERBOX_UNTREATED`, `MOBILE_SHEET_NOT_ANCHORED`, `NO_EVENT_CONTENT_ABOVE_FOLD`, `EVENT_DISCOVERY_TOO_LATE`, `HERO_DOMINATES_MOBILE`. No JS runtime errors in its report. Do **not** label these gates passed. Screenshot/art-director approval remains blocked until independently verified.
- Mobile 320/375/390/430 and desktop 768/1024/1440, both themes/languages, should be checked at real production with SVG rendering and navigation before closing.

## Continuation / rollback

Branch: `fix/hero-theme-parity-20261016`. PR #754. Use the latest branch head as the production deploy SHA only after verifying the exact source. If image appears blank on any browser, the AVIF inside SVG may need conversion to WebP/PNG embedded SVG or a standalone raster asset. Rollback via prior ready production deployment `dpl_DDm4EKwT5DcDimgUBBE3WCuXGKh3` (commit `91866c68240f6c180fded8137ec373e9aa65268b`) if critical regressions emerge; note old version still displays bad promo-based art. No hidden production booking edits.

## Production deployment evidence (final 2026-10-16)

- Live domain: https://kk-phone-rental.vercel.app/ (alias confirmed via Vercel deployment metadata and list_deployment_aliases).
- Production deployment ID: `dpl_7GWbpMJWY4hhuYemF8DXsH4rx3eJ`; `state=READY`.
- Git source deployed exactly: `5e0686765840e813a9a8c3ff89e4a1c53039c05b` on `fix/hero-theme-parity-20261016`.
- Vercel commit status: `success`; dashboard https://vercel.com/mikesd1995s-projects/kk-phone-rental-vercel/7GWbpMJWY4hhuYemF8DXsH4rx3eJ .
- Initial attempt `dpl_E5SsKd76mCfHVUW1FgNdiXb9e5FU` failed in `npm install` because existing `tests/storefront-hero-editorial-contract.test.js` asserted the old promo banner and the hidden mobile art. Updated this regression contract to check live bilingual HTML, isolated reference art and mobile CTA targets. The corrected commit was built successfully.
- **Visual QA is not accepted**: `Storefront Automated Visual QA` run 38924769762 finished `failure`. The existing site-wide QA includes poster-card and mobile-sheet criteria beyond this hero. This deployment is live/READY but must not be represented as an independent full visual acceptance pass.
- Vercel Git deployment file-tree listing endpoint `/v6/deployments/{id}/files` returned 404 `File tree not found`; hence the published SVG was verified in GitHub and browser-rendered locally, but not fetched independently from live deployment in this run. Web inspection tool also could not open the production URL. Further validation on real iOS / Chrome is necessary to close cross-device acceptance.
- Production rollback candidate remains `dpl_DDm4EKwT5DcDimgUBBE3WCuXGKh3` but has the rejected promo-image crop. Do not treat that as visually accepted.
