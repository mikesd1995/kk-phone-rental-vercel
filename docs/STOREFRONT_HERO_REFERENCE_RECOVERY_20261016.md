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

## 2026-10-17 — V9 owner desktop reference fidelity / mobile density

**Explicit owner feedback:** Original 1536×543 design reference `B5EDEAC1-2AE5-4A44-B40D-85C1E654E4D0(2).jpeg` is the approved desktop visual direction. The preceding iPhone screenshot `IMG_9481.png` shows Hero still too visually large, over-weighted heading/device image and duplicate benefit banners despite V8.2.

**Root issue:** V8.1 still placed a full-width headline and description above a large split CTA/image row, with a second three-item trust strip inside the Hero plus the four-item benefits grid below. This needlessly pushed browse and available-event inventory down the viewport. Repeated media-query overrides also made corrections hard to reason about.

**V9 corrective changes:**
- Authoritative CSS `assets/kk-storefront-v5.css`: removed V8.1/V8.2 tail overrides entirely and replaced them with a single documented mobile V9 rule. Desktop V7 2-column geometry / art panel kept intact (matches supplied desktop composition x≈220 text, x≈790 artwork at 1536 width).
- At <=700px: full-width eyebrow, 2-line headline, at-most-2-line subtitle; 50/50 row with 44px tall stacked CTA buttons left and actual 564:402 phone-art panel right; headline font clamp 23–27px; card 12–13px padding and 6px row gap. Prevent art from becoming full-width stacked banner.
- At <=700px hide only the duplicate **three-item** `.kk-hero-trust` strip. Keep all four actual commercial benefit cards (insurance/no deposit, pickup/training, Google Drive 30 days, discounts), but size them compactly 46px minimum.
- At <=359px reduce headline to 22px; <=340px AND <=620px short phone hide only subtitle, preserving booking CTA and artwork.
- `index.html` CSS cache version changed to `20261017-hero-v9-compact` so iOS Safari fetches the new stylesheet.
- `tests/storefront-hero-editorial-contract.test.js` updated to assert new desktop/compact-mobile split-art geometry, no duplicate trust strip, cache bust, and short-phone CTA retention. This is a test fix for the new intended design, not a bypass.

**Production verification:**
- GitSource branch `fix/hero-theme-parity-20261016`, commit `055ca73bbc80e1d5454e32be5d66ccd07b71e39b`.
- Vercel deployment `dpl_9XfqXHCJ3mvADnwne85bYhJ7643x`, `READY`.
- Vercel domain lookup `kk-phone-rental.vercel.app` resolves to the same READY deployment and commit. No changes to booking, customer, inventory, pricing or LINE infrastructure.
- GitHub visual QA: `38944707704` triggered. **Do not claim full visual acceptance before final result.** If full QA fails because of event cards or legacy modals, report those blockers separately; no merge/deploy of unrelated business logic.

**Rollback option:** previous ready production `dpl_8KJysN96g3p9FmTiHhD7bLgWBVKF` at `30673affb9dbbfaf4ce5166ad1ea989734bce6aa`. It had the user-rejected oversized Hero on regular iPhones.

**Known limit:** Local Chromium executable failed to complete a local screenshot attempt (DBus errors/hang) in this run, so independent pixel-level Safari acceptance cannot be claimed from local rendering. Use GitHub Actions `Storefront Automated Visual QA` Chromium screenshots and request owner screenshot only if needed; do not present guessed measurements as measured.

## V9 measured GitHub visual QA — run 38944707704, 2026-10-17

The Chromium screenshot/metrics workflow completed **FAIL** for overall website visual acceptance, not Hero contract. Job id `117121110209`, failed step `Capture screenshots, metrics and reviewer acceptance`.

**Measured first eight viewports (same visual QA harness):**
| CSS viewport width | V9 Hero height |
| --- | ---: |
| 320px (short) | 208.703125px |
| 375px | 268.5625px |
| 390px | 273.9375px |
| 430px | 278.1875px |
| 480px | 299.46875px |
| 768px | 316.59375px |
| 1024px | 393.984375px |
| 1440px | 456.625px |

