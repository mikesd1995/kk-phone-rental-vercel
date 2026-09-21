# Owner-Triggered Bounded OIDC Acceptance Workflow — 2026-09-21

Status: **PREPARED / MANUAL DISPATCH ONLY / NO SCHEDULE**

## Purpose

Provide a durable owner-authenticated execution path for the already-merged bounded Vercel Production → Supabase OIDC acceptance without weakening control-plane fail-closed semantics.

Workflow:

`.github/workflows/bounded-oidc-production-acceptance.yml`

The workflow does not create a scheduler and does not authorize Scanner/Verifier/Witness/HF business execution.

## Required owner credential

The workflow requires an existing GitHub Actions secret named:

`VERCEL_TOKEN`

No token is committed, printed, stored in artifacts, or accepted through workflow inputs.

If the secret is missing, the workflow exits before any production mutation with:

`VERCEL_TOKEN_MISSING`

## Manual inputs

- confirmation must exactly equal `RUN_BOUNDED_OIDC_ACCEPTANCE`
- source deployment must be the exact READY production deployment for current main

The expected commit SHA is never typed manually. It is pinned to the workflow dispatch `github.sha`.

## Fail-closed gates

Before mutation the workflow requires:

1. dispatch ref = `refs/heads/main`;
2. authenticated Vercel token exists;
3. remote main head still equals `GITHUB_SHA`;
4. targeted OIDC regression tests pass;
5. `accept-oidc-production.js --dry-run` passes;
6. remote main head is rechecked immediately before live mutation;
7. source deployment is READY and its Git SHA exactly equals `GITHUB_SHA`;
8. production baseline has external Scanner OFF, Scanner execution false, business writes false, OIDC flag false.

## Live sequence

The existing acceptance tool remains authoritative for the bounded live mutation:

1. probe flag true;
2. exact-source production redeploy;
3. one bounded authenticated read-only OIDC probe;
4. probe flag false;
5. exact-source rollback redeploy;
6. final production readiness false.

Required result:

`PASS_AND_ROLLED_BACK`

## Independent rollback recovery

The acceptance step is deliberately `continue-on-error`.

A separate always-run recovery step executes:

`accept-oidc-production.js --rollback-only`

Rollback-only mode:

- requires exact source READY;
- requires source SHA = workflow SHA;
- requires external Scanner OFF;
- requires Scanner execution false;
- requires business writes false;
- if OIDC flag is already false, performs zero mutation and returns `ROLLBACK_ALREADY_SAFE`;
- if OIDC flag is true, sets only that flag false, redeploys the exact source, and requires final production readiness false.

This gives the workflow a second rollback attempt even if the live acceptance process terminates before its internal `finally` completes.

## Concurrency and cancellation safety

Concurrency group:

`kk-bounded-oidc-production-acceptance`

`cancel-in-progress=false`

This prevents a later dispatch from cancelling a live acceptance run and creating overlapping flag/redeploy sequences.

The live command also has a bounded process timeout. If it times out, the separate rollback step still runs.

## Evidence

The workflow uploads only secret-safe reports/logs for 30 days:

- dry-run report;
- acceptance report/log;
- rollback report/log;
- final remote-main SHA.

The acceptance tool redacts token/secret/authorization/key-shaped evidence.

## Main-drift semantics

Remote main is checked:

- before dry-run/live preparation;
- immediately before mutation;
- after rollback.

If main advances during acceptance, the workflow fails terminal eligibility even if the bounded probe itself succeeded. The evidence remains diagnostic only and must not be used to activate v4.9.20.

## Current blocker at preparation

The repository still has no proven `VERCEL_TOKEN` GitHub Actions secret.

Therefore this workflow is prepared but cannot honestly execute live acceptance until the owner configures that secret through GitHub's secret surface.

## Non-authority

Even successful workflow completion does not authorize:

- native Scanner re-enable;
- native Verifier re-enable;
- external witness enablement;
- business writes;
- HF production activation;
- Cloudflare clock activation;
- v4.9.20 Machine-SOT activation.

Those remain gated by the existing transition/preflight policy chain.
