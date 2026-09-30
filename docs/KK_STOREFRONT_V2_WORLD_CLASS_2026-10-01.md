# KK Storefront V2 — World-Class Visual Rebuild — 2026-10-01

## Scope
Visual-only V2 foundation. Existing event feed, pricing, inventory, booking semantics, owner-hidden state, APIs and Machine SOT remain unchanged.

## Why
V1 accumulated local UI patches. Functional gates existed, but there was no pre-implementation art-direction authority. This produced design drift: individually valid controls without one coherent visual composition.

## Implemented
- Added callable `kk-storefront-art-director` runtime with deterministic design system and fail-closed acceptance.
- Registered `storefront_art_direction` and `storefront_art_acceptance` in Agent Registry/Task Router.
- Added regression tests proving the agent is callable and cannot self-accept without visual evidence.
- Added V2 premium editorial CSS layer: calmer chrome, poster-first grid, compact sticky discovery controls, stronger typography/spacing, restrained depth, mobile-first two-column event grid, accessible control sizing.
- Existing UX Reviewer and automated browser Visual QA remain mandatory independent gates.

## Safety
No pricing, booking, inventory, event visibility, API, Google Sheets, Apps Script or Machine-SOT write path is changed. No auto-merge and no auto-deploy.

## Acceptance
V2 is not production-accepted until syntax/tests, independent UX review, browser screenshots/metrics at 320/375/390/430/480/768/1024, and `storefront_art_acceptance` all pass.


## Iteration evidence — 2026-10-01

### CI round 1
- Admin Regression: 959/962; 3 failures were stale registry-version assertions (V22 vs runtime V23), not storefront/business regressions.
- Corrected the three contract assertions to V23. Subsequent Admin Regression on V2 head passed.
- Visual QA blocked release at 1024x768 for STICKY_VIEWPORT_OBSTRUCTION: 167px / 22% viewport.
- Re-composed desktop discovery chrome into one search/filter row. Follow-up 1024x768 result: PASS, professional readiness 100, sticky controls 91px.

### CI round 2
- Multi-viewport Visual QA remained fail-closed due to tablet 768x1024:
  - P0 HORIZONTAL_OVERFLOW: document width 772px vs viewport 768px.
  - P2 EXCESSIVE_BACKDROP_BLUR: 22px.
- Applied root containment to V2 grid/flex children and discovery controls; constrained tablet sticky shell to its content box.
- Reduced tablet sticky backdrop blur to 14px and mobile to 12px.
- No overflow-hiding workaround was introduced.

### Safety/readback
- Production writes: 0.
- Pricing/booking/inventory/Event SOT mutations: 0.
- Auto-merge/auto-deploy: disabled.
- PR remains Draft until current-head Admin Regression + full Visual QA matrix pass and owner visual review is satisfied.

### CI round 3 — exact-head repair
- Exact head `37ef4be` failed Admin Regression only because two Visual-QA contract tests referenced undeclared `path` / `ROOT`; this was test-harness failure, not storefront or business logic. Replaced those reads with deterministic repository-relative paths.
- Visual QA passed 375/390/430/480/768/1024 at professional readiness 100. Only 320x568 remained blocked: P0 horizontal overflow (330px document vs 320px viewport) plus P1 card width below the 150px contract.
- Root cause was the two-column mobile grid being mathematically too narrow at 320px after safe page gutters. V2 now switches to a one-column poster grid at <=350px instead of hiding overflow or shrinking cards below acceptance.
- These repairs preserve event data, pricing, inventory, booking behavior and owner visibility truth; production writes remain 0.

### Final automated acceptance — 2026-10-01
- Exact accepted code SHA: `0010f2dd7a8f020e3d607c322b2f32b0f67b6a3e`.
- Admin Regression: PASS on run 36768319120.
- Storefront Automated Visual QA: PASS on run 36768319091.
- All required viewports passed with professional readiness 100: 320, 375, 390, 430, 480, 768 and 1024 px.
- Horizontal document width now equals viewport at every acceptance width; 320px improved from 330px to 320px.
- Storefront Art Director acceptance: PASS.
- Runtime errors: none. Production writes: 0.
- Root-cause repairs included deterministic Visual-QA contract paths, 320px single-column cards, viewport-contained status controls, removal of legacy nowrap overflow in the V2 section heading, and mobile footer/text containment.
- Visual QA now records `overflow_elements` diagnostics so future horizontal-overflow regressions identify the responsible DOM elements rather than requiring blind CSS changes.
- PR remains Draft and production is unchanged; automated acceptance is complete, while owner visual review remains the final pre-cutover gate.


### Final visual refinement — owner-grade review
- Automated 100/100 evidence was manually inspected from the workflow screenshot artifact instead of being accepted on metrics alone.
- Manual review found an incompletely decoded hero image in the 768px capture. Visual QA now waits for visible images to complete and decode, and fails closed with `VISIBLE_IMAGE_NOT_READY` when evidence is not render-ready.
- Added a regression contract for the image-readiness gate.
- Refined the V2 art direction without changing booking/data semantics: the intro is now a restrained editorial surface with stronger hierarchy, subtle depth, balanced brand-blue atmosphere, clearer trust markers, improved focus treatment, calmer utility controls and more deliberate poster-card finish.
- Mobile refinement preserves the accepted 320px containment and one-column fallback while reducing hero density on the shortest viewport.
- No pricing, inventory, booking, event visibility or production write path was changed by this refinement.
- Candidate commits: `1401c063` image-readiness gate, `c04389f2` regression contract, `bede06ec` premium editorial refinement.
- Final release status remains fail-closed until Admin Regression + Visual QA + Art Director acceptance pass on the refined exact head and screenshot evidence is reviewed again.
