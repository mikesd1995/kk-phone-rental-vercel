# Current Control Plane Live Blockers — 2026-09-21

Status: **READ-ONLY CHECKPOINT / POST-#116**

## Fresh Machine-SOT authority

- spreadsheet: KK Phone Rental — Event Tracker 2569
- spreadsheet timezone: Asia/Bangkok
- POLICY_VERSION rows inspected: 22
- active POLICY_VERSION count: 1
- active version: v4.9.19
- active row: 320
- rule value: v4.9.19 CANONICAL MINIMAL LAUNCHER

## Fresh task registry

Canonical Scanner:
- ID: 6aacec5fa7f48191b439dbe2308b69cf
- cadence: hourly :00
- timezone: Asia/Bangkok
- enabled: false

Canonical Verifier:
- ID: 6aacec85e5508191b26894565fbc3787
- cadence: hourly :30
- timezone: Asia/Bangkok
- enabled: false

Canary remains disabled.

No task state was mutated by this readiness refresh.

## Repository state

Current main at preparation:

`b6bf71db86cc5d5308103f5f70dc2672aff4211f`

Merged:
- #111 persistence auditor
- #116 current-main witness transition gate

Exact-main Admin Regression push run #397:
- **341/341 PASS**
- syntax PASS
- conclusion success

The previous #114 was superseded and closed without merge.

## Production deployment

Exact-current-main production at preparation:

- deployment ID: `dpl_H1d6LLMfuoBbH41TMkWzuk22JTcF`
- target: production
- state: READY
- branch: main
- deployed SHA: `b6bf71db86cc5d5308103f5f70dc2672aff4211f`

This exact deployment is valid evidence only for this exact main. Once the readiness pack merges and main advances, a new exact-current-main production deployment must be proven. Do not reuse this deployment against the later main SHA.

## Production fail-closed readiness

Fresh production `/api/kk-scanner-dispatch` readback after #116:

- external_scanner_enabled=false
- mode=unset
- hmac_secret_configured=false
- runtime_ledger_oidc_probe_enabled=false
- runtime_ledger_enabled=false
- runtime_ledger_configured=false
- ready_for_witness=false
- scanner_execution_capable=false
- business_writes_capable=false

These values are the correct pre-OIDC fail-closed baseline.

## Current OIDC blocker

The readiness/evidence package is not yet merged on current main.

Therefore:

`READINESS_PACK_NOT_MERGED`

is an explicit blocker.

After this pack merges, main changes. Before OIDC acceptance, fresh evidence must again prove:

1. readiness pack merged on exact current main;
2. exact-current-main push CI PASS;
3. exact-current-main production deployment READY;
4. production Scanner baseline still fail closed;
5. no task/Machine-SOT/HF/business authority drift.

## Mutation accounting

This refresh performs:

- task mutations: 0
- Machine-SOT writes: 0
- Vercel environment changes: 0
- Supabase mutations: 0
- business writes: 0
- HF activation: 0
