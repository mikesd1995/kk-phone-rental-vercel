# Ultra Deep Reconciliation Identity V9 — 2026-10-02

Live zero-write V8 acceptance run 37023020283 proved DDGS provider recovery but held FULL on 23 reconciliation gaps.

Artifact inspection showed the missing set was dominated by generic search-result/calendar/noise rows with no event_date. These rows are valid search evidence but do not have enough identity to assert that discovery missed a specific event.

V9 keeps the gate fail-closed for independently identified events:
- a reference must have normalized title + canonical YYYY-MM-DD event_date before it can create a reconciliation gap;
- unstructured reference evidence is counted separately and remains visible;
- a dated independent event missing from discovery still blocks FULL;
- title normalization now correctly collapses whitespace (fixes the prior /s+/ typo);
- production_writes=0, authoritative=false, Verifier remains required.

This is a false-positive correction, not a relaxation of event-level reconciliation.