**Like-for-like comparison vs V8.1 measured at 375/390/430:** 375px Hero 346.984375 → 268.5625 (−78.421875px / −22.6%), 390px 354.796875 → 273.9375 (−80.859375px / −22.8%), 430px 375.671875 → 278.1875 (−97.484375px / −25.9%). At 320 short, V8.2 already improved to 214px; V9 further shrinks it to 208.70px. **The design is demonstrably denser on normal iPhones.**

**Positive:** No `HERO_DOMINATES_MOBILE` or `NO_EVENT_CONTENT_ABOVE_FOLD` detections in V9 QA, no JavaScript runtime errors, and two event cards partially or fully visible on common 375/390/430 viewports per recorded `visible_event_cards_above_fold=2`.

**Other outstanding site-wide findings:** `CARD_CONTENT_ESCAPES` 143 occurrences, `POSTER_LETTERBOX_UNTREATED` 440, `MOBILE_SHEET_NOT_ANCHORED` 165, and `EVENT_DISCOVERY_TOO_LATE` 4 in this verbose multi-perspective report. These counts include repeated reports of the same observations across different snapshots/sections and are not necessarily that many unique defects. Leave booking/card/modal outside the Hero-only patch until individually validated. Overall `technical_visual_pass=false`, `release_ready=false`; production deployment READY is separate from design acceptance.

**Owner still to verify:** image fidelity on native iPhone Safari and final desktop art proportions. The attached image reference is not a functional demo, and no pixel-exact claim has been made.

## 2026-10-17 V9.1 editorial finishing (owner: "ยังไม่สวย แต่ใกล้เหมือนละ")

**Source of truth:** latest owner's feedback says V9 mobile/desktop structure is approximately correct but still lacks polish. Prior V9 real Chromium screenshots from GitHub Actions workflow 38944707704 examined at 390x844 dark/light and 1440x900 dark. On mobile, both blue card and art panel occupy reasonable space, but microcopy in the four commercial benefits is extremely small (~9.25px) and flat-looking; desktop primary CTA lacks the reference's white circular arrow badge, dark hero background is visually flat, and secondary CTA lacks chevron.

**Scope of V9.1:** style-only polish of existing working `Hero V9` layout, no changes to columns, title font size, image source, markup, booking logic, event cards, prices, customers, or admin. Add one short CSS tail marker `Hero V9.1` to `assets/kk-storefront-v5.css` with layered navy glow for dark mode and refined pale blue for light, scoped white circular arrow badge within the primary CTA, subtle chevron on secondary CTA, increase desktop trust microcopy to 11 / 10.5px, increase four-item benefit text from 9.25 to 10.5px at <=700px (10px <=359px), and keep mobile tap targets >=44px. Device illustration remains on right in mobile CTA/art row.

**Cache/test:** `index.html` stylesheet query now `20261017-hero-v91-polish` to force fresh iOS CSS; `tests/storefront-hero-editorial-contract.test.js` updated to demand new visual markers without changing booking CTA anchors. Pre-deploy static checks passed: balanced CSS braces, V9 mobile grid preserved, no old promo art, updated cache and test, unchanged `#content` and `#booking-journey` links.

**Verified deployment:** Vercel target Production deployment `dpl_7juWAZnGAi2Z4thzU5Z2sfYKbNhV` READY, Git commit `75ba6123efe5a5eccfd9181dc62c59840b0f5074`; independent Vercel lookup by hostname `kk-phone-rental.vercel.app` returns this same deployment as READY with public alias attached. Previous V9 deployment `dpl_9XfqXHCJ3mvADnwne85bYhJ7643x` available as a rollback candidate.

**QA:** Vercel Build/Ready is **not** full visual acceptance. GitHub Storefront Automated Visual QA run `38946598977` was triggered for this commit; result and screenshots must be checked and appended before claiming acceptance. Existing unrelated site-wide poster-card and modal problems may remain. No production data writes.

## V9.1 post-deploy screenshot review (actual GitHub artifact)

