# Storefront V3 clean professional rebuild — 2026-10-01

## Trigger
Owner production review rejected V2/V2.2 as visually less professional than V1.

## Root cause
The Art Director was direction/evidence logic, not a closed-loop visual design agent. Automated Visual QA proved geometry, overflow, tap targets and runtime safety but was incorrectly allowed to create confidence about aesthetic quality. The V2 stylesheet also accumulated multiple mutually overriding V2/V2.1/V2.2/mobile-hotfix layers.

## Corrective architecture
- Stop stacking another V2 patch layer.
- V3 uses one new visual stylesheet: assets/kk-storefront-v3.css.
- Existing booking/data JS and business semantics are preserved.
- Replace image-banner-first header with compact brand navigation.
- Hero states customer value and device category immediately.
- Proof points are factual and compact.
- Discovery controls remain secondary to the event content.
- Poster cards are flatter and less template-like.
- Art Director V3 fails closed unless screenshot review passes and a single visual source of truth is proven.

## Visual direction
Editorial commerce / concert utility. Neutral canvas, restrained blue, black primary action, posters provide most of the color. No decorative glow system. No nested glass cards. No emoji-led interface.

## Safety
No changes to price, booking, inventory, event visibility, event API, or production data writes.

## External visual audit fallback
A live TinyFish screenshot audit was attempted but could not start because the connected wallet balance was negative. No paid retry was made. The redesign proceeded from production HTML, repository source, prior owner screenshot evidence and existing automated QA evidence.

## Required acceptance before production
1. Exact-head Admin Regression PASS.
2. Exact-head Storefront Automated Visual QA PASS at 320/375/390/430/480/768/1024.
3. Screenshot/visual review must be explicitly PASS; readiness score alone is not aesthetic proof.
4. Production deployment SHA must equal merged main SHA.
5. Production smoke/readback after cutover.

## First V3 QA correction
Initial V3 Visual QA correctly failed: 320px document width was 355px and TH/EN hit areas were below 44px. Evidence also exposed legacy `.pi-venue` intrinsic overflow and `.sr-only` diagnostics. V3 now contains event metadata, restores canonical screen-reader clipping, and makes language targets 44x44 without weakening thresholds.


## Final visual acceptance
Reviewed exact CI screenshot artifact `11145224805` for design SHA `3b97dae79dca14bc3a2da905596cef3f48f0aa07` across 320/375/390/430/480/768/1024 widths. The final design:
- surfaces event discovery in the mobile viewport;
- removes the duplicate fixed LINE CTA through tablet widths;
- uses restrained event-card status/date/availability treatment;
- removes decorative emoji noise from primary storefront copy;
- keeps 44px interaction targets and 16px iOS form controls.

Screenshot approval is pinned by Git blob SHA for `index.html`, `assets/kk-storefront-v3.css`, and `script.js`. Any later design-file mutation invalidates the approval automatically.

Final exact-head acceptance SHA before this documentation-only commit: `4a78f3083ab7661913d4d20fa97e3dc3cab6dda7`.
- Admin Regression `36826852590`: PASS.
- Storefront Automated Visual QA `36826852596`: PASS.
- Art Director V3: PASS.
- All seven viewport readiness scores: 100.
- Production writes during acceptance: 0.
