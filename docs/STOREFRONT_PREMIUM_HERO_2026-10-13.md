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


## Further verification on 2026-10-13 — final follow-up in this session

### Root investigation and attempted alternatives
- Rechecked Vercel production identity: `dpl_7TYLb87ir9qNzXRtkeb49543dwVm`, READY, Git SHA `d6dc3bfe4cc0c4dd6fdfec407823752da0572464`. It remains main's last known deployed SHA. **No production change occurred**.
- GitHub Actions for updated branch `1f15a82c320982794ba29ffbaf697225b00de255`: Visual QA run [38403159266](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38403159266) completed FAILURE within 3 seconds, same pattern as previous branch runs. Run [38403123508](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38403123508) likewise failed within 3 seconds. These failures preceded any published job steps. Account/workflow permission and billing endpoints are not accessible through the connected GitHub tool. **Do not infer a particular billing/root failure without account evidence.**
- Tried locally installed Chromium/Playwright instead of blocked hosted GitHub Actions. Local browser does not permit file:// or localhost navigation (`net::ERR_BLOCKED_BY_ADMINISTRATOR`), so the zero-network fallback used `page.set_content()` with the exact hero mock markup and inlined art source. This is a *mock-only* visual/layout smoke test, not a registered Agent Gateway acceptance invocation.
- Mock visual test matrix: 16 widths `320,359,375,376,390,414,480,540,541,700,701,768,900,1100,1280,1440` × 2 copy modes TH/EN × 2 theme flags = **64/64 passed** no horizontal overflow, primary CTA >=44px and inside viewport. HTML/CSS mock only; it does not verify full page catalogue, booking, real app i18n/theme and data.
- Screenshot review identified another specific issue: at 541px, split hero isolated the Thai terminal word `กว่า` on its own line. Fixed on commit `2eecc35574ca417be2c32603639b9cbd9a14ed12`: 541–700px line-height, title font-size and emphasis scaling, preserving copy and links. Companion regression assertion on commit `1f15a82c320982794ba29ffbaf697225b00de255`.
- At 390px the mock Hero is ~429px tall, at 480px ~507px, and the breakpoint from 540px (~551px tall) to 541px (~250px) remains a **visual continuity / first-fold tradeoff**, not an overflow or CTA break. Requires integrated UX judgement before acceptance.
- Tested a 560×396 WEBP created locally from the owner-supplied 765×541 image to inspect image quality (17,504 bytes), but **did not upload** this high-res variant to the GitHub PR. The committed GitHub asset remains the original small 240×170 WEBP (4,618 bytes). Do not claim the higher resolution artwork is deployed or included in the PR.
- The registered `storefront_ux_review` / `storefront_visual_qa` Agent Gateway invocations, independent Reviewer acceptance, full repository Node test suite, production deployment and runtime readback for the new art remain **NOT DONE**.

### Decision — blocked safely
This work is not ready for merge. Maintain PR #725 as DRAFT/HOLD. Fix blocked CI/account runner first or use an explicitly approved equivalent zero-cost integrated test execution environment with real viewport screenshots and registered reviewer receipts. Upgrade product artwork, solve first-fold and breakpoint tradeoff, then request project acceptance and deploy only when gates are green. No external billing, GitHub permissions or business data changes were made during this follow-up.


### Final incremental QA / handoff (additional)
- Tested browser mock matrix `16 viewport widths × 2 TH/EN copy modes × 2 theme flags = 64 cases`, **64/64 pass** for (i) horizontal overflow <=1px, (ii) primary CTA target >=44px, (iii) CTA within viewport. This covers responsive shell only, **not production or live business flow**. Platform Playwright prevents localhost/file navigation; tests used `page.set_content` with embedded artwork (no network).
- Detected intermediate 541px viewport orphan `กว่า`, verified in before/after screenshots and repaired by scoped CSS `@media (min-width:541px) and (max-width:700px)`. Verified at 541, 600 and 700px: no horizontal overflow; CTA 44px.
- Final PR source patch: `assets/kk-hero-premium-20261013.css`, `tests/storefront-hero-premium-20261013.test.js`; new test provides deterministic tablet typography contract. `npm run test` is NOT claimed. Last visual QA job on exact tested branch revision [38403159266](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38403159266) failed in 3 seconds with no steps. This is not an acceptable green gate.
- **Only local** 560×396 optimized artwork was prepared (`17,504 bytes`, SHA-256 `3e3e0087d27bc98795bb54e6e1368be650f80ae072423093411d948897f2ab58`). It was used for mock screenshots but NOT committed into the GitHub PR; GitHub still contains small 240×170 original. A high-resolution source remains available as uploaded conversation attachment if the next workspace can write binary artifacts.
- Real app end-to-end, registered UX agents, GitHub runner repair and production acceptance remain blocked/not proven. Keep Draft HOLD; prevent undocumented merge/deploy. No price/inventory/booking changes.