Artifact: GitHub Actions `38946598977`, artifact ID `12067030984`, ZIP `storefront-visual-qa-75ba6123efe5a5eccfd9181dc62c59840b0f5074` (3.5 MB). Inspected actual Chromium-rendered screenshots `390x844-dark.jpg`, `390x844-top.jpg` (Light), and `1440x900-dark.jpg`, comparing directly to corresponding V9 artifact `12064866480`. White circular arrow appears on primary CTA and chevron on secondary; theme-specific glow and more readable benefit labels render. Owner layout remains intact, image on right at mobile, no full-width promo banner. This is an aesthetic iteration, **not pixel-exact owner acceptance**.

Local Chromium artifact `summary.md`: `Technical result: FAIL`, `Release ready: BLOCKED`, `Art Director acceptance: BLOCKED`. Workflow API ultimately described run `38946598977` as `cancelled`; the artifact completed and contains rendered image/QA metrics, but this **must not be reported as a passed automated gate**.

Measured V9.1 hero heights: 320x568=208.703125px, 375x812=268.5625px, 390x844=273.9375px, 430x932=278.1875px, 480x932=299.46875px, 768x1024=383.59375px, 1024x768=393.984375px, 1440x900=456.625px. Common 375–430 mobile heights remain unchanged from V9; first 390px event card starts at y≈688.8, 2 event cards at least partly visible above fold. **No JavaScript runtime errors**. Existing site-wide visual findings persist for card contents, poster letterboxing, mobile sheet, and some event-discovery-first-fold cases; do not claim the overall storefront Visual QA is closed.

Vercel Production remains `dpl_7juWAZnGAi2Z4thzU5Z2sfYKbNhV` READY, Git source `75ba6123efe5a5eccfd9181dc62c59840b0f5074`; public hostname alias explicitly verified. Rollback to preceding V9 production `dpl_9XfqXHCJ3mvADnwne85bYhJ7643x` if actual iOS Safari shows a regression.

## 2026-10-17 V10.2 measured owner-reference desktop parity

**Source:** user-supplied screenshot `B5EDEAC1-2AE5-4A44-B40D-85C1E654E4D0(3).jpeg` at 1536×543px. Compared to the actual GitHub Actions Chromium capture at 1440×900 by cropping the owner's reference horizontally x=48..1488 to center-align both at viewport width 1440px. The owner explicitly said "ยังไม่เหมือนแบบนี้นะ"; this is a **measured desktop-fidelity correction**, not another mobile redesign.

**Root geometry cause (V9.1):** desktop body `.wrap` max-width 1180px and header height 72px; owner reference depicts header height≈56px and Hero 1210×456px at x=163,y=56. The older CSS left the whole Hero ≈16px below the reference and the image≈11px too far left. Fix scoped to desktop header/Hero @min-width:1380px only, preserving the 1180px catalog width and mobile Hero V9.

**V10 CSS design landmarks:**
- `.v3-header` width `calc(100% + 30px)`, margin-left `-15px`, height `56px`, left padding `22px`, right padding `20px`;
- `.kk-mock-hero` width +30px, x-offset -15px, height `456px`, grid `minmax(0,1fr) minmax(0,564px)`, gap `24px`, padding `32px 18px 24px 56px`;
- artwork panel width `564px`, height `400px`, x≈742,y≈89 in 1440px QA (owner target cropped x≈742,y≈88).
- Small translucent blue pedestal ribbon using pseudo-element, no duplicate shop promo art, product remains an isolated panel.

**V10.1 measured text correction (Chromium vs owner):** First headline before x=171..408 vs target 172..458, second x=174..690 vs target 174..713, subtitle x=177..582 vs target 173..680. Scoped desktop typography adjusted: `h1::first-line` 1.10em / 0 letter-spacing, other line -0.02em, subtitle 16px, CTA widths 209px/145px, desktop brand 18px. Thai primary label changed to exact reference `เลือกงานที่ต้องการ` in `index.html` and `script.js` i18n; English now `Choose your event`. Booking anchor `#content` remains unchanged.

