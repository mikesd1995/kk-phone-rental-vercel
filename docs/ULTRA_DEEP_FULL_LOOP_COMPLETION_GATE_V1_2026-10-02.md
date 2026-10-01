# Ultra Deep Full-Loop Completion Gate V1 — 2026-10-02

## Incident
A chat-triggered October Ultra Deep request was prematurely described as an Ultra Deep Scan after partial public-web discovery. That violated the existing full-loop contract: discovery was treated as completion even though competitor pricing/fallback, verified poster, storefront comparison, governed publish and production readback were not proven.

## Fix
Added a deterministic completion gate. Ultra Deep may claim COMPLETE only when evidence exists for:
1. exhaustive discovery coverage;
2. verification and deduplication;
3. competitor pricing or explicit governed fallback plus final KK price;
4. verified HTTPS poster;
5. storefront comparison;
6. explicit publish decision;
7. governed publish for publish-required events;
8. production storefront readback for published events;
9. final report readiness.

Missing exact-event competitor evidence is not a blocker by itself. It must route through the existing fallback-pricing policy and produce an explicit final KK price.

## Learning rule
The durable failure fingerprint is ULTRA_DEEP_PREMATURE_COMPLETION. Any recurrence must reuse this completion gate and regression coverage before proposing new architecture.

## Authority
This gate does not add a writer and does not weaken Scanner staging-only authority. It validates completion evidence only. Existing governed Admin write paths, Verifier and production readback remain authoritative.

## Acceptance
A discovery-only result must be BLOCKED_INCOMPLETE_FULL_LOOP. COMPLETE is allowed only after the end-to-end discovery-to-production evidence chain is proven.
