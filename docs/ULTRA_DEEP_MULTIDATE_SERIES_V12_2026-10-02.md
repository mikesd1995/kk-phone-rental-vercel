# Ultra Deep Multi-Date Series V12 — 2026-10-02

## Live blocker

Zero-write V11 acceptance run `37029853387` reduced reconciliation to one real gap:
`The Weeknd: After Hours Til Dawn Tour` on 2026-10-12.

Independent official evidence confirms the Bangkok series runs 11–13 October 2026 at Rajamangala National Stadium. Discovery had found the same official series for 2026-10-13, but the search adapter represented only one result date and reconciliation compared date-decorated result titles literally.

## V12 repair

- Parse bounded English date ranges from search evidence, including:
  - `Oct 11-13, 2026`
  - `11–13 October 2026`
- Expand only short ranges of at most 7 calendar days.
- Keep one candidate per expanded date.
- Canonicalize event-series search-title boilerplate only for reconciliation.
- Continue to require an exact event_date match after expansion.
- Do not allow a 13 October candidate to satisfy a 12 October reference unless the search evidence itself expands to 12 October.

## Safety

- no storefront writes
- no pricing writes
- no booking/inventory writes
- authoritative=false
- Verifier required
- production_writes=0
- malformed/long date ranges are not expanded
- SOT classification keeps its existing exact key; series canonicalization is reconciliation-only
