# Storefront P0 — 320px first-fold and FAQ repair, exact proof boundary (2026-10-14 ICT)

## Scope and provenance

Owner selected UI/UX full-scope QA for [Draft PR #727](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/727). No Booking / price / stock / owner hide-show / LINE send / Google Sheet edits / paid API / Vercel deploy / merge. This is an **unmerged** presentation + QA-harness repair.

Historical **real Chromium/Playwright** run [38420212171](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38420212171) used **SHA `93204e594dbf51bd97533095c701c5beb1d124bc`** (NOT today's PR head). Its downloadable Actions artifact **`storefront-visual-qa-93204e594dbf51bd97533095c701c5beb1d124bc` (ID 11826551985)** includes `manifest.json`, `summary.md`, public read-only fixture snapshots and **64 JPEGs**: 8 viewports × top/catalogue/footer/english/english-modal/dark/dark-modal/modal. We downloaded and inspected the exact archive, including `320x568-top.jpg`, and parsed the manifest. This run executed 18 job steps, generated artifacts, and scored automated UX policy **PASS / 100 at every width**; nevertheless its **technical and release outcomes were FAIL/BLOCKED** because the Visual Critic found a **P1 at 320px**. Historical source/screenshots must never be claimed as exact-current-HEAD rendered evidence.

### Historical browser measurements, not current candidate acceptance

| Width × height | Registered UX policy | Visual Critic | P0/P1 findings |
|---|---|---|---|
| 320×568 | PASS / 100 | **REVISE** | **EVENT_DISCOVERY_TOO_LATE** |
| 375×812 | PASS / 100 | PASS | none |
| 390×844 | PASS / 100 | PASS | none |
| 430×932 | PASS / 100 | PASS | none |
| 480×932 | PASS / 100 | PASS | none |
| 768×1024 | PASS / 100 | PASS | none |
| 1024×768 | PASS / 100 | PASS | none |
| 1440×900 | PASS / 100 | PASS | none |

320px evidence: `first_event_top_px=532.34375`, viewport height `568`, required `<=0.92 × 568 = 522.56px`, miss `9.78px`. Historical hero height `189.78125px`; document scroll width `320px` (no horizontal overflow). The 320 screenshot still renders the benefits, search, status filters, and top edge of the first event, but event discovery is late. The 320 interaction list omitted FAQ open/close, whereas 375/390/430/480/768/1024/1440 lists include them.

## Two targeted source repairs (unmerged, zero paid services)

1. **Compact 320-only first fold** — commit [861f5e9](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/861f5e989a299aa5a13f36e8a72a9141666cd952): appended last-loaded `assets/kk-hero-premium-20261013.css` `@media(max-width:359px)` overriding original Hero vertical padding `16px 17px` to `8px 17px` (minus **16 nominal CSS pixels** across top+bottom). Do **not** hide any text, product eligibility, controls or event; preserve discovery CTA `#content`, >=44px tap target, 375+ unaffected. If all else measured the same the anticipated first-event y would be **about 516.3px**; this is an estimate, **not an actual after-fix Chromium measurement**.
2. **Restore FAQ access at 320px and stop silent QA skip** — commit [1506b91](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/1506b912c4fbe249ec5897fb6fa392d51d8d22ef) restores the unique header `#faq-open-btn` at <=359px using a higher-specificity, later-loaded CSS `display:inline-flex!important` (44×44px minimum, no theme or language removal). The existing authoritative V5 CSS contains `.header-faq-btn{display:none!important}` at max 359px and HTML contains no `data-open-faq` alternative. [b65d0ba](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/b65d0ba92a18a1dce3534a9676e82c1d011649d8) modifies `scripts/storefront-visual-acceptance.mjs` to record a **failed** `faq_entry_missing` interaction instead of silently skipping. This **tightens**, rather than bypasses, acceptance.
3. Regression coverage: [5d29cf0](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/5d29cf0eafb0a6641a773410e9533f6287bafea0) and [cff180f](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/cff180f21f12b52537f00ab283e2c6883d63efc8) extend `tests/storefront-hero-premium-20261013.test.js` to assert final 320 CSS, live CTA, FAQ visibility/tap minimum, and fail-closed QA branch.

### Actual post-patch checks (restricted scope)

- On the **source retrieved from the PR branch after both fixes**, we ran **12/12** unchanged `tests/storefront-hero-premium-20261013.test.js` callbacks in JavaScript V8, mocking only Node `node:test`, assertions, filesystem/path and byte-buffer reads. Real GitHub product WebP fetched and decoded in memory: 17,504 bytes, VP8/WEBP 560×396 checks PASS. This was NOT `node --test`, Playwright, or GitHub Actions.
- Latest same-branch `script.js` and `tests/storefront-poster-dom-runtime.test.js` readback: **8/8** isolated V8 mocked DOM callbacks PASS (wrong-event art, image errors, blank art, sold-out, event identity). Tests are not live Booking or booking mutations.
- Read-back source checks: `index.html` loads Premium CSS **after** authoritative `kk-storefront-v5.css`; the V5 narrow `display:none!important` is present and the higher-specificity Premium override is present; visual QA script explicitly fails missing FAQ. Source script and test CJS parse. `scripts/storefront-visual-acceptance.mjs` parsed under V8 **after stripping ESM imports and replacing import.meta**, which is NOT a native Node module syntax check.
- These source-level tests **do not prove actual 320 header fit after restoring FAQ, actual 320 first-event y, live image decode or complete 8-width screenshots**. They may not be used as a green visual gate.

## Current unresolved CI, visual and release gates

- The GitHub Actions run automatically triggered for post-patch commit `cff180f21f12b52537f00ab283e2c6883d63efc8`:
  - [Storefront Automated Visual QA #38502282866](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38502282866) **failure, steps=null, 0 artifacts**.
  - [OpenAI Optional Zero-Cost Acceptance #38502282856](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38502282856) **failure, steps=null, 0 artifacts**.
  - Neither actually ran source tests or screenshots. No manual retry was initiated and no paid model requests were made. GitHub Actions minutes and current stop-at-limit details not readable from this connector; earlier billing alert 2,032/2,000 included minutes is historical only.
- Need **one exact-current-head native Node/full-browser run** on a confirmed free/authorized runner or owner's locally checked-out repo, 8 widths (320,375,390,430,480,768,1024,1440) and TH/EN × Light/Dark. Explicit checks: current first-event y <=0.92*568 at 320, FAQ visible and operational with no header/button overlap or clipped language/theme, keyboard-focus/Escape/modal return, search/filter/sold-out statuses, event-specific poster blank/broken fallbacks, `naturalWidth>0` for official images, computed `contain`, no horizontal overflow, 0 console JS errors. Any P0/P1 leaves HOLD.
- **Actual current-HEAD screenshot owner approval is missing.** Existing `config/kk-storefront-v5-screenshot-review.json` historical PASS/ACCEPTED is bound to previous HTML/CSS/JS blobs and cannot authorize updated source. Never backdate it or replace image hashes without the actual rendered review.
- Vercel Production remains `main d6dc3bfe4cc0c4dd6fdfec407823752da0572464`, deployment `dpl_7TYLb87ir9qNzXRtkeb49543dwVm` READY; no #727 Preview. Vercel Hobby storage/rollback evidence and CI health still need verification before any release. [#692](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/692), [#707](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/707), [#713](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/713).
- Separate poster provenance remains open: 9 future-visible `show/show_full` event-date cards had blank source URLs in the latest data census, including LYKN 23 Oct / K*Pop Masterz 15 Nov / FORTREASURE 27 Nov plus the six in [#731](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/731). Do not make up official art or unhide anything.

**Decision: DRAFT / HOLD.** No merge/deploy, booking/price/stock/visibility changes, owner policy bypass, paid browsers or increased spending. Keep the historical screenshot archive linked to its old SHA; rerun real browser on newly approved exact SHA once free compute is confirmed.