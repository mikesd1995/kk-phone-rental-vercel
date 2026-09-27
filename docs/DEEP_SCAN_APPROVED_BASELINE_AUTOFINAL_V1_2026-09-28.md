# Deep Scan Approved Baseline Auto-Final V1 — 2026-09-28

Closes the gap where a verified event with sparse/no exact competitor pricing could be discovered but never reach storefront because every event required a manual final-price payload.

Policy:
- competitor/comparable medians remain reference-only;
- only KK baseline rows explicitly marked approved=true and carrying a template/package ID can resolve final prices automatically;
- unapproved/missing baselines fail closed;
- Final Verifier, poster evidence, duplicate guard, governed Admin writer, Web Ready and exact storefront readback remain mandatory;
- no second writer is introduced.

This lets zero-competitor events continue through Pricing Fallback V2 without silently turning market references into KK selling prices.
