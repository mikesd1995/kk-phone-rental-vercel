# KK Phone Rental — Hero Editorial Art Direction (2026-10-12)

## Owner request
Improve the awkward public hero/header screenshot to a professional, trustworthy phone rental presentation, using AI-agent-style review and feedback/learning. Owner explicitly authorizes shipping to production **after** validation. Zero paid services. Product/business truth must not change.

## Baseline / reproducible defect
- Production alias: https://kk-phone-rental.vercel.app/
- Prechange production: READY deployment `dpl_HTYhdt5iWjCgqwgrSuWAae7EWosb` on main `2159770730126605610a5ddaee549e43bee0f647`.
- The historical `.kk-mock-hero::after` and dark mode variant applied `/assets/kk-brand-hero-final-20260920.png` as a **full promo graphic** behind live HTML, at `auto 145%` / `auto 155%`. In the owner's screenshot, its embedded copy and stickers leak into the live composition; headline/photo sizing and many mobile override layers compete.
- The static CSS has historical styles for 320, 360–700, 701–900, >=901; specifically a 320-class compact viewport previously hides supporting hero copy.

## AI-assisted design critique / learning loop
Agent-style pass (Art Direction, UX, Conversion, Accessibility, Regression):
1. **Art direction:** Separate live HTML typography from promotional imagery; preserve the existing owner's image and blue/navy brand, make it a contained product crop rather than a full-bleed overprint. Avoid synthetic/incorrect device specifications.
2. **UX:** Set two-column desktop proportions and a rounded visual card; on narrow screens protect copy and shorten the first fold by omitting the decorative visual at <=375px.
3. **Conversion:** Preserve both CTA destinations and the explicit availability-first action. Do not display inventory count in CTA.
4. **Accessibility:** Decorative image is `aria-hidden`; retain selectable translation-bound heading; >=44px mobile CTA; :focus-visible ring; reduced-motion fallback.
5. **Regression:** Add a static contract and require real browser evidence for 320/375/390/430/480/768/1024/1440, both languages and both themes; validate initial-fold metric, clipping, visual assets, clicks, scroll restoration and zero network writes.
6. **Learning:** Root cause classification: `PROMO_ASSET_REUSED_AS_LIVE_HERO_BACKGROUND`. Prevent recurrence via source contract and reviewer guidance: do not scale a complete ad/poster into a live copy panel.

Hugging Face connector calls (`space_search`, `hf_doc_search`) returned `Tool ... not found`; **no Hugging Face model inference or visual scoring occurred**, and no commercial service was activated. No independent AI agent gateway/model execution is claimed. This is an AI-assisted design/code pass with project-specific tests.

## Changes (candidate branch)
- `index.html`: add a presentational `.kk-hero-art` sibling to HTML hero copy. Version the active authoritative stylesheet query to `20261012-v632-editorial-hero`.
- `assets/kk-storefront-v5.css`: append one scoped V6.32 art-direction override. Disable the full promo banner pseudo background; apply a split editorial navy card, accessible headings/buttons, background asset solely within art panel, and mobile/reduced-motion overrides. Preserve Light/Dark and TH/EN functionality.
- `tests/storefront-hero-editorial-contract.test.js`: source invariants for hero layout, i18n, image isolation, CTA URLs and mobile touch targets.
- No changes to prices, events, customer data, posters, booking rules, Admin, LINE intake, event visibility, API, or database.

## Acceptance / rollout controls (fail closed)
1. Run `node --test tests/storefront-hero-editorial-contract.test.js` and applicable project source/visual contracts at exact PR head; check merged tree/source compatibility.
2. Generate real screenshot comparisons in both themes and languages at **320, 375, 390, 430, 480, 768, 1024, 1440**. Note: static CSS review does not prove render quality or visual usability.
3. Confirm source poster art contains no visible embedded words/stickers at any crop; if present, replace with a genuine product-only approved image before release.
4. Run full Storefront Design Council/Gateway acceptance (or honestly record blocked), iOS targets, language toggling, FAQ, CTA, event listing/availability parity and production_writes=0.
5. Inspect Vercel Hobby quota and build logs before creating any preview/production deployments. Prior free-tier storage and GitHub Actions runner issues mean no repeated deploy loops.
6. Merge only when exact-head checks pass and visual decision is accepted, then verify READY production deployment exact commit and public alias readback.

## Current state
Candidate code prepared on `fix/hero-editorial-phone-art-20261012`. **Do not interpret prepared source as deployed.** Production remains unchanged pending gates, especially image crop rendering and CI.

