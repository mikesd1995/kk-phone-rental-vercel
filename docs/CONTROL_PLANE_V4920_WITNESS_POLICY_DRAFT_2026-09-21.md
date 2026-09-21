# Draft v4.9.20 — External Scanner Witness Configuration Only

Date: 2026-09-21  
Status: **PROPOSAL ONLY / NOT ACTIVE / NOT WRITTEN TO MACHINE SOT**

## Fresh authority baseline

Fresh readback proves:

- Machine SOT timezone: `Asia/Bangkok`;
- 22 POLICY_VERSION rows inspected;
- exactly one POLICY_VERSION has Active=TRUE;
- active policy: `v4.9.19 CANONICAL MINIMAL LAUNCHER`;
- active policy row: 320;
- canonical Scanner ID: `6aacec5fa7f48191b439dbe2308b69cf`;
- canonical Verifier ID: `6aacec85e5508191b26894565fbc3787`;
- canonical Scanner OFF;
- canonical Verifier OFF;
- v4.9.19 one-time same-ID remediation already consumed;
- automatic repeat re-enable/new identity prohibited without a later explicit policy.

Repository prerequisites already merged:
- #111 persistence auditor;
- #116 witness-transition gate.

Current repository main at this draft refresh is `be51313bb640bebb9ef5b482e83bdd688c1a7df3`. Unrelated #117 is already included and does not change the policy semantics.

This document does not supersede v4.9.19.

## Proposed policy name

`v4.9.20 EXTERNAL SCANNER WITNESS CONFIGURATION ONLY`

## Proposed Machine-SOT rows

These are draft row specifications only.

### POLICY_VERSION

`v4.9.20 EXTERNAL SCANNER WITNESS CONFIGURATION ONLY`

Purpose:

- inherit all non-superseded safety/governance from v4.9.19 and earlier;
- authorize only bounded witness-clock configuration after exact preflight;
- preserve native Scanner/Verifier OFF;
- preserve Verifier final authority;
- keep Scanner business execution disabled;
- keep HF production disabled;
- keep business writes at zero.

### CONTROL_PLANE_V420_ENTRY_GATE

`REQUIRE_PERSISTENCE_AUDITOR_MERGED+TRANSITION_GATE_MERGED+READINESS_PACK_MERGED+CURRENT_MAIN_CI_PASS+EXACT_CURRENT_MAIN_PRODUCTION_DEPLOYMENT_READY+OIDC_PASS_AND_ROLLED_BACK+NATIVE_SCANNER_OFF+NATIVE_VERIFIER_OFF+NO_WATCHDOG+NO_REPLACEMENT_TASK+CANONICAL_LEDGER_HEALTHY+EDGE_SOURCE_PARITY+CLEAN_INITIAL_LEDGER`

Required evidence:

1. persistence auditor merged on exact current main;
2. witness-transition gate merged on exact current main;
3. readiness/evidence pack merged on exact current main;
4. exact-current-main CI PASS;
5. exact-current-main production deployment READY;
6. bounded OIDC production acceptance = `PASS_AND_ROLLED_BACK`;
7. canonical Scanner exact ID OFF;
8. canonical Verifier exact ID OFF;
9. no watchdog or replacement native task;
10. runtime ledger project = `zehlsagzrpromtfqqflt`;
11. runtime ledger = `ACTIVE_HEALTHY`;
12. OIDC Edge Function ACTIVE with exact source parity;
13. initial witness ledger clean 0/0/0/0;
14. Scanner execution capability false;
15. business write capability false.

Any missing or ambiguous evidence means no policy activation.

### CONTROL_PLANE_V420_WITNESS_CONFIG_ONLY

`ALLOW_EXTERNAL_SCANNER_WITNESS_CONFIG_ONLY;MODE=WITNESS;SCANNER_EXECUTION=false;BUSINESS_WRITES=0;NATIVE_SCANNER_OFF;NATIVE_VERIFIER_OFF;HF_PRODUCTION_OFF;NO_OVERLAPPING_AUTHORITATIVE_CLOCKS`

If later explicitly adopted, the permitted transition is limited to witness configuration and idempotent WITNESS_ONLY expectation rows.

It does not permit Candidate/AI business execution, final event truth, pricing, booking/inventory, notifications, provider/customer sends, task re-enable, replacement runners, watchdogs, HF production, or Verifier replacement.

### CONTROL_PLANE_V420_WITNESS_ACCEPTANCE

`REQUIRE_6_CONSECUTIVE_EXTERNAL_EXPECTATIONS;EXACT_TOP_HOUR_ASIA_BANGKOK;SOURCE=CLOUDFLARE_CRON;MODE=WITNESS_ONLY;NO_DUPLICATE_SLOT;NO_MISSING_SLOT;PAYLOAD_HASH_VALID;RECEIVE_LAG_VALID;BUSINESS_WRITES=0;NATIVE_SCANNER_REMAINS_OFF`

Acceptance:
- starts 0/6;
- manual/backfilled evidence = zero credit;
- duplicate slot = zero credit;
- missing/stale slot breaks streak;
- native Scanner becoming ON invalidates transition safety;
- witness 6/6 proves only external clock/witness persistence.

### CONTROL_PLANE_V420_FAIL_CLOSED

`IF_NATIVE_SCANNER_ON_OR_NATIVE_VERIFIER_ON_OR_LEDGER_BINDING_DRIFT_OR_OIDC_AUTH_DRIFT_OR_EDGE_SOURCE_DRIFT_OR_SCANNER_EXECUTION_CAPABLE_OR_BUSINESS_WRITES_NONZERO_OR_DUPLICATE_CLOCK=>STOP_WITNESS_TRANSITION+PRESERVE_EVIDENCE+ROLLBACK_WITNESS_CONFIG_IF_EXPLICITLY_AUTHORIZED+NO_BUSINESS_EXECUTION`

The final adopted policy must specify the exact rollback mechanism before any witness configuration mutation.

## Explicit non-authority

This draft does not authorize Machine-SOT mutation, task mutation, Vercel environment mutation, secret changes, Cloudflare Cron deployment, Supabase mutation, witness enablement, Scanner execution, HF activation, or production cutover.

## Promotion sequence

1. Persistence auditor merged — proven.
2. Witness-transition gate merged — proven.
3. Merge the readiness/evidence pack onto the then-current main.
4. Prove fresh exact-current-main CI and production deployment.
5. Run bounded OIDC acceptance and rollback.
6. Build a fresh unified evidence snapshot.
7. Run witness transition preflight.
8. Only if all checks pass, review this draft against the then-current Machine SOT.
9. Activate a later explicit policy under current single-writer governance.
10. Configure witness-only mode.
11. Collect six consecutive expectations.
12. Re-audit before any external Scanner execution policy is proposed.

## Root-cause semantics

TASK_OFF actor/mechanism remains `UNKNOWN`.

The external witness path is a reliability/observability alternative, not proof of any specific native scheduler root cause.
