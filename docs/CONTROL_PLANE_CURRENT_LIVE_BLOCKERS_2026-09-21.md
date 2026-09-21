# Current Control Plane Live Blockers — 2026-09-21

Status: **READ-ONLY CHECKPOINT / POST-#117**

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

`be51313bb640bebb9ef5b482e83bdd688c1a7df3`

Merged control-plane prerequisites:
- #111 persistence auditor
- #116 current-main witness transition gate

Unrelated #117 also merged after #116 and changed only Admin/TBD pickup-time surfaces plus its documentation/tests. It does not overlap the readiness-pack files.

Exact-main Admin Regression push run #400:
- **342/342 PASS**
- syntax PASS
- conclusion success

## Production deployment

Exact-current-main production at preparation:

- deployment ID: `dpl_9k4GhSGfqtJx5Zh2yHwNioWreYqn`
- target: production
- state: READY
- branch: main
- deployed SHA: `be51313bb640bebb9ef5b482e83bdd688c1a7df3`

This exact deployment is evidence only for this exact main. Once the readiness pack merges and main advances, a new exact-current-main production deployment must be proven.

## Production fail-closed readiness

The most recent production readiness readback remains fail closed:

- external_scanner_enabled=false
- mode=unset
- hmac_secret_configured=false
- runtime_ledger_oidc_probe_enabled=false
- runtime_ledger_enabled=false
- runtime_ledger_configured=false
- ready_for_witness=false
- scanner_execution_capable=false
- business_writes_capable=false

A fresh readiness read is still required again after the readiness pack merges and before OIDC acceptance.

## Current OIDC blocker

The readiness/evidence package is not yet merged on current main.

Therefore:

`READINESS_PACK_NOT_MERGED`

is an explicit blocker.

After this pack merges, fresh evidence must prove:

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


## Exact-current-main Production retry checkpoint — 2026-09-21 09:58 ICT

Current main `4da5acbb9fa54dee3ed8baec55812d25e35c43e4` has Admin Regression #412 PASS (417/417) but no exact-main Vercel deployment because the Git integration returned `build-rate-limit` after PR #123 merged.

This documentation-only checkpoint intentionally creates a fresh exact branch head so Vercel can re-evaluate deployment capacity without changing runtime code, Scanner/Verifier authority, Machine SOT, HF production state, business writes, Supabase state, or Vercel environment variables.

Merge remains fail-closed and requires the new exact head to independently prove:
- Admin Regression PASS;
- Vercel Preview READY;
- behind current main = 0;
- exact documentation-only scope;
- secret scan clean.

If merged, the resulting new main must independently receive a READY production deployment before it may be used as source authority for bounded OIDC acceptance. Older production artifacts remain invalid for that acceptance.


## Post-#134 exact-main Production retry checkpoint — 2026-09-21 19:17 ICT

Current main `1eaf85c9decc1657228f8cb8f9321f30f54037b2` includes the zero-cost owner-comment OIDC dispatcher and its documented Vercel deployment-list endpoint fix. Main Admin Regression #433 is PASS, but the Git integration currently reports `build-rate-limit` and no exact-current-main Production deployment exists.

This documentation-only checkpoint performs one bounded capacity retry. It changes no runtime logic, Machine SOT, Scanner/Verifier/Canary task state, Supabase data, Vercel environment variables, Cloudflare state, witness runtime, HF Production, or business data.

Merge requires exact-head CI PASS, exact-head Vercel Preview READY, zero commits behind current main, exact one-file documentation scope, and a clean secret scan. If merged, the resulting new main must independently receive a READY Production deployment before Witness configuration or OIDC evidence can be treated as exact-current-main authority.