**V10.2 final pixel alignment:** Owner CTA contains an inline standalone `→` before the white circular `→` chip; both implemented as separate accessible decorative spans, with the inline arrow hidden only at <=700px to prevent mobile CTA overflow. Desktop copy group translated up 5px, primary CTA gap adjusted to 5px. CSS chrome selectors target `.kk-hero-arrow-chip` explicitly. HTML, script and regression test updated. CSS cache `20261017-hero-v102-align`. No alterations to catalogue data, prices, booking, customers, LINE, admin, permissions or automations.

**Actual post-deploy Chromium screenshot evidence:** GitHub Actions run `38951948865`, job `117145499996`, artifact `12068153634`, archive `storefront-visual-qa-44de0066f0c7edd59e153b2d31c22d65b84de5af`. Inspected `1440x900-dark.jpg`, `390x844-dark.jpg` and compared `1440x900-dark.jpg` against owner cropped reference.
- First headline text bright-pixel bounds: target x=172..458,y=174..225; V10.2 x=171..452,y=174..225.
- Second headline: target x=174..713,y=238..288; V10.2 x=174..715,y=237..288.
- Subtitle: target x=173..680,y=312..323; V10.2 x=174..686,y=313..324.
- CTA text bright-pixel region: target y=364..387; V10.2 y=365..389.
- Product artwork: QA image x≈742..1306 and y≈89..489, matching target x≈742..1306 and y≈88..488.
- Whole Hero pixel mean absolute RGB error (reference-cropped region x=115..1325,y=56..512) improved from V10.1 **17.78** to V10.2 **14.69** (relative decrease≈17.4%). Artwork itself had very small region error≈6.77. This is a screenshot-comparison metric, **not a claim of exact pixel-perfect equality**; antialiasing, fonts, background effects differ.
- 390x844 Dark screenshot remains usable: compact side-by-side CTA/product, insurance/benefit cards below, visible search/filter and event-card start; no reintroduced promo full-width image.

**Build/retry evidence:**
- Initial V10 build `dpl_9LvjwXdFZzR71VJeUac2qhLtHuci` failed: V9.1 test scanned V10 grid despite claiming to test V9.1 only. Fixed tests to slice V9.1 CSS marker range.
- Initial V10.1 build `dpl_68a7LpeVhhGNd6oCrzjFz2RCukex` failed due a test expecting old cache key. Updated all test version references.
- Initial V10.2 build `dpl_J5CcPYndGUM1BrYXf28VcVCWRiFN` failed because a V9.1 test expected old `span[aria-hidden=true]` selector. Updated expectation to `.kk-hero-arrow-chip`.
- All related Vercel build-contract tests passed in final V10.2 Production deployment.

**Verified live release:** `https://kk-phone-rental.vercel.app/` maps through Vercel API to deployment `dpl_5CNUZg2fyT7JGqvhegTQxG6wmcd6`, READY, exact Git commit `44de0066f0c7edd59e153b2d31c22d65b84de5af` from branch `fix/hero-theme-parity-20261016`. The earlier V10.1 READY deployment `dpl_HZcvLbyJLYZZ8X4dsrJxxyjEsTCu` is a compatible rollback candidate; V9.1 READY `dpl_7juWAZnGAi2Z4thzU5Z2sfYKbNhV` is older fallback.

**Independent QA distinction:** GitHub Actions Visual QA run `38951948865` concludes **FAIL** overall (technical_visual_pass=false, release_ready=false). QA still reports `CARD_CONTENT_ESCAPES`, `POSTER_LETTERBOX_UNTREATED`, `MOBILE_SHEET_NOT_ANCHORED`, `EVENT_DISCOVERY_TOO_LATE` on some page states; repeated counts are not unique defects. No `HERO_DOMINATES_MOBILE` or `NO_EVENT_CONTENT_ABOVE_FOLD` findings, and no JavaScript runtime errors in report. Hero geometry/image/CTA pixel alignment materially improved, but **real iPhone Safari owner acceptance and broader storefront gates remain open**. Do not merge PR #754 into main or claim all release acceptance passed on the strength of a READY deployment alone.
