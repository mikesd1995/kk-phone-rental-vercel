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

## QA correction
Initial exact-head Visual QA rejected the quieter utility rail because its language segments (and at tablet width follow/FAQ) fell below accepted tap heights. Visual weight remains reduced, but all interactive utility targets are restored to >=44px.

Second QA pass proved 320–480px at readiness 100, but legacy tablet/desktop language-button height rules still overrode the minimum at 768/1024. V2.2 now explicitly locks language buttons to 44px across all widths.

Third QA pass isolated selector specificity from legacy language-control CSS as the remaining 768/1024 tap-height override. Added an ID-scoped V2.2 override rather than weakening the acceptance threshold.

Fourth correction addresses rendered box geometry rather than CSS minimum declarations: language buttons are explicit flex border-box controls at 46px so measured tap rectangles remain >=44px after inherited/legacy box rules.

Root cause confirmed in legacy `style.css`: breakpoint rules set `.language-switch .lang-btn` to 40px at >=769px and related mobile rules. Final correction uses an explicit V2 stylesheet direct-child block-size override, preserving the 44px acceptance floor without changing the gate.

Latest geometry evidence confirmed height=46px but tablet/desktop language width remained 38px. Final correction sets the direct-child hit area to 46x46px; the visible TH/EN treatment remains compact.
