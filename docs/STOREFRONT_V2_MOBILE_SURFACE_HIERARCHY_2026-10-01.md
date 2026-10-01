# Storefront V2 mobile surface hierarchy v2.1 — 2026-10-01

## Evidence
Owner production iPhone review after the first composition hotfix still described the storefront as visually strange. Source inspection found excessive nested rounded surfaces above the event grid: hero card, utility pills, language capsule, browse card and floating CTA competed as separate visual layers.

## Change
CSS-only mobile refinement. Hero becomes an editorial section instead of a card; decorative glow is removed on mobile; trust benefits become a light divider row; utility controls are quieter; language switch uses a low-contrast segmented surface; browse controls lose the outer glass card; event heading is reduced; LINE CTA is less visually dominant.

## Invariants
No booking, pricing, inventory, event visibility, API or production data semantics changed. Search remains 16px-safe for iOS. Interactive controls retain >=44px acceptance targets where required.

## Acceptance
Exact-head Admin Regression and Storefront Automated Visual QA are required before merge. Production deployment must reach READY and match the merged commit.
