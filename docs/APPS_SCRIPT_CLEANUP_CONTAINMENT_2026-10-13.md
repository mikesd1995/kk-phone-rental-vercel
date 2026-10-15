# Pinned 9.5.9 cleanup containment candidate — 2026-10-13

Status: LOCAL CANDIDATE ONLY. This is containment, not an operational archive repair, a production save, a deployment, or project closure.

## Evidence and decision

The owner requested completion of KK repairs and permits temporary event images. The Apps Script live editor source, read on 2026-10-13, normalized to SHA-256 `40fffe288d55c1991fda1bd133670b7b41f90822acd834ec887e00c1f0f1b87e`, matching the pinned recovered 9.5.9 source. The last observed cleanup failure was `Invalid date: 14/11/2026`. A date-only candidate resolves that parse failure but would allow unsafe legacy writes to proceed: customer statistics increment before archive success, archive writes have no exact readback, and partial failures can be retried without transaction reconciliation.

The 2026-10-13 bounded sheet read found two bookings, fourteen events and thirty-nine override rows within the old-data effect set at the 2026-09-13 threshold. These counts are a snapshot, not a production execution claim. Synthetic fixtures with the same counts are used in tests; no customer personal information is embedded.

The live `00_Master_Booking!A1:A85` FORMULA read has a mixed identity contract: A40, A41, A52 and A61:A85 contain formulas using cumulative D5:Drow lookup/count logic; eligible A14/A16 are constants; A8 is an identity-only constant and A10 is empty. The pinned booking creators write B:T and rely on column A identity behavior. A generic A:T cleanup would therefore damage formulas and future identity allocation, while clearing event references can change downstream cumulative identities. Neither generic clearing nor transplantation of a newer cleanup implementation is safe.

## Small change plan and preserved boundaries

The new local builder composes the existing pinned date repair, then replaces only `kkCleanupOldData30Days_`. It rejects source drift. The canonical source and recovered source remain unchanged. The candidate changes cleanup behavior; no booking-creation writer, trigger, deployment version, scheduler, pricing or visibility function is modified.

Cleanup first acquires the existing document lock, reads all physical rows in the three operational ranges (events A:I, bookings A:T, overrides A:G starting row 5), and preflights IDs/dates. Direct bounded-width reads avoid the legacy helper's first-three-column trimming hiding trailing malformed booking payloads. Duplicate event/booking IDs or missing required identities fail closed. Multiple override rows for an event are legitimate. Identity-only bookings and unresolved event orphans are retained; booking creation time is never substituted for event time.

If any old row would be archived, the function throws `CLEANUP_ARCHIVE_RECONCILIATION_REQUIRED` with only aggregate counts. It does not create archive sheets, append archives, clear operational cells, update statistics, or flush mutations. All acquired-lock paths release the lock. The existing manual/API/automatic wrappers propagate failure rather than reporting completion. If no eligible old data exists, it returns the existing zero-count result shape. This result does not prove all orphan data reconciled.

## Validation and remaining work

The regression suite first reproduced the unsafe date-only candidate attempting archive setup before its lock. Candidate tests cover the current-shaped effect set, zero writes on retries, invalid late dates, threshold behavior, unresolved orphan preservation, identity ambiguity, trailing malformed payload, lock/read failure, wrapper failure propagation, and preservation of every source byte outside the two selected functions after newline normalization. Full regression and independent review are owned by the integrating parent task; no acceptance is claimed here.

To restore active archiving, first establish and approve a stable booking identity/allocator contract compatible with the live formulas and every B:T writer, then design archive deduplication, append/readback/reconciliation, safe clearing and idempotent statistics under the existing lock/fencing contract. Partial execution recovery must preserve identity and source references. Do not use this containment candidate as proof that those operations work.

Saving editor HEAD is production-affecting because installed time triggers execute HEAD. Any release still requires fresh live source/policy checks, explicit approval of the exact candidate and rollback, and subsequent runtime/readback evidence. This work performs no such release and does not disable or replace any trigger.

## Completed local checkpoint

Generated normalized candidate SHA256: `57b123daaec474906a6b27649df88e3cbb91cfdce0afd211a2a6b372a01ebdb2`. Implementer date/containment tests33/33 and context-selected tests86/86 passed. Parent offline-guarded full regression1525/1525 passed, zero failures or skipped tests; `npm run check` exited0. Independent reviewer separately ran33/33 and reproduced the candidate hash, finding no confirmed BLOCKER/MATERIAL within containment-only scope.

Reviewer NOTE: blank template rows containing boolean false or numeric zero defaults are treated as populated and may fail preflight. This is a fail-closed availability/diagnostic limitation, not a mutation hole. Check actual template cells before release; do not broadly ignore defaults and accidentally hide malformed business data. Candidate source is locally verified only. Hosted CI, runtime acceptance and active archival repair remain incomplete.
