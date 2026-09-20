# Current Control Plane Live Blockers — 2026-09-21

Status: **READ-ONLY CHECKPOINT**

## Fresh Machine-SOT authority

- spreadsheet: KK Phone Rental — Event Tracker 2569
- spreadsheet timezone: Asia/Bangkok
- POLICY_VERSION rows read: 22
- active POLICY_VERSION count: 1
- active version: v4.9.19
- active row: 320
- rule value: v4.9.19 CANONICAL MINIMAL LAUNCHER

## Fresh task registry

Canonical Scanner:
- ID: 6aacec5fa7f48191b439dbe2308b69cf
- title: KK Discovery Scanner — Current Policy
- cadence: hourly :00
- timezone: Asia/Bangkok
- enabled: false

Canonical Verifier:
- ID: 6aacec85e5508191b26894565fbc3787
- title: KK GPT Verifier — Current Policy
- cadence: hourly :30
- timezone: Asia/Bangkok
- enabled: false

Canary remains disabled.

No task state was mutated during this checkpoint.

## Repository state

Current main:

`d1912f9f3fa9602fc793976cd530eec479788cd2`

PR #111:
- not merged;
- exact-head Admin Regression 330/330 PASS;
- Vercel Preview blocked by build-rate-limit.

PR #114:
- not merged;
- exact-head Admin Regression 331/331 PASS;
- Vercel Preview blocked by build-rate-limit.

PR #115:
- readiness pack;
- independent from #111/#114.

## Current-main CI evidence

The repository workflow is configured for both:

- pull_request → main
- push → main

At this checkpoint, direct commit-workflow lookup for current main `d1912f9...` returned no exact workflow run.

Therefore the OIDC execution package must currently treat:

`CURRENT_MAIN_CI_NOT_PASS`

as unresolved rather than infer PASS from an older PR run.

## Production deployment

Latest READY production deployment:

- deployment ID: `dpl_5unNJqJLXzSAqRTUq6tvpTPEqg4W`
- branch: main
- deployed SHA: `f88f8c0bf641b7ab0a37891f87a515477edaaa24`

There is no exact-current-main deployment for:

`d1912f9f3fa9602fc793976cd530eec479788cd2`

Therefore:

`SOURCE_DEPLOYMENT_SHA_MISMATCH`

is an active blocker for bounded production OIDC acceptance.

## Production fail-closed readiness

Fresh production `/api/kk-scanner-dispatch` readback:

- external_scanner_enabled=false
- mode=unset
- hmac_secret_configured=false
- runtime_ledger_oidc_probe_enabled=false
- runtime_ledger_enabled=false
- runtime_ledger_configured=false
- ready_for_witness=false
- scanner_execution_capable=false
- business_writes_capable=false

These values are correct for the current pre-acceptance state.

## Expected OIDC package blockers now

The readiness package must remain BLOCKED with at least:

1. `PERSISTENCE_AUDITOR_NOT_MERGED`
2. `TRANSITION_GATE_NOT_MERGED`
3. `CURRENT_MAIN_CI_NOT_PASS`
4. `SOURCE_DEPLOYMENT_SHA_MISMATCH`

No attempt should be made to bypass these blockers by:

- using the old production SHA;
- using a Preview deployment as the source artifact;
- skipping main CI evidence;
- enabling witness mode first;
- changing native task state.

## Mutation accounting

This checkpoint performed:

- task mutations: 0
- Machine-SOT writes: 0
- Vercel env changes: 0
- deployments: 0
- Supabase mutations: 0
- business writes: 0
- HF activation: 0
