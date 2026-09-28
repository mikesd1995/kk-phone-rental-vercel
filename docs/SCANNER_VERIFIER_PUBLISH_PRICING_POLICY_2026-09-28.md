# Scanner / Verifier Publish & Pricing Policy — 2026-09-28

## Why this changed

The October full-loop review exposed an incorrect coupling: candidates with good rental demand could be held only because no exact-event competitor price was found. The owner clarified that competitor pricing is a pricing signal, not a publish gate.

## Permanent rules

1. Publish eligibility and pricing confidence are separate.
2. A verified event that passes the rental-fit threshold may continue toward publication even with zero exact-event competitor prices.
3. Scanner remains staging-only and never invents/writes final prices.
4. Final prices must come from an approved KK pricing policy.
5. Friday–Sunday score-fallback prices without exact-event competitor evidence are provisional and require later price recheck.
6. Existing `active_on_web=false` events are owner-hidden and cannot be reopened/recreated by Scanner, Verifier, or Full Loop.
7. Close booking = keep card visible as full/waitlist. Close event = hide card.

## Code changes

- `server/kk-discovery-commercial-prep.js` V3
  - adds rental-fit publish eligibility;
  - permits score-qualified candidates to reach final Verifier without a pricing reference;
  - keeps low-fit rejection explicit.
- `server/kk-final-pricing-policy.js` V3
  - adds owner-approved rental-fit fallback tiers;
  - keeps lens-only hidden;
  - marks Friday–Sunday zero-competitor fallback prices `PROVISIONAL_NEEDS_PRICE_RECHECK`.
- `server/kk-verifier-storefront-promotion.js` V3
  - accepts score-qualified candidates with approved final pricing;
  - surfaces price confidence/recheck metadata;
  - blocks hidden-event recreate/reopen through createEvent.
- Scanner/Verifier skill contracts updated.

## Regression coverage

Tests cover:
- high-score/no-competitor discovery handoff;
- low-score rejection;
- weekend provisional fallback pricing;
- weekday approved score fallback;
- lens-only hidden baseline;
- owner-hidden promotion block;
- explicit owner reopen routed away from createEvent;
- existing storefront waitlist semantics remain protected by prior regression tests.

## Safety

- Scanner production writes remain zero.
- Pricing proposals do not become final prices without approved policy.
- Governed Admin create/readback path remains unchanged.
- Owner-hidden state remains fail-closed.
