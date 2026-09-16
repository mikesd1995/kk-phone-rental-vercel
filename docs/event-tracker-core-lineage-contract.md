# Event Tracker → Core immutable lineage contract

Status: **contract implemented, production bridge NOT YET wired**.

## Problem

Event Tracker and Core use different identity cardinalities:

- Event Tracker has `FAM|...` event-family identity and `SHOW|...` / `SHOWSET|...` show identity.
- Core `01_Events` uses one `EVT-YYYYMMDD-...` event row per rental/event date.
- A Tracker `SHOWSET|...` can represent multiple dates, while Core needs separate daily events.
- Ticket lifecycle (for example `SOLD_OUT`) is not rental lifecycle and must never be copied as rental availability state.

Name/date fuzzy matching is not accepted as an immutable bridge because Core IDs are generated with collision suffixes (`-2`, `-3`, ...). Recomputing an ID from a title can therefore select the wrong historical row.

## Required mapping

Each bridge row must contain an explicit existing Core event ID:

- `mapping_version`
- `event_family_id` — must be `FAM|...`
- `tracker_show_id` — `SHOW|...` or `SHOWSET|...`
- `show_instance_id`
- `event_date`
- `core_event_id` — explicit `EVT-...`
- `ticket_lifecycle` — optional, informational for the ticket domain only
- `rental_lifecycle` — optional, independent rental-domain state
- `mapping_status=EXPLICIT`
- `lineage_key` — deterministic SHA-256 over immutable identity fields

For a `SHOWSET|...`, the bridge creates a date-scoped show instance:

`SHOWSET|...|DATE|YYYY-MM-DD`

This makes one family safely map to many daily Core events without collapsing dates.

## Invariants

1. One date-scoped Tracker show instance maps to exactly one Core event.
2. One Core event maps back to exactly one Tracker show instance.
3. A family may map to many show instances/dates.
4. If a Core ID embeds `EVT-YYYYMMDD-...`, that date must equal `event_date`.
5. The Core event ID must be explicit; the bridge must not infer it from event name/title.
6. Replaying the same explicit mapping produces the same lineage key.
7. Ticket lifecycle and rental lifecycle remain separate. `SOLD_OUT` tickets do not imply rental closed/unavailable.
8. Duplicate or ambiguous mappings fail closed.

## Production cutover sequence

1. Create a persistent mapping surface with the fields above (existing governed surface preferred; do not invent a new production sheet until ownership/schema are approved).
2. Backfill mappings from authoritative existing Tracker and Core IDs; ambiguous rows remain explicit debt/HOLD.
3. Exact-read and validate all mappings with `validateLineageSet`.
4. Add read-only reconciliation reporting: orphan Tracker show instances, orphan Core events, duplicate/ambiguous mapping, date mismatch.
5. Only after reconciliation is clean, wire Event Tracker → Core synchronization to resolve through the explicit bridge.
6. Keep ticket lifecycle and rental business availability as separate write domains.
7. Run idempotent replay and multi-day acceptance before enabling any automatic production writer.

## Current boundary

`api/lib/event-lineage-bridge.js` is intentionally a pure validation/resolution library. It performs **zero production writes**. This closes the missing identity-contract/code primitive but does not by itself close SYS-P0-003; runtime/persistent mapping and replay acceptance are still required.
