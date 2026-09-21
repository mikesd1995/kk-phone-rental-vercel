# Control Plane Readiness Pack — 2026-09-21

Status: **REPOSITORY-ONLY / ZERO CONTROL-PLANE AUTHORITY EXPANSION**

## Objective

Provide deterministic evidence packaging and a fail-closed execution gate for the bounded production OIDC acceptance that follows the merged persistence auditor and merged witness-transition gate.

The pack contains:

1. draft v4.9.20 witness-only policy proposal;
2. unified evidence snapshot builder;
3. fail-closed OIDC execution package.

## Repository prerequisites now proven

At preparation time:

- #111 persistence auditor is merged;
- #116 witness transition gate is merged;
- current main = `be51313bb640bebb9ef5b482e83bdd688c1a7df3`;
- current-main push Admin Regression #400 = **342/342 PASS**;
- exact-current-main production deployment `dpl_9k4GhSGfqtJx5Zh2yHwNioWreYqn` = READY;
- unrelated #117 has been incorporated and does not overlap this pack.

This pack itself is not yet merged at preparation time, so it must not authorize execution from a feature branch or Preview deployment.

## Unified evidence snapshot

Files:

- `server/control-plane-evidence-snapshot.js`
- `scripts/build-control-plane-evidence-snapshot.js`

The builder accepts already-read evidence from Machine SOT, live task registry, production readiness, OIDC acceptance, runtime ledger, mutation accounting, and optional persistence occurrences.

It emits exact active-policy evidence, canonical Scanner/Verifier identities, SHA-256 prompt fingerprints instead of raw prompts, production readiness, OIDC acceptance evidence, runtime-ledger identity/health/counts, mutation accounting, persistence snapshot, witness-transition snapshot, and deterministic evidence digest.

It fails closed on policy ambiguity, wrong baseline policy, canonical task ambiguity, or timezone drift.

## OIDC acceptance execution package

File:

`server/oidc-acceptance-package.js`

The package requires:

- exact Vercel project/team/name;
- persistence auditor merged;
- witness transition gate merged;
- readiness pack merged;
- exact current-main CI PASS;
- source deployment READY;
- source deployment target = production;
- source deployment branch = main;
- source deployment SHA = exact current-main SHA;
- external Scanner OFF;
- OIDC probe flag OFF before acceptance;
- Scanner execution capability false;
- business writes capability false.

Only then can it emit the bounded command for:

`scripts/accept-oidc-production.js`

### Required terminal result

`PASS_AND_ROLLED_BACK`

with authenticated=true, read_only=true, bounded_limit=1, business_writes=0, rollback ok, external Scanner OFF, OIDC probe flag OFF, Scanner execution false, and business writes false.

It never authorizes production cutover, witness enablement, Scanner execution, or business writes.

## Important source-artifact rule

The exact-current-main production deployment proven before this pack merges cannot be reused after this pack advances main.

After merge, obtain fresh exact-current-main production deployment and fresh main-CI evidence before OIDC execution.

## Safety accounting

This readiness pack performs:

- task mutations: 0
- task/schedule creation: 0
- Machine-SOT writes: 0
- production environment writes: 0
- Supabase mutations: 0
- Apps Script deploys: 0
- business writes: 0
- HF activation: 0
- provider/customer sends: 0
