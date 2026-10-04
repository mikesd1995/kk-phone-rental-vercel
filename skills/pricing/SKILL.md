# Skill: pricing
Use for KK rental pricing decisions.

## Authority
Executable pricing code and current Machine SOT are authoritative. This skill is routing/procedure guidance and must not invent a parallel pricing algorithm.

## Required behavior
- Preserve booking price locks and governed pricing writes.
- When exact-event competitor evidence exists, use the current executable exact-event median policy.
- When exact-event competitor evidence is absent, delegate to `server/kk-final-pricing-policy.js` and its currently approved score/baseline fallback. Do not substitute an undocumented comparable-event formula.
- Comparable artist/fandom/type/venue/seat-map evidence may inform evidence collection, rental-fit scoring or an explicitly approved future policy change, but it is not itself final-price authority unless executable policy is changed and accepted.
- Never leave a publishable event without a price when the current approved fallback resolves one; preserve HOLD when executable policy cannot resolve an approved price.
- Canonical evidence and exact readback are required for writes.
- Do not alter lens-only visibility, booking locks, owner-hidden/tombstone rules, or protected policy as a side effect.

## Acceptance
Pricing policy changes require targeted regression, protected-policy review, and the applicable gates in `ACCEPTANCE.md`.