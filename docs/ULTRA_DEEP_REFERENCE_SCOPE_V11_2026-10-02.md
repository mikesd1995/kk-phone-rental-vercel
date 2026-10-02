# Ultra Deep Reference Scope V11 — 2026-10-02

Live V10 acceptance run 37027567473 recovered provider/discovery/reference execution but still reported seven reconciliation gaps. Artifact review showed these were not seven missed KK-rental events: examples included a Hong Kong concert, a December fansign, Roblox code pages, breathwork, a YouTube classical item without Bangkok identity, and a September game-memory page.

V11 separates search evidence from comparable event evidence.

A reference can contribute to reconciliation only when:
- it has a structured event date;
- the date is inside the requested month;
- it is not obvious non-rental noise;
- it is not explicitly outside Bangkok scope;
- its title has a supported entertainment/fandom event signal, or its URL has a trusted event-page shape.

Excluded references remain counted with reason codes. They cannot create false gaps and they also cannot satisfy the independent-reference requirement. At least one eligible structured independent reference remains mandatory for FULL.

Safety remains unchanged: authoritative=false, Verifier required, production_writes=0, no storefront/pricing/booking/inventory mutation.
