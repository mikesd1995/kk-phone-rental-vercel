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

## 2026-10-16 23:16+07:00 — V8.1 mobile owner screenshot correction

**Owner-provided before evidence:** `IMG_9479.jpeg` (710×1536 iPhone screenshot) vs `D96911E5-D3D1-4556-BA59-D373CF0097A7(6).jpeg` (1536×543 desktop art direction). On production V7 the hero in a 390px CSS viewport stacked its full-width phone-art panel beneath headline/subtitle/buttons, and the four-item benefits grid remained below. This pushed event discovery far down the screen; desktop and mobile visual hierarchy differed.

**Design decision:** Mobile must be a carefully compressed version of the *same* left-copy/right-phone desktop concept, not a vertically stacked screenshot. On mobile preserve full-width headline and subtitle at top, then two CTA buttons stacked on the **left side** and the phone/pedestal illustration on the **right side**, then three compact trust icons across the card bottom. Leave the four value/offer facts below in the existing benefits grid, with compact cells to reduce scrolling; the source facts are not removed.

**Changes:**
- `assets/kk-storefront-v5.css`: added scoped `Hero V8.1` mobile grid areas `"eyebrow eyebrow" "headline headline" "description description" "actions artwork" "trust trust"`; `.v3-hero-copy { display: contents !important; }` only at <=700px; 50/50 CTA/artwork row, 44px button touch targets, 24px trust icon circles, 12px subtitle, 26–34px headline, 18px card radius, compressed benefit row; 320px safeguards at <=359px. Desktop, asset source, business logic, and catalogue unchanged.
- `index.html`: authoritative CSS cache key bumped to `20261016-hero-v81-mobile-split`.
- `tests/storefront-hero-editorial-contract.test.js`: updated CSS key contract and added regression asserting right-of-actions art, visible trust row, touch targets, and no old banner asset reintroduction.

**Local visual test (headless Chromium prototype using owner artwork, dark and light):**
- 320px: Hero 323.8px high; search starts y=507.8px.
- 375px: Hero 347.0px high; search starts y=531.0px.
- 390px: Hero 354.8px high; search starts y=538.8px.
- 430px: Hero 375.7px high; search starts y=559.7px.
- 768px and 1440px prototype renders produced no document horizontal overflow.
- Each width tested in dark and light palettes. **Caveat:** this is a representative local visual prototype, not production screenshot verification of the full stylesheet and third-party fonts.

**Deployment verified:** Vercel Production `dpl_5FjhPnH9S6mJy7cdsBJKDLa7vUKc` with `state=READY`, mapped alias `kk-phone-rental.vercel.app`; deployed Git SHA `bc1d454289b0701232186c6b9086e0b466155515`. Vercel commit status `success`. Verified separately by hostname lookup through Vercel API after deployment. No merge to main; direct Git-source production deployment of feature branch, preserving rollback version `dpl_7GWbpMJWY4hhuYemF8DXsH4rx3eJ`.

**Pending acceptance:** GitHub Storefront Automated Visual QA run `38931795401` initially in progress. Do not claim the full suite passed until it completes and screenshots are reviewed. Real iPhone Safari owner screenshot after deploy remains the reference for visual acceptance. No booking/price/customer/admin/automation writes were made.

## 2026-10-16 short-phone production acceptance supplement — V8.2

- Additional GitHub automated visual evidence from run `38931795401` on V8.1 measured **actual rendered production-branch** Hero height at 320px = 324.03125px, 375px = 346.984375px, 390px = 354.796875px, 430px = 375.671875px. These values match the local prototype within 0.1px. No JavaScript runtime errors; visual QA overall **FAIL** because of broader catalogue/old poster letterboxing and modal criteria.
- A short 320×568 viewport remained `HERO_DOMINATES_MOBILE` (hero exceeds 48% viewport) and `EVENT_DISCOVERY_TOO_LATE` (first event y≈678).
- V8.2 adds `@media(max-width:340px) and (max-height:620px)` only: compresses hero, hides explanatory subtitle and extra trust row on very short phones while **preserving both booking CTA links and owner product artwork**; reduces benefit cell height. Other phones unchanged.
- Local Playwright/Chromium prototype after adjustment: 320×568 hero ≈213.8px (previous 324px), search block y≈373.8px (previous 507.8px in 320×720 reference); 320×720 still hero 323.8px, 375×667 still 347.0px, 390×844 still 354.8px; none overflow horizontally. Verified real owner reference image appears on right alongside the CTA row, no promo wording embedded in art.
- Active stylesheet cache key: `20261016-hero-v82-shortphone`. Test `tests/storefront-hero-editorial-contract.test.js` includes short-height guard with art/buttons preserved.
- **Current live Production:** `https://kk-phone-rental.vercel.app/` → Vercel `dpl_8KJysN96g3p9FmTiHhD7bLgWBVKF`, `READY`, commit `30673affb9dbbfaf4ce5166ad1ea989734bce6aa`; verified both direct deployment lookup and domain alias lookup; Vercel commit status `success`.
- If rollback necessary, previous READY `dpl_5FjhPnH9S6mJy7cdsBJKDLa7vUKc` (V8.1, commit `bc1d454289b0701232186c6b9086e0b466155515`). No pricing, booking or user data writes in either revision.
- **Not fully visually accepted:** real iOS Safari post-deploy screenshot and site-wide GitHub QA acceptance remain pending. Do not claim a passed independent QA suite merely from Vercel READY.

## Post-deployment V8.2 independent visual QA result

GitHub Actions `Storefront Automated Visual QA` run `38932522915`, job `117079797109`, finished **FAIL** overall, but measured **real V8.2 browser-rendered layout** and confirmed the targeted short-phone improvement:
- At 320px, `hero_height_px=214` (previous V8.1 `324.03125`), `first_event_top_px=550.0625` (previous `677.78125`), and `visible_event_cards_above_fold=1` (previous `0`) in a 320×568 viewport.
- No `HERO_DOMINATES_MOBILE` and no `NO_EVENT_CONTENT_ABOVE_FOLD` findings in this latest run (both appeared on previous commit). There were no JavaScript runtime errors.
- Overall failures still report `CARD_CONTENT_ESCAPES`, `POSTER_LETTERBOX_UNTREATED`, `MOBILE_SHEET_NOT_ANCHORED`, and `EVENT_DISCOVERY_TOO_LATE` in other viewport/state combinations. These are **not resolved** by this hero-scoped change. Treat full storefront acceptance as open.
- Do not infer business conversion uplift, exact pixel match to owner desktop reference on all mobile widths, or Safari acceptance without a real-device screenshot.
