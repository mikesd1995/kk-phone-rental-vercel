# Pinned 9.5.9 transactional cleanup candidate

Date: 2026-10-13, Asia/Bangkok. Scope: offline Apps Script source repair. Production release and runtime acceptance are pending.

## Current evidence and scope

The live editor source captured earlier this date matched normalized pinned recovered 9.5.9 SHA256 `40fffe288d55c1991fda1bd133670b7b41f90822acd834ec887e00c1f0f1b87e`. Scheduled cleanup failed with `Invalid date: 14/11/2026`. A date-only correction would unblock legacy archive writes that incremented statistics before archive readback and cleared B:T while leaving identity in A. The prior containment candidate prevents those writes but does not restore archiving.

This builder composes the pinned date correction, replaces only the cleanup function with the transaction helpers, and narrowly changes the two booking creators. Recovered source and canonical `apps-script/Code.gs` are unchanged. The builder rejects base-source drift and ambiguous replacement anchors. No new provider, sheet, scheduler, dependency, or business-policy authority is added.

Fresh connector reads verified the seven operational/archive header rows. Master identity templates coexist with immutable constant IDs. CustomerStats has 52 rows totaling 59 rentals; 64 booking archive rows contain 59 rental-status entries. Counts and first/last rental dates match for all current customer keys. The two archived September 12 bookings each already count once. Identity-only ghosts are retained for separate reconciliation; this repair does not increment or decrement their statistics.

## Transaction behavior

- Cleanup acquires the existing DocumentLock before reading or writing. Schema/date/identity/formula validation is read-only; it never repairs headers or creates archive sheets speculatively.
- Clearly eligible historical terminal bookings are archived before their overrides and events. Future, nonterminal, orphan, formula-dependent, already archived and financially ambiguous records are retained. Booking creation time never substitutes for an unknown event date. Events stay while dependent bookings/overrides survive.
- A single private DocumentProperties checkpoint records a typed source before-image, exact fixed archive destination/payload, event context, and absolute customer-stat before/after values. A digest, byte limit, schema validation and exact property readback precede sheet mutation. Oversized/corrupt checkpoints stop without guessing.
- An archive write accepts only its blank reserved row or its exact prior payload. Conflicting/partial destinations require reconciliation. Statistics use validated deduplicated archive history and exact absolute values, avoiding blind increment or historical decrement.
- Exact archive/stat readback precedes source clearing and checkpoint deletion. Source is compared again before clearing. Master A:T is cleared; U:AM remains untouched. Events clear A:H while preserving derived I; overrides clear A:G. Event context binds immutable identity and A:H values so a corrected date or new dependency prevents stale replay.
- A failed run retains its checkpoint. Recovery preflights current uniqueness/schema/date integrity and customer history before writing. An exact prior archive/stat/clear is replayed without another append or count. Returned `recovered_transaction` makes recovery visible separately from newly archived totals.

## Booking identity and ambiguous creation

Both existing API and dashboard creators retain their validation and asset selection; the dashboard now holds the same DocumentLock. A bounded port of the canonical allocator uses event date and sequence (`BK-YYYYMMDD-001`) across Master and Archive. An empty A formula is overwritten only for the consumed row; B:T formula conflicts and grid exhaustion stop before checkpoint mutation. Untouched A templates and U:AM formulas remain intact.

The private create checkpoint blocks subsequent creation while an outcome is ambiguous. Explicit `kkRecoverPendingBookingCreation()` runs under DocumentLock while archival activation remains OFF. It confirms either the exact existing booking or an exact uncommitted before-image and deletes only the checkpoint after readback; it never creates a second booking. This is a governed reconciliation operation, not automatic request replay. The pinned API has no stable request idempotency key, so the operator must reconcile the returned booking ID before retrying an incoming request.

## Coupled release interlock and limits

Cleanup is OFF unless `KK_ACTIVE_CLEANUP_RELEASE_V1` records matching schema/creator version, owner approval and external writer fencing. This property is configuration; it does not independently prove release or fencing.

Installed time triggers execute editor HEAD, while the observed web API uses version 52. Saving HEAD without coupled promotion can otherwise combine A:T cleanup with the older B:T creator. Release therefore requires a fresh exact source/policy capture, approved exact candidate and rollback, writer quiescence, verified creator promotion/readback, then controlled activation and archive/source/stat readback. Vercel direct event/override writers are outside Apps Script DocumentLock; coordination must cover them and manual sheet edits. Do not activate while any writer can bypass this coordination.

The candidate does not automatically reconcile existing ghosts, ambiguous cancelled amounts or historical archive conflicts. Those remain explicit business/runtime work. Local fixture checks do not prove deployment, provider state, receipt/refund facts, scanner recall, or completed project closure.

## Validation

Tests reproduce ordinary archival, failure after checkpoint/archive/stats/clear/delete, malformed dates and schemas, duplicate IDs/history drift, corrupted/oversized checkpoints, source and event-context changes, dynamic event-helper recalculation, immutable identity with A formulas, capacity exhaustion, real API/dashboard execution and explicit create reconciliation while cleanup remains OFF. A regression first reproduced silent archive corruption after statistics write allowing source clear; the final repair adds readback immediately before clear and before commit.

The integrating parent records exact final independent review, full regression, candidate hash and engineering gate in the dated workspace handoff. Until RELEASE_READBACK is present the repository engineering gate remains BLOCKED.
