# Draft v4.9.20 — External Scanner Witness Configuration Only

Date: 2026-09-21  
Status: **PROPOSAL ONLY / NOT ACTIVE / NOT WRITTEN TO MACHINE SOT**

## Fresh authority baseline used for this draft

The draft was prepared only after fresh readback proved:

- Machine SOT spreadsheet timezone: `Asia/Bangkok`;
- total `POLICY_VERSION` rows inspected: 22;
- exactly one `POLICY_VERSION` has `Active=TRUE`;
- active policy: `v4.9.19 CANONICAL MINIMAL LAUNCHER`;
- active policy row: 320;
- canonical Scanner ID: `6aacec5fa7f48191b439dbe2308b69cf`;
- canonical Verifier ID: `6aacec85e5508191b26894565fbc3787`;
- canonical Scanner current state: OFF;
- canonical Verifier current state: OFF;
- v4.9.19 one-time same-ID remediation has already been consumed;
- v4.9.19 prohibits automatic repeat re-enable and new identity without a later explicit policy.

This document does not supersede v4.9.19.

## Proposed policy name

`v4.9.20 EXTERNAL SCANNER WITNESS CONFIGURATION ONLY`

## Proposed Machine-SOT rows

These are **draft row specifications**, not Sheet writes.

### POLICY_VERSION

Rule ID: `POLICY_VERSION`

Proposed Rule / Value:

`v4.9.20 EXTERNAL SCANNER WITNESS CONFIGURATION ONLY`

Purpose:

- inherit all non-superseded safety/governance from v4.9.19 and earlier;
- authorize only a bounded witness-clock configuration transition after exact preflight;
- preserve native Scanner/Verifier OFF state;
- preserve Verifier final authority;
- keep Scanner business execution disabled;
- keep HF production disabled;
- keep business writes at zero.

### CONTROL_PLANE_V420_ENTRY_GATE

Proposed Rule / Value:

`REQUIRE_PR111_MERGED+PR114_MERGED+CURRENT_MAIN_CI_PASS+EXACT_CURRENT_MAIN_PRODUCTION_DEPLOYMENT_READY+OIDC_PASS_AND_ROLLED_BACK+NATIVE_SCANNER_OFF+NATIVE_VERIFIER_OFF+NO_WATCHDOG+NO_REPLACEMENT_TASK+CANONICAL_LEDGER_HEALTHY+EDGE_SOURCE_PARITY+CLEAN_INITIAL_LEDGER`

Required evidence:

1. persistence auditor is merged on current main;
2. witness transition gate is merged on current main;
3. current main CI passes;
4. production deployment is READY and bound to exact current-main SHA;
5. bounded OIDC production acceptance returns `PASS_AND_ROLLED_BACK`;
6. canonical native Scanner exact ID remains OFF;
7. canonical native Verifier exact ID remains OFF;
8. no competing watchdog or replacement native task;
9. runtime ledger project ref is `zehlsagzrpromtfqqflt`;
10. runtime ledger is `ACTIVE_HEALTHY`;
11. OIDC Edge Function is ACTIVE and exact source parity is proven;
12. initial witness ledger is clean at 0/0/0/0;
13. external Scanner execution capability remains false;
14. business write capability remains false.

Any missing/ambiguous evidence => no policy activation.

### CONTROL_PLANE_V420_WITNESS_CONFIG_ONLY

Proposed Rule / Value:

`ALLOW_EXTERNAL_SCANNER_WITNESS_CONFIG_ONLY;MODE=WITNESS;SCANNER_EXECUTION=false;BUSINESS_WRITES=0;NATIVE_SCANNER_OFF;NATIVE_VERIFIER_OFF;HF_PRODUCTION_OFF;NO_OVERLAPPING_AUTHORITATIVE_CLOCKS`

If this draft is later explicitly adopted under the existing maintenance single-writer rules, the permitted transition would be limited to:

- configure the canonical runtime-ledger server binding;
- configure the HMAC witness secret through approved secret surfaces;
- configure the external clock ingress in `witness` mode;
- deploy/enable the external hourly witness clock only after exact configuration readback;
- write only idempotent `WITNESS_ONLY` expectation rows.

It would **not** permit:

- Scanner Candidate/AI/business execution;
- final event truth;
- pricing;
- booking/inventory changes;
- Notification Ledger/provider/customer sends;
- task re-enable;
- new ChatGPT recurring Scanner/Verifier;
- watchdog creation;
- HF production calls;
- Verifier replacement.

### CONTROL_PLANE_V420_WITNESS_ACCEPTANCE

Proposed Rule / Value:

`REQUIRE_6_CONSECUTIVE_EXTERNAL_EXPECTATIONS;EXACT_TOP_HOUR_ASIA_BANGKOK;SOURCE=CLOUDFLARE_CRON;MODE=WITNESS_ONLY;NO_DUPLICATE_SLOT;NO_MISSING_SLOT;PAYLOAD_HASH_VALID;RECEIVE_LAG_VALID;BUSINESS_WRITES=0;NATIVE_SCANNER_REMAINS_OFF`

Acceptance credit:

- starts at 0/6;
- manual/backfilled rows receive zero credit;
- duplicate boundary receives zero credit;
- stale/missing boundary breaks the streak;
- native Scanner becoming ON invalidates transition safety;
- witness 6/6 proves external clock/witness persistence only.

Witness 6/6 does **not** prove Scanner business runtime acceptance.

### CONTROL_PLANE_V420_FAIL_CLOSED

Proposed Rule / Value:

`IF_NATIVE_SCANNER_ON_OR_NATIVE_VERIFIER_ON_OR_LEDGER_BINDING_DRIFT_OR_OIDC_AUTH_DRIFT_OR_EDGE_SOURCE_DRIFT_OR_SCANNER_EXECUTION_CAPABLE_OR_BUSINESS_WRITES_NONZERO_OR_DUPLICATE_CLOCK=>STOP_WITNESS_TRANSITION+PRESERVE_EVIDENCE+ROLLBACK_WITNESS_CONFIG_IF_EXPLICITLY_AUTHORIZED+NO_BUSINESS_EXECUTION`

The exact rollback mechanism must be stated in the final adopted policy before any witness configuration mutation.

## Explicit non-authority

This draft does not authorize:

- Machine-SOT mutation;
- task mutation;
- Vercel environment mutation;
- secret creation/change;
- Cloudflare Cron deployment;
- Supabase mutation;
- external witness enablement;
- Scanner execution;
- HF activation;
- production cutover.

## Promotion sequence

1. #111 exact-head Preview READY → merge.
2. Refresh #114 against new main → exact-head CI + Preview READY → merge.
3. Obtain exact current-main READY production deployment.
4. Run bounded OIDC acceptance and rollback.
5. Build a fresh unified evidence snapshot.
6. Run the transition preflight.
7. Only if all checks pass, review this draft against the then-current Machine SOT.
8. Activate a later explicit policy only under the current maintenance single-writer + post-acquire writer recheck rules.
9. Configure witness mode.
10. Collect 6 consecutive expectations.
11. Re-audit before any external Scanner execution policy is even proposed.

## Root-cause semantics

TASK_OFF actor/mechanism remains `UNKNOWN`.

The external witness path is a reliability/observability alternative. It is not evidence that the native task failure was caused by prompt size, scheduler implementation, chat context, or any specific platform component.
