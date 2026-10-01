# Storefront V2.2 professional redesign — 2026-10-01

## Why
Production owner review showed that prior automated readiness could reach 100 while the storefront still felt template-like. Existing gates were strong for overflow, runtime safety, tap targets and responsive geometry, but insufficient for brand hierarchy and content-first composition.

## Direction
Premium editorial concert-commerce. Event/poster identity is primary; controls recede. The page should read as one storefront, not a stack of dashboard widgets.

## Implementation
- Rewrote hero copy and composition around the rental value proposition.
- Replaced emoji-heavy utility chrome with a quiet inline utility rail.
- Simplified language labels to TH/EN and reduced utility visual weight.
- Reframed search/filter as a compact command surface.
- Replaced generic repeated section copy with an editorial Upcoming/งานที่กำลังเปิดจอง heading.
- Tightened event-grid rhythm and card elevation.
- Reduced persistent LINE CTA dominance.
- Upgraded Art Director to V2 with content-first, competing-surface and persistent-CTA anti-patterns.

## Safety
No pricing, booking, inventory, event visibility, API or production data semantics changed. No production writes by Art Director.

## Acceptance
Exact-head Admin Regression + Storefront Automated Visual QA required before merge. Production must reach READY on the merged SHA. Owner production visual review remains the final aesthetic evidence because automated QA is not treated as proof of taste.