## 2026-10-12T16:xx+07:00 — post-PR verification / no-cost stop
- Draft PR: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/698 ; head before this note `c23fd278a98abc2a2577b19c6818059abbe94a2b`, base `2159770730126605610a5ddaee549e43bee0f647`. GitHub indicates mergeable=true but draft/unmerged.
- Readback after patch: HTML image sibling exists; authoritative CSS marker exactly once; CTA fragments, current stylesheet cache version, bilingual script bindings, mobile fallback and braces validated with **static string/brace checks only**. Source-only result: PASS. New Node test file exists but **has not executed**.
- GitHub Actions `Storefront Automated Visual QA` run `38228506101`, initial job `114741867910`: failure, steps=null, log URL unavailable; independent job log request returned `BlobNotFound`. Reran failed jobs once; second job `114742396776`: failure, steps=[] on explicit step fetch. Cannot claim QA/test PASS. Do not rerun indefinitely.
- Vercel alias live readback still READY at `dpl_HTYhdt5iWjCgqwgrSuWAae7EWosb`, main SHA `2159770730126605610a5ddaee549e43bee0f647`; the redesign PR has **NOT** deployed to production.
- Vercel preview not created in this attempt, respecting unresolved Hobby deployment storage/quota cost controls. No data or booking writes.
- Blockers: GitHub Actions runner/no-steps failure; missing exact-head runtime render in eight viewports; original promo art crop may expose baked-in copy; no successful Hugging Face connector invocation. Before release, obtain actual screenshots and visual acceptance, pass release gates, then merge/deploy once within free-tier limits.

## 2026-10-12 16:4x ICT — alternate Vercel acceptance path
- GitHub Actions visual QA run 38228506101 failed twice **without runner steps**. Connector retry did not solve platform setup. We avoided infinite CI reruns.
- Successful single Vercel Git Preview build **dpl_2HhSMxjHZzoNSxxptL24zQxm819y**, commit `314559b71e4ed446c00d10489c538a1739fcb483`, READY, source branch `fix/hero-editorial-phone-art-20261012`.
- Vercel build logs prove **16/16 storage and ignore-build checks**, **48/48 Ultra Deep recall regression**, **1/1 official poster asset check** (65 total) passed, build finished and static outputs were deployed. These are independent of broken GitHub runner, but do not prove pixel-level visual correctness.
- Read-only authenticated Vercel preview HTTP readback: `/` 200, `/style.css` 200, `/script.js` 200, `/assets/kk-storefront-v5.css?v=20261012-v632-editorial-hero` 200 and official hero image 200. The preview HTML contains `<div class="kk-hero-art" aria-hidden="true">`.
- `/api/kk-data` without an allowed sheet/range returns 400 `Sheet/range not allowed` by the API's normal input guard; **not** evidence of data outage. No booking/payout/customer write attempted.
- New booking PR #699 merged independently to Main (`d01acc5ae757ac4bc7d6d23fc008fd8ca9b8bf2d`), Vercel production READY deployment `dpl_FLVfZLYvmYhG6yYBvu9Yo7LDB1V8`. It changes Admin/API/package booking rules, not `index.html`, `assets/kk-storefront-v5.css`, or `script.js`.
- To protect #699, the Hero branch package now copies latest Main's `package.json` with `test:booking:no-deposit` FIRST in `postinstall`, plus appends `node --test tests/storefront-hero-editorial-contract.test.js`. No booking enforcement was overwritten.
- Next: create an exact-head Vercel Preview with the new test, inspect build and HTTP readback. Avoid Paid/TinyFish/browser services. Visual screenshots, cropped banner-art appearance and the full seven-reviewer visual acceptance remain separate gates; do not conflate build success with screenshots.

## 2026-10-12 integration gate correction
- An exact-head preview for old PR #698 at `2acafc0ccfdb3675f898c4b994119cd1f8f9a654` built ERROR because it copied the *new* Main `package.json` (whose `postinstall` requires `tests/kk-no-deposit-booking-create.test.js`) onto a branch still based before PR #699, missing the new test file.
- This is a **branch integration failure**, not proof of Hero rendering or Booking runtime failure. Do NOT drop or bypass the no-deposit test.
- Recovery: create new branch `fix/hero-v632-integration-20261012` directly from Main following PR #699 and reapply only the Hero HTML/CSS, contract, and handoff; then add Hero test to the existing Booking-first Main postinstall. This new branch contains the full Booking fix naturally.
- Old PR #698 should be closed as superseded **only after** the replacement PR is created. Preserve its historical evidence and all source changes in the new PR.
- Existing Preview `dpl_2HhSMxjHZzoNSxxptL24zQxm819y` did pass 65 baseline checks. Second Preview `dpl_4EjN9RVd2navHgM297uynmuZyLd2` correctly failed due to older source tree + newer package mismatch, and MUST NOT be treated as deployable.
