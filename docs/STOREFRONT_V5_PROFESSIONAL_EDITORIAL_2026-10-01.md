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


## Final governed acceptance
Accepted reviewed design SHA: `e377e1ba5be1397c577d10dc65c1e5a284912373`.
Acceptance integration head: `0a7518665f28f397097933df10d58f1696f24e95`.

Evidence:
- Admin Regression run `36837427656`: SUCCESS.
- Storefront Automated Visual QA run `36837427667`: SUCCESS.
- Human-reviewed screenshot artifact: `11150215487`.
- Viewports: 320 / 375 / 390 / 430 / 480 / 768 / 1024.
- P0: 0 at all viewports.
- P1: 0 at all viewports.
- single visual source of truth: true.
- screenshot review: PASS.
- Art Director blockers: [].
- Production writes/publishes: 0.

Human review deliberately rejected earlier technically-green iterations:
1. round 1: narrow 320px cards and transient poster readiness.
2. round 2: inherited gradient card CTA and overly dominant poster badges.
3. round 3: PASS after removal of promotional card chrome, narrow-mobile composition correction, and final poster-led hierarchy review.
