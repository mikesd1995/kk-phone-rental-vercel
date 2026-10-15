# KK Phone Rental — Production Storefront P0 QA and release evidence (13 Oct 2026)

## Scope and acceptance boundaries

Requested by owner: **real Production E2E** for mobile and desktop, TH/EN, Dark/Light, search, live package pricing, temporary event imagery, LINE OA booking CTA, effective owner-hidden events, and booking-day locks. This record deliberately distinguishes (A) HTTPS responses and Google Sheets reconciliation, (B) hosted Node contract regression, and (C) true browser-rendered/customer-action E2E.

**Do not claim (C) complete** without Chrome/Safari screenshots, actual evaluated DOM, decoded image pixels, network/error log, modal and LINE app handoff evidence. No actual LINE messages, test bookings, changed prices, modified owner visibility, paid browser agents or manual checkout were performed.

## Production baseline, authenticated and public readbacks

- Real current Production alias: `https://kk-phone-rental.vercel.app/`, Vercel **READY** deployment `dpl_B4NFKuic55jMVHfXUXcp6tD9Yigz`, main SHA **`7503add3f51b385a71f46c880fa3c756b84a3669`**. Its source `script.js` has exact-event fallback art, first-party KK temporary-image badges, Thai/EN screen-reader labels, Search, theme and language toggles, and event status allowlist. PR #704 providing temporary artwork was already merged before this audit.
- Read-only public homepage fetch **succeeded**; metadata includes responsive viewport `width=device-width,initial-scale=1`; static HTML has booking/search and links to official LINE OA `https://line.me/R/ti/p/%40827blnmo`. Read-only fetch of that direct LINE URL succeeded and returned **Add LINE friend** landing. **No LINE chat or sent booking was tested.**
- Production `/api/kk-data?sheet=08_Web_Ready&range=A4%3AK` and `/api/kk-data?sheet=09_Web_Packages&range=A4%3AN` **returned CSV content** with expected canonical headers and prices. These are the ONLY permitted sheet/range pairs for the public Web Ready feed, with 09 also allowing A4:M and A4:L (see `api/kk-data.js`). Attempts at subranges `A4:K73` etc correctly return HTTP 400 `Sheet/range not allowed`: **a policy allowlist, not an outage**. The third-party text extractor truncates the very large full CSV response (100 KB), so its partial rows are **not sufficient for full row-count acceptance**. Authoritative full-count reconciliation below comes from direct connected Google Sheets, not the truncated extractor.
- Read-only public image-asset fetch for `/assets/kk-brand-hero-final-20260920.png` **timed out** in the content-extraction service; this does **not** prove the origin image is broken, but image HTTP200/decode cannot be marked PASS. The text extractor's `?lang=en` result remained initial Thai HTML and “กำลังตรวจสอบคิวว่าง...” because it did not complete JavaScript hydration; **do not call that a demonstrated English toggle bug or a rendering pass**.

### Canonical Core → Web Ready → Booking

Read-only Google Sheets `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`:
- `01_Events!A4:I550` contains 343 event rows, 82 Core owner-active at test time.
- `08_Web_Ready!A4:K550` contains 344 rows, **80 effective public actions**: `show:72`, `show_full:8`. **0 effective public empty canonical poster URLs**.
- **Three actually shown first-party KK temporary brand art cards** (not official organizer posters):
  1. AF Halloween Party — AFTERLIFE (30 Oct 2026).
  2. MizuMi × PHUWIN — FIND YOUR MOISTURE MATCH (5 Nov 2026).
  3. SUPER SUN × ZEE PRUK BIRTHDAY FANSIGN (2 Nov 2026).
- **Two Core-active with owner/source gate enforced as Web Ready `hide`**: `EVT-20261030-VVV-SHOW-GO-WHOLESALE-RAMA2` and `EVT-20261106-BRICE-POND-NARAVIT-FAN-EVENT`, `SOURCE_DATE_UNVERIFIED`. Do NOT auto-unhide or insert fallback art to force their promotion. `hide` cards are excluded by `isVisibleWebAction`.
- `00_Master_Booking!A4:W160` active booking statuses produce **16 protected booking dates**. Full set reconciliation: **0 nonbooked effective-public rows with rentable phone/lens stock** on protected dates, **0 owner Core-inactive rows publicly shown**, **0 source-date-unverified rows publicly shown**. No Booking row or event action modified.
- `09_Web_Packages!A4:N1200` checked against effective show/show_full package rows: **0 present-day cases** where a displayed min price was lower than an available package’s price in the inspected data; no `show_full` with explicitly bookable stock found. This does **not** excuse the latent source bug fixed below, which will reappear if cheaper packages sell out before costlier ones.

## Actual source defects found and fixed (Draft PR #711 only)

