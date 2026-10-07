# November 2026 Ultra Deep — suppression-safe metadata reconciliation — 2026-10-07

## Owner requirement

Monthly Ultra Deep must never resurrect an event/date previously hidden, closed, rejected, pruned, or manually disabled. Those identities remain durable tombstones until an explicit owner reopen.

At the same time, suppressed events must still be re-checked so the owner is informed about verified official changes, while currently visible events must keep verified metadata current.

## Source changes in this branch

- Production reconciliation now resolves durable history by canonical event ID before fuzzy/date matching.
- LOCKED/SEEN_CORE candidates remain terminal `SKIPPED_EVENT_HISTORY`.
- Suppressed candidates can emit `suppressed_updates[]` with report-only date/venue/poster/lifecycle deltas.
- Suppressed-update reports always carry `publish_allowed=false`.
- Full booking dates no longer prevent metadata reconciliation of an already-existing active event.
- Pricing is locked when any active booking exists on the event date; metadata refresh is independent of that price lock.
- Existing-event governed updates can now carry verified `event_date`, `venue`, and official poster in one `updateEvent` mutation.
- Exact readback now validates date and venue as well as poster.
- Multi-day behavior remains per event/date; no lock is cleared automatically.

## November live-data observations preserved from the 2026-10-07 scan

- Core/Web Ready contains a large November universe with many persistent owner locks. Hidden/locked rows must not be treated as missing candidates.
- CAT EXPO is correctly date-specific: 21 Nov full and 22 Nov still has remaining inventory in current Web Ready evidence.
- K*Pop Masterz has separate 14/15 Nov show-date lineage; 15 Nov is not treated as accidental resurrection.
- Event Tracker summary trails Web Ready for some November additions; reconciliation must compare canonical Core/Web Ready before claiming a discovery miss.
- Exa fallback was attempted and returned credit-limit/402; no top-up is authorized. Zero-cost public/official search remains the fallback.
- Production business writes remain disabled until current production runtime/read-only acceptance and exact readback gates are satisfied.

## Safety

- production_writes=0 for this source repair.
- no deployment triggered.
- no merge triggered.
- no paid provider/top-up.
- no scheduler created or duplicated.
- Verifier and exact readback remain mandatory.
