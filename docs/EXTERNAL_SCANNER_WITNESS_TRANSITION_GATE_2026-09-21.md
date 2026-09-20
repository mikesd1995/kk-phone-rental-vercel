# External Scanner Witness Transition Gate — 2026-09-21

## Status

**REPOSITORY-ONLY / FAIL-CLOSED / ZERO PRODUCTION MUTATION**

This gate prepares the next control-plane policy transition after v4.9.19 without enabling the external Scanner, changing the Machine SOT, or authorizing Scanner business execution.

It exists because the repository already had:

- external Scanner trigger/ingress staging;
- a dedicated Supabase runtime ledger;
- witness streak acceptance;
- Vercel OIDC → Supabase read-only probe tooling;

but did not yet have one deterministic preflight that combines the control-plane safety requirements before a later explicit Machine-SOT policy may authorize **witness configuration only**.

## Baseline authority

Current baseline expected by this V1 transition gate:

- active policy exact1: `v4.9.19`;
- canonical native Scanner ID: `6aacec5fa7f48191b439dbe2308b69cf`;
- native Scanner cadence: hourly `:00`;
- timezone: `Asia/Bangkok`;
- native Scanner explicitly OFF;
- no replacement native Scanner task;
- no watchdog;
- HF production OFF;
- zero business writes;
- zero Machine-SOT mutation during evidence collection.

This gate intentionally does **not** activate a future policy. A different policy version is not silently accepted as v4.9.19 evidence.

## Required evidence before a next-policy candidate can be called ready

### 1. Native control-plane baseline

The native canonical Scanner must remain exactly identified and OFF.

This prevents overlapping authoritative Scanner clocks during witness staging.

### 2. Production dispatcher fail-closed baseline

Before transition:

- `external_scanner_enabled=false`;
- `runtime_ledger_oidc_probe_enabled=false` after rollback;
- `scanner_execution_capable=false`;
- `business_writes_capable=false`.

### 3. Bounded OIDC production acceptance

The existing production acceptance tooling must have returned:

`PASS_AND_ROLLED_BACK`

with:

- authenticated OIDC probe;
- read-only=true;
- bounded_limit=1;
- business_writes=0;
- rollback confirmed;
- external Scanner still OFF after rollback;
- OIDC probe flag restored false;
- Scanner execution capability false;
- business write capability false.

A repository test, preview, or an undeployed OIDC function is not a substitute for this production proof.

### 4. Canonical runtime ledger

Require:

- project ref `zehlsagzrpromtfqqflt`;
- project status `ACTIVE_HEALTHY`;
- OIDC Edge Function ACTIVE;
- deployed Edge Function source exact-matches repository source;
- initial pre-witness ledger rows all zero:
  - expectations;
  - observations;
  - task state events;
  - incidents.

The clean-ledger requirement applies to the **initial v4.9.19 → witness transition baseline**. It prevents old diagnostic/test rows from being silently interpreted as the new witness streak.

### 5. No authority expansion

The gate fails if evidence shows:

- a new native Scanner task;
- watchdog presence;
- HF production enabled;
- Machine-SOT mutation during collection;
- business writes during collection.

## Output semantics

A passing result is only:

`WITNESS_TRANSITION_POLICY_CANDIDATE_READY`

It means the evidence package is clean enough to draft/review the next explicit Machine-SOT policy.

It does **not** authorize:

- changing the Machine SOT;
- setting Vercel witness environment flags;
- setting production secrets;
- deploying Cloudflare Cron;
- starting external Scanner business execution;
- enabling HF;
- production cutover.

The evaluator always keeps:

- `explicit_machine_sot_policy_change_required=true`
- `witness_configuration_transition_authorized=false`
- `scanner_runtime_execution_authorized=false`
- `business_writes_authorized=false`
- `hf_production_activation_authorized=false`
- `production_cutover_authorized=false`

## Current live classification — 2026-09-21

Fresh evidence already proven outside this branch:

- v4.9.19 exact active policy: PASS;
- native canonical Scanner OFF: PASS;
- dedicated runtime-ledger project ACTIVE_HEALTHY: PASS;
- OIDC Edge Function ACTIVE: PASS;
- deployed Edge Function exact-matches repo: PASS;
- ledger row counts 0/0/0/0: PASS;
- production external Scanner disabled: PASS;
- Scanner execution capable=false: PASS;
- business writes capable=false: PASS.

The remaining required evidence is the bounded **production OIDC acceptance with rollback**.

That acceptance is currently blocked operationally because Vercel exact-head Preview/deployment capacity is returning a build-rate-limit status. The block must not be bypassed by enabling witness mode directly.

## Intended next sequence

1. Merge the Control Plane persistence auditor only after its own CI + Preview gate passes.
2. Complete bounded production OIDC acceptance and rollback.
3. Re-run this transition gate with exact fresh evidence.
4. If candidate ready, draft an explicit next Machine-SOT policy for **witness configuration only**.
5. Under that later policy, enable witness configuration without Scanner execution/business writes.
6. Collect at least six consecutive external witness expectations.
7. Audit witness streak.
8. Only under a later explicit policy consider actual external Scanner runtime/business staging.
9. Never overlap native and external authoritative Scanner clocks.

## Safety accounting

This repository change itself performs:

- recurring task mutations: 0
- schedule changes: 0
- Machine SOT writes: 0
- production environment changes: 0
- production deployments: 0
- Supabase mutations: 0
- Scanner execution: 0
- business writes: 0
- HF activation: 0
- provider/customer sends: 0