1. `script.js::startingPriceFor(c)` included sold-out packages when choosing event-card “starting price”, despite the modal showing only available packages. Example: phone-only 590 THB full, bundle 990 THB still bookable → old card incorrectly says from 590. Fixed: consider only packages with `p.avail` and positive `p.price`. Waitlist/ask-price cases still fail closed and cannot invent a price. **No Sheet price mutation.**
2. `script.js::buildBookingMsg(c,p)` began in Thai with the Thai `📱 รุ่น` label even in English mode and for lens-only packages. Fixed intro and package/model field by `currentLang` while retaining exact event, date, venue, package model, price, pickup, nickname and phone fields. Booking URL remains prefilled LINE OA `https://line.me/R/oaMessage/%40827blnmo/?<encoded-message>`. Tests decode it without opening a chat/sending booking.
3. `index.html` changed JS cache key to `script.js?v=storefront-p0-price-line-th-en-20261013` to prevent Safari/CDN retaining the old script. Existing image regression's asset-key expectation updated, not removed.
4. Added `tests/storefront-production-p0-contract.test.js` with **9 hosted Node tests** for bookable-only minimum price, full/inquiry pricing, TH and EN LINE booking payload and URL, `show/show_full` allowlist, Search/venue/full status, TH/EN & dark/light control/CSS contracts, temporary artwork fallback and inventory clamps, new asset cache bust.
5. Attached tests to `package.json` postinstall for source-level Release validation without new paid services.

### Hosted Vercel Preview acceptance

- First Preview `dpl_7EQ5AyKpGek1TzuheNgRNpy2Lr7Y` on SHA `7ef9c3d2aec609d907a5c28014c902eabcb14792` was **READY**, P0 tests 8/8, preexisting image fallback suite 31/31.
- After HTML cache bump, first new build `dpl_AVCHwFJPbRqXj4ACwnrbPaDv12DY` **FAILED** because an unchanged earlier regression still asserted old `script.js?v=storefront-temporary-brand-image-20261012`; Vercel returned `BUILD_UTILS_SPAWN_1`, `npm install` error. Changed only that stale assertion, without suppressing image/visibility tests.
- Exact current code/test HEAD **`4e0804769650b121764bbdcef8b5b427c3c22d96`** successfully passed on **Vercel Preview `dpl_7q9HhbbKE1PbvKT1CcxpmGuykpBt` — READY**. URL `https://kk-phone-rental-vercel-9rzpq2g18-mikesd1995s-projects.vercel.app/`. Build log: 9/9 new P0 tests, 31/31 preexisting image suite, Hero 4/4, Ultra Deep recall 48/48 in inspected summaries; 0 errors in those tests. This confirms code/test acceptance but **NOT browser visual QA or live LINE action**.
- Draft **PR #711** is open/unmerged; **Production is still earlier main SHA**, unless a future concurrent merge changes it. Never call Draft Preview code “live” without exact Production alias SHA readback.

## Browser E2E still REQUIRED (not simulated)

The repository already has `scripts/storefront-visual-acceptance.mjs`, an actual Playwright viewport QA runner, invoked by `npm run ux:visual:accept`. Its browser runtime is not available here in a free, authenticated interactive environment; GitHub Actions runner remains pre-step failing (Issue #707), and TinyFish metered Agent/Browser cannot be used under the owner’s zero-spend instruction (TinyFish wallet readback showed negative balance and auto-reload unconfigured). This task did **not** make a browser screenshot and must not claim P0 complete.

Required true mobile/desktop acceptance on **the exact SHA to be released**:
- Phone widths 320, 375, 390, 430 px; tablet 768, desktop 1024/1440. No horizontal scroll, cropped text/image, or inaccessible CTA, responsive modal position and scroll restoration.
- TH & EN, Light & Dark. Toggle language/theme with actual DOM and screenshot readback, verify all labels/button states and contrast, including placeholder artwork.
- Fetch full live event list and prove 80 effective `show/show_full` match before date filtering, correctly render today/future, hide unverified/owner-hidden rows and booking-day locks; test Search by artist and venue, month and available/full chips.
- Validate remote poster image `naturalWidth>0`, image fallback and visible temporary labels; verify official artwork not mislabeled.
- Open modal for a bookable event, verify price equals canonical package row and count, decode href to official LINE OA with event/date/venue/package/price, confirm UI can hand off to LINE without sending a test booking. Full/waitlist card must never show a bookable package.
- Capture browser console errors, failed network requests, screenshot artifacts and a precise PASS/FAIL matrix. Gate merge/deploy on required owner acceptance, source checks and actual Production postdeploy screenshots.

## Change log and safety

All new commits were on Draft PR #711 only, no main merge, pricing business-data writes, Booking writes, event visibility override, Supabase changes, paid browser usage or LINE sends. No official poster required before eligible rows show; three shown KK temporary images must be replaced with official event artwork when authorized.

Rollback: revert PR #711 source change, test file, postinstall hook and index HTML cache key from current HEAD after checking concurrent edits. Existing merged PR #704 temporary image logic and booking date hides remain unchanged. Owner should verify GitHub CI infrastructure Incident #707 before releasing changed code; passing hosted Node tests does not bypass required browser acceptance.
