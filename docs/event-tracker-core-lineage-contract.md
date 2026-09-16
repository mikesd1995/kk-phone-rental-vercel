# Event Tracker → Core immutable lineage contract

Status: **contract implemented, production bridge NOT YET wired**.

## Problem

Event Tracker and Core use different identity cardinalities:

- Event Tracker has `FAM|...` event-family identity and `SHOW|...` / `SHOWSET|...` show identity.
- Core `01_Events` uses stable `EVT-...` event identities and a separate mutable/current `event_date` field.
- A Tracker `SHOWSET|...` can represent multiple dates, while Core needs separate daily event instances.
- Ticket lifecycle (for example `SOLD_OUT`) is not rental lifecycle and must never be copied as rental availability state.

Name/date fuzzy matching is not accepted as an immutable bridge because Core IDs are generated with collision suffixes (`-2`, `-3`, ...), and an existing Core ID may retain text derived from an earlier/original date after the event's current date changes. Recomputing or interpreting a Core ID from title/date can therefore select or reject the wrong historical row.

## Required mapping

Each bridge row must contain an explicit existing Core event ID:

- `mapping_version`
- `event_family_id` — must be `FAM|...`
- `tracker_show_id` — `SHOW|...` or `SHOWSET|...`
- `show_instance_id`
- `event_date` — explicit current mapping date; authoritative for this bridge row
- `core_event_id` — explicit stable `EVT-...`; treated as an opaque immutable identity
- `ticket_lifecycle` — optional, informational for the ticket domain only
- `rental_lifecycle` — optional, independent rental-domain state
- `mapping_status=EXPLICIT`
- `lineage_key` — deterministic SHA-256 over mapping version + explicit identity fields

For a `SHOWSET|...`, the bridge creates a date-scoped show instance:

`SHOWSET|...|DATE|YYYY-MM-DD`

This makes one family safely map to many daily Core events without collapsing dates.

## Invariants

1. One date-scoped Tracker show instance maps to exactly one Core event.
2. One Core event maps back to exactly one Tracker show instance in the accepted mapping set.
3. A family may map to many show instances/dates.
4. `event_date` is explicit mapping data; the bridge must not infer the current date from text embedded inside `core_event_id`.
5. The Core event ID must be explicit; the bridge must not infer it from event name/title/date.
6. Replaying the same explicit mapping produces the same lineage key.
7. Ticket lifecycle and rental lifecycle remain separate. `SOLD_OUT` tickets do not imply rental closed/unavailable.
8. Duplicate or ambiguous mappings fail closed.

## Production evidence behind the opaque-ID rule

During production acceptance on 2026-09-16, the public Web Ready projection contained an existing Core row whose stable ID was `EVT-20261025-LYKN-REFLEXION-CONCERT-2` while its current `event_date` was `23/10/2026`. That evidence proves the date-looking segment inside an `EVT-...` identity cannot be treated as authoritative current-date data. The bridge therefore treats `core_event_id` as opaque and keeps current mapping date explicit.

## Production cutover sequence

1. Create or designate a governed persistent mapping surface with the fields above; do not create an uncontrolled competing truth store.
2. Backfill mappings from authoritative existing Tracker identities, current event dates, and explicit existing Core IDs; ambiguous rows remain explicit debt/HOLD.
3. Exact-read and validate all mappings with `validateLineageSet`.
4. Add read-only reconciliation reporting for orphan Tracker show instances, orphan Core events, duplicate/ambiguous mappings, and explicit date/identity changes without interpreting the Core ID text as current date.
5. Only after reconciliation is clean, wire Event Tracker → Core synchronization to resolve through the explicit bridge.
6. Keep ticket lifecycle and rental business availability as separate write domains.
7. Run idempotent replay and multi-day/date-change acceptance before enabling any automatic production writer.

## Current boundary

`server/event-lineage-bridge.js` is intentionally a pure validation/resolution library. It performs **zero production writes**. This closes the missing identity-contract/code primitive but does not by itself close SYS-P0-003; persistent mapping, backfill reconciliation, replay and runtime acceptance are still required.
