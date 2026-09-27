# Commercial Pricing Fallback V2 — 2026-09-28

## Owner rule
Missing exact-event competitors must not automatically discard an otherwise valid event. Commercial prep now proposes a reference price with explicit provenance and confidence.

## Ladder
- 3+ independent exact-event competitors: exact median, HIGH confidence.
- 1-2 independent exact-event competitors: limited exact median, MEDIUM confidence.
- 0 exact competitors + comparable-event evidence: comparable median, MEDIUM_LOW confidence.
- 0 market evidence + approved KK baseline: approved baseline median, LOW confidence.
- No evidence and no approved baseline: HOLD / PRICING_REFERENCE_UNAVAILABLE.

A proposal is evidence for the Final Pricing Policy, not the final KK selling price. auto_final_price is always false; final price write remains prohibited until explicit final_prices, Final Verifier approval and owner publish policy pass.

No business data, event, booking, inventory, visibility, Sheet or scheduler mutation is performed by this stage.
