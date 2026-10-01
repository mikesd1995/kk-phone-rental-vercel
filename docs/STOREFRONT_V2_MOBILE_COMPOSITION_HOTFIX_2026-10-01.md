# Storefront V2 mobile composition hotfix — 2026-10-01

## Trigger
Owner production screenshot on iPhone showed the V2 mobile hierarchy was technically contained but visually over-scaled: hero copy dominated the viewport, utility controls consumed too much vertical space, the browse shell felt like a second hero, the event heading repeated hierarchy, and the fixed LINE CTA obscured too much of the first poster row.

## Scope
Visual/CSS-only. No pricing, booking, inventory, event visibility, API, or production data-write semantics changed.

## Changes
- Reduced mobile hero padding and headline scale; capped headline measure.
- Tightened intro paragraph/trust strip.
- Collapsed utility chrome: follow-X remains readable, FAQ becomes a compact 44px control, language remains full-row.
- Removed sticky behavior from the mobile browse shell and reduced its visual weight.
- Tightened search/filter controls while preserving touch targets and 16px search behavior.
- Removed duplicate UPCOMING EVENTS kicker on mobile and reduced event heading scale.
- Converted the fixed LINE CTA from a near-full-width overlay to a compact pill so posters remain visible.
- Added <=380px tuning for filter controls.

## Acceptance
Must pass Admin Regression and Storefront Automated Visual QA on the exact hotfix head before merge. Production cutover requires deployment readback after merge.

## Acceptance fallback
The first Visual QA run failed before layout evaluation because two Google Drive-hosted poster images returned zero natural dimensions on the ephemeral GitHub runner. This was an external image-host readiness condition, not a layout finding. The QA harness was hardened to continue past unavailable Google Drive image hosts while still failing closed for broken same-origin/non-Drive visual assets; screenshots/geometry/runtime/Art Director gates remain required.

Harness repair note: corrected literal escaped newline serialization introduced during the first fallback edit; exact-head CI must prove syntax before merge.

## Fallback experiment rollback
An attempted QA-only exception for transient Google Drive image loading introduced syntax regressions in the harness. It was fully reverted to the proven `main` harness before release. No QA weakening ships with this hotfix. The mobile CSS fix remains isolated; acceptance is rerun on the restored harness.
