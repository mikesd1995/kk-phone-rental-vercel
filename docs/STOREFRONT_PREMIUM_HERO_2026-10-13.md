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


## Follow-up implementation and evidence — 2026-10-13

### Additional mobile correction
- Local visual mock at 390 and 480px exposed an awkward Thai orphan line in the original narrow two-column design.
- Scoped CSS revised on commit `b050c83c9b1cf0feba319ba27023b78879696dfc`: at 376–540px, use a stacked single-column hero; TH heading and CTA appear before the product image. <=375px remains text-only.
- Contract regression extended on `c5e999871a38df899788f57052e046725e26b712` for the 376–540 rule. This is additional test source, not a reported executed Node test.

### Readback validation
- GitHub connected readback of the exact PR source passed **14/14 structural checks**, including the complete affected-file allowlist (five files), binary Git blob SHA, image signature, loading order, live copy and anchor links, TH/EN logic, mobile responsive rules, reduced motion, bracket balance, and test JavaScript parsing.
- A separate, explicitly NON-PRODUCTION local HTML/CSS **hero mock** was rendered using Chromium + Playwright with inline source and the exact committed 240×170 WebP. Viewports **320, 375, 390, 480, 540, 541, 700, 768, 1100 and 1440px**: no horizontal overflow, primary CTA minimum 44px, CTA inside viewport, and product art hidden <=375px. This mock was not built from the complete live app and cannot substitute for official registered visual QA.
- At 390px mock hero height changed from ~214px to ~429px; line wrapping became legible and the product image increased from ~98px wide to ~304px wide. Tradeoff: longer first fold. At 480px hero grew to ~507px. This needs full storefront first-fold acceptance and event-discovery validation.

### GitHub Actions blocker / reproducibility
- `Storefront Automated Visual QA` runs for this PR: [38387168891](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38387168891) initial commit, [38389767146](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38389767146) CSS fix, and [38389800199](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38389800199) test fix. All were marked FAILURE in ~3 seconds, BEFORE ANY JOB STEPS (`jobs[].steps=[]`). GitHub job log download was `404 BlobNotFound`; no workflow artifacts.
- Crucially unrelated PRs #723/#724 in other workflows (`ultra-deep-v2-acceptance`, `vercel-storage-source-contract`) show the same 3–4s failures at this time. **Strong evidence for repository/account-level runner/startup problem, not proof of the hero code failing.** Exact root cause still unknown; do not assert 'quota exhausted' without billing data.
- No repeated blind rerun, no bypass, and no extra Vercel Preview deployments because of owner Hobby free-tier quota constraint.

### Open acceptance blockers
1. GitHub-hosted runner / Actions startup failure; investigate with owner account-level Actions policy/billing/job-runner status if it persists.
2. Required registered Agent Gateway `storefront_ux_review` and `storefront_visual_qa` with real production-like screenshots are still missing.
3. Full Node regression and integrated app flow + TH/EN/Dark-Light/booking smoke QA on exact head are still missing.
4. Current committed art is only 240×170 WebP (4,618 bytes); adequate to verify composition but **potentially soft on ~500px desktop panels**. Prefer replacing it with a higher-resolution art crop before acceptance, with exact readback and image decode.
5. Owner-approved release + deploy still pending.

### Current state and recovery
- PR #725 stays DRAFT/HOLD; no merge/deploy.
- Last known production READY remains `dpl_7TYLb87ir9qNzXRtkeb49543dwVm` serving `d6dc3bfe4cc0c4dd6fdfec407823752da0572464`.
- Recommended recovery: restore runner access or use an approved zero-cost full repo local QA runner with registered agent invocation and *fresh exact-head evidence*. Do not replace missing evidence with the local mock. Only then remove hold, merge with approval, verify new READY deployment and real client HTTP readback.
