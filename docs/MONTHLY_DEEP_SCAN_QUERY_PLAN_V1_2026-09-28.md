# Monthly Deep Scan Query Plan V1 — 2026-09-28

Adds the missing deterministic intent-to-search boundary for commands such as "Deep Scan next month". Given a supplied current date or explicit YYYY-MM, the planner resolves the exact month window and generates bounded Thai/English discovery queries across all eight required source tiers.

This is a query planner only: no event, price, Sheet, booking, inventory, visibility or scheduler writes. Provider evidence remains non-authoritative and Verifier-required.

For 2026-09-28 the next-month window is 2026-10-01 through 2026-10-31. Live autonomous acceptance still requires a reachable unknown-URL provider endpoint and production runtime on an accepted SHA.
