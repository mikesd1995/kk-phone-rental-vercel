# Tracker → Core Promotion Gate — 2026-09-24

## Purpose

Close the missing decision-contract layer between verified Event Tracker truth and the canonical Core backend without activating a new production writer.

The existing `event-lineage-bridge.js` proves identity mapping but deliberately performs zero writes. Direct Writer Phase 1 can update an existing Core event after its external acceptance gates pass, but it deliberately does not create new Core events.

This leaves a critical full-loop gap:

```
Verifier canonical truth
  -> ?
  -> Core 01_Events
  -> 08_Web_Ready / Storefront
```

`server/tracker-core-promotion-gate.js` fills the question mark as a deterministic, zero-write, fail-closed decision layer.

## Decisions

### READY_UPDATE_EXISTING

Allowed only when all are true:

- Tracker truth is explicitly Verifier-confirmed.
- Canonical status is `ACTIVE` or `VERIFIED`.
- Explicit Tracker↔Core lineage resolves exactly one Core Event ID.
- That Core Event ID exists exactly once in the supplied Core snapshot.
- Direct Writer reports accepted `updateEvent` routing.

The gate returns an `updateEvent` payload but performs **zero production writes** itself.

### UPDATE_EXISTING_GATED

Identity is safe, but Direct Writer external acceptance is not complete.

No write is attempted.

### RECONCILE_LINEAGE_REQUIRED

A normalized Core event with the same event name + event date already exists, but explicit lineage is missing.

The gate refuses to create a duplicate or infer a permanent mapping automatically.

### CREATE_EVENT_AUTHORITY_REQUIRED

The verified Tracker event has no explicit lineage and no safe existing Core identity match.

Current Direct Writer Phase 1 intentionally has `create_event_routed=false`, so the event remains gated until a separately accepted create-event writer path exists.

### BLOCKED

Fail-closed cases include:

- Verifier confirmation missing.
- RAW/HOLD/SKIP/REJECTED/non-promotable canonical status.
- Invalid or ambiguous lineage.
- Lineage references a missing or duplicate Core event.

## Safety properties

- production writes = 0
- no price writes
- no package writes
- no booking/inventory writes
- no poster writes
- no implicit Tracker↔Core mapping
- no createEvent activation
- no Scanner/Verifier authority expansion
- no Apps Script deployment
- no Direct Writer activation

## Full-loop effect

Before this change, the codebase could validate lineage and could update existing Core events through Direct Writer Phase 1, but had no single deterministic decision contract joining those capabilities.

After this change, every verified event can be classified into one of three operational paths:

1. safe existing-Core update;
2. lineage reconciliation;
3. create-event authority debt.

That makes Tracker→Core promotion measurable and auditable without weakening current production safety gates.

## Remaining live acceptance

This code does not claim production completion.

Required live gates remain:

1. Scanner/Verifier natural runtime acceptance under Machine SOT v4.9.35 or later compatible policy.
2. READY backlog returned to SLO.
3. Dedicated Direct Writer service-account credentials + Core Editor grant.
4. Authenticated write-control health, controlled write probe, exact readback and receipt.
5. Separate `createEvent` atomic/idempotent writer acceptance before new Core-event creation.
6. Core → `08_Web_Ready` → Storefront exact acceptance.
