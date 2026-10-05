# KK Competitor Universe Policy V1 — 2026-10-05

## Owner-locked policy

The historical 10 X competitor accounts are a **seed baseline, not a hard cap**.

- Keep the existing 10 accounts as protected baseline coverage.
- The competitor universe may expand beyond 10.
- Operational target: **20 shops/accounts** when discoverable with credible rental evidence.
- More than 20 is allowed; current scanner safety cap is 50 to bound query/runtime cost.
- Newly discovered accounts must look like actual phone-rental competitors from evidence (X/Twitter account + rental intent + event/title overlap + parsable rental price). Do not add arbitrary fandom/user accounts merely because they mention an event.
- Learned competitors may be carried into later scans via the configured/learned competitor universe.
- Never remove the protected baseline 10 merely because additional competitors are learned.

## Pricing semantics

The expanded universe improves market coverage; it does **not** require 20 prices for every event.

For each event:
1. use fresh exact-event independent competitor evidence when available;
2. compute package-specific median from the valid independent evidence actually found;
3. if exact-event evidence is absent, use the locked Phase-3 fallback ladder;
4. booked candidates remain price-locked;
5. owner-hidden/tombstoned candidates remain protected.

Expanded competitor discovery is read-only and must keep `production_writes=0`.

## Current implementation

`server/kk-ultra-deep-competitor-price-scanner.js` V4:
- base competitors: 10;
- default universe target: 20;
- bounded maximum: 50;
- supports configured and learned competitor accounts;
- generic search can learn a new account only when rental-shop evidence passes the scanner checks.
