# Storefront V5 Professional Editorial Redesign — 2026-10-01

## Decision
V4 / PR #402 is owner-rejected and closed. V5 restarts from current production main, not from V4.

## Design objective
Preserve KK Phone Rental's concert/fandom identity and poster prominence while removing the visual noise that made production feel unstructured. The target is a premium editorial concert-rental storefront, not a SaaS dashboard, generic marketplace, ad banner, or minimal directory.

## Business invariants
No changes to event visibility, pricing, inventory, package availability, booking/LINE semantics, source-of-truth data, admin writes, or production data.

## V5 hierarchy
1. Compact KK brand/header.
2. Compact concert-specific value proposition.
3. Three restrained trust proofs.
4. Search + month/status discovery toolbar.
5. Poster-led event cards.
6. Package/availability details on event selection.
7. Contextual LINE conversion.

## Visual changes
- Removed large hero action buttons; event discovery is the primary action.
- Removed legacy booking-guide/social-proof blocks from the visual flow.
- Suppressed floating LINE CTA to prevent poster obstruction.
- Preserved two-column poster browsing on mobile rather than V4's generic list rows.
- Four-column poster grid on wide desktop; three-column intermediate layouts.
- Reduced oversized status badges and per-card CTA weight.
- Unified blue/navy/neutral semantic palette and spacing/radius hierarchy.
- Mobile controls remain horizontally discoverable without forcing page overflow.

## Acceptance
V5 is not production-approved until exact-head regression + 320/375/390/430/480/768/1024 visual QA + screenshot inspection pass. Technical green alone is insufficient. Owner visual rejection invalidates any automated visual PASS.

## Production
Production writes: 0. Merge/deploy: prohibited until screenshot review evidence is accepted.
