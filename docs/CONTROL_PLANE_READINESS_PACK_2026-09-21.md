# Control Plane Readiness Pack — 2026-09-21

Status: **REPOSITORY-ONLY / ZERO PRODUCTION MUTATION**

## Objective

Prepare all deterministic inputs that can be completed while Vercel build-rate-limit blocks exact-head Preview/deployment work.

The pack contains:

1. draft v4.9.20 witness-only policy proposal;
2. unified evidence snapshot builder;
3. fail-closed OIDC execution package.

## Unified evidence snapshot

File:

`server/control-plane-evidence-snapshot.js`

CLI:

`scripts/build-control-plane-evidence-snapshot.js <input.json>`

### Inputs

The builder accepts already-read evidence from:

- Machine-SOT policy rows;
- live task registry;
- production scanner-dispatch readiness;
- OIDC acceptance evidence;
- runtime-ledger health/counts;
- bounded control-plane mutation summary;
- optional natural persistence occurrences.

### Output

One deterministic object contains:

- exact active-policy evidence;
- exact canonical Scanner/Verifier task identities;
- SHA-256 prompt fingerprints;
- production readiness;
- OIDC acceptance result;
- runtime-ledger identity/health/counts;
- control mutation accounting;
- `persistence_snapshot` shape for the persistence auditor;
- `witness_transition_snapshot` shape for the transition gate;
- deterministic `evidence_digest_sha256`.

Raw task prompts are not emitted.

### Fail-closed behavior

The snapshot is not usable if:

- active policy is not exact1;
- active baseline is not v4.9.19;
- canonical Scanner is not exact1;
- canonical Verifier is not exact1;
- either canonical timezone drifts from Asia/Bangkok.

The builder does not mutate tasks, Sheet data, Vercel, Supabase, or provider state.

## OIDC acceptance execution package

File:

`server/oidc-acceptance-package.js`

Purpose:

Prevent the bounded production OIDC acceptance from being run against a stale or wrong production artifact.

The package requires:

- exact project/team/project-name identity;
- persistence auditor merged;
- transition gate merged;
- current-main CI PASS;
- source deployment READY;
- source deployment target = production;
- source deployment branch = main;
- source deployment SHA = exact current-main SHA;
- production external Scanner OFF;
- OIDC probe flag OFF before acceptance;
- Scanner execution capability false;
- business write capability false.

Only then does it emit the exact command template for:

`scripts/accept-oidc-production.js`

### Required terminal result

`PASS_AND_ROLLED_BACK`

with:

- authenticated=true;
- read_only=true;
- bounded_limit=1;
- business_writes=0;
- rollback ok;
- external Scanner OFF;
- OIDC probe flag OFF;
- Scanner execution false;
- business writes false.

The package always keeps:

- production_cutover_authorized=false;
- witness_enable_authorized=false;
- scanner_execution_authorized=false;
- business_writes_authorized=false.

## Current live classification

At preparation time:

- current main = `d1912f9f3fa9602fc793976cd530eec479788cd2`;
- #111 is not merged;
- #114 is not merged;
- latest READY production deployment is still bound to `f88f8c0bf641b7ab0a37891f87a515477edaaa24`;
- current-main exact production artifact is absent;
- Vercel exact-head Preview creation is blocked by build-rate-limit.

Therefore the OIDC package is expected to return BLOCKED now.

That is correct fail-closed behavior, not a defect.

## Safety accounting

This readiness pack performs:

- task mutations: 0
- task/schedule creation: 0
- Machine-SOT writes: 0
- production environment writes: 0
- production deploys: 0
- Supabase mutations: 0
- Apps Script deploys: 0
- business writes: 0
- HF activation: 0
- provider/customer sends: 0
