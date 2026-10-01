# Storefront V4 closed-loop redesign — 2026-10-01

## Trigger
Owner real-device screenshots rejected the live storefront as unprofessional. Evidence showed oversized pre-event composition, utility controls competing with product discovery, wrapping filters, dense two-column mobile cards and floating LINE obstruction.

## Root cause
Art Director V3 and UX Reviewer were callable but mostly deterministic direction/geometry gates. Screenshot evidence was reviewed outside the runtime rather than converted into a first-class critic that can force another design iteration.

## Runtime correction
Added `kk-storefront-visual-critic` and Agent Gateway routes `storefront_visual_critique` and `storefront_design_loop_acceptance`. Visual QA now calls the critic for every viewport. P0/P1 composition findings fail the run. Closed-loop acceptance requires at least two review rounds and screenshot artifact evidence.

## V4 product direction
Primary mobile path: brand -> concise proposition -> search/filter -> events -> event detail -> booking.
FAQ is secondary. Language UI and persistent LINE overlay are removed from the primary mobile path. Mobile event presentation changes from dense two-column cards to compact single-column poster rows.

## Business invariants
No event/pricing/inventory/booking API or write-path changes. Existing script/data semantics remain authoritative.

## Negative baseline
Owner screenshots from 2026-10-01 are rejection evidence. V4 must not reproduce: late event discovery, multi-row filter breakage, floating CTA over posters, large utility pills before products, or narrow two-column information cards.

## Acceptance
Exact-head regression + visual QA at 320/375/390/430/480/768/1024; Visual Critic PASS at every width; screenshot artifact review; owner rejection cleared before production.
