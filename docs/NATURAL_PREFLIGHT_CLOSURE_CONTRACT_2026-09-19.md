# Natural Scanner / Verifier Preflight Closure Contract — 2026-09-19

## Status

**REGRESSION CONTRACT STAGED / NO PRODUCTION RUNTIME MUTATION / NATURAL ACCEPTANCE STILL REQUIRED**

Issue #50 records two separate natural runtime-body failures:

1. Verifier 09:30 — Manifest append did not exact-read under immutable identity.
2. Scanner 10:00 — current-occurrence due-work denominator could not be proven safely before Manifest freeze.

This contract addresses only deterministic decision semantics in repository code. It does not claim the live task runtime has adopted them yet and does not close Issue #50 without later natural evidence.

## Verifier Manifest append/readback

The new `evaluateManifestAppendReadback` contract requires one immutable identity:

- Manifest ID
- Run ID
- Role
- Fencing Token

A caller may supply a bounded sequence of readback attempts. The default bound is 3 and the hard maximum is 5.

Allowed transient behavior:

`0 rows -> 0 rows -> exact1 immutable match`

Rejected behavior:

- duplicate rows;
- wrong Run ID;
- wrong Role;
- wrong Manifest ID;
- fencing-token drift;
- malformed readback attempt;
- more attempts than the declared bound;
- no visibility before the bound expires.

The evaluator never chooses one row from duplicates and never changes identity between attempts.

This provides a safe contract for a later live implementation of bounded read-after-append retry without weakening exact1 identity.

## Scanner due-work denominator

The new `resolveScannerDueWorkDenominator` contract requires all four evidence classes to be explicitly supplied for the current occurrence:

1. `p0_preemption` — source state `ACTIVE_P0`
2. `current_pack` — source state `RESERVED_CURRENT_PACK`
3. `missed_pack_catch_forward` — source state `ELIGIBLE_CATCH_FORWARD`
4. `regression_debt` — source state `OPEN_REGRESSION_DEBT`

Every supplied due-work item must contain:

- unique Work ID;
- evidence ID;
- exact target occurrence ID;
- `due=true`;
- the exact source state for its evidence class.

Fail-closed behavior:

- a missing bucket is not interpreted as empty;
- unknown buckets are rejected;
- duplicate Work IDs across classes are rejected;
- work bound to another occurrence is rejected;
- state mismatch is rejected;
- malformed evidence returns no denominator and no Planner.

Only when all four buckets are explicitly present and empty may the resolver return:

`SCANNER_DUE_WORK_EVIDENCED_NO_OP`

with denominator `0`.

When work exists, Planner order is deterministic:

`P0 -> current pack -> missed-pack catch-forward -> regression debt`

and then lexical Work ID order inside each class.

## Safety boundary

This repository change does not:

- append a Manifest;
- create Planner rows;
- modify Google Sheets;
- enable Scanner/Verifier/Canary;
- modify schedules;
- mutate Machine SOT;
- deploy Apps Script;
- activate HF;
- send provider/customer notifications;
- count any natural-run acceptance.

## Acceptance still required

Issue #50 remains open until natural governed runs prove the corrected paths.

Verifier acceptance requires a future natural run to:

- acquire exact governed locks;
- append/freeze its Manifest;
- exact-read immutable identity using bounded semantics;
- terminalize the Manifest;
- release locks cleanly;
- leave the canonical task ON.

Scanner acceptance requires a future natural run to:

- derive all four due-work evidence classes from live governed state;
- resolve an exact current-occurrence denominator;
- freeze Manifest/Planner from that exact denominator;
- execute governed work or an evidenced no-op;
- terminalize cleanly;
- leave the canonical task ON.

No manual, backfilled, repository-only or synthetic test counts toward natural acceptance.
