# KK Production Baseline Acceptance Runbook — 2026-09-27

## Purpose

Create one repeatable acceptance baseline after exact-current-main reaches Production.

This runbook is read-only by default and must not repair business state just to make the baseline green.

## Source identity

Require:
- GitHub main SHA recorded.
- Vercel Production deployment ID recorded.
- Production source/runtime identity matches the approved current main.
- No incomplete Preview promotion substituted for exact main.

## Storefront

Verify:
- homepage HTTP success;
- event search basic behavior;
- event cards render without known layout regressions;
- owner-hidden events remain hidden;
- no obvious runtime console/server error attributable to the deployment.

## Admin

Verify:
- authentication boundary;
- snapshot endpoint/health;
- event sorting/date behavior;
- booking entry/read path;
- no unauthorized write performed during acceptance.

## Apps Script / Google upstream

Use the existing secret-safe diagnostics only.

Verify:
- upstream reachable or exact blocker classified;
- timing/timezone diagnostics;
- no trigger/timezone mutation.

## Scanner / Verifier

Use Machine SOT durable evidence, not timers alone.

Verify:
- canonical task IDs;
- retired task stays disabled;
- latest natural run terminality;
- no unresolved PREPARED/COMMITTING transactions;
- locks safely released;
- no false FULL claim where coverage debt exists.

## Supabase / Ledgers

Verify:
- runtime ledger connectivity;
- Agent Invocation Ledger configuration;
- Decision Ledger configuration;
- RLS/least privilege unchanged;
- no UPDATE/DELETE authority introduced for append-only ledgers.

## Agent platform

Verify:
- Agent Registry version expected by current main;
- Agent Gateway health;
- Content route safety;
- Operating Partner callable advisory route;
- production_writes=0 / publishes=0 for advisory acceptance.

## Operating Partner

Use safe synthetic/advisory input only.

Verify:
- opportunity scoring route callable;
- insufficient evidence remains fail-closed;
- Decision Ledger health visible;
- no price/booking/inventory/customer-send/publish side effect.

## Runtime health

Inspect recent:
- Vercel runtime errors;
- warnings;
- deployment failures;
- upstream failures.

Classify each subsystem:

- PASS
- PARTIAL
- BLOCKED
- NOT_WIRED

## Completion rule

The baseline is complete only when every listed subsystem has a classification and every BLOCKED item has a concrete external/internal blocker.

Do not convert NOT_WIRED into PASS based on the existence of code or tests.
