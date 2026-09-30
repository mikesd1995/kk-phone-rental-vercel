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
