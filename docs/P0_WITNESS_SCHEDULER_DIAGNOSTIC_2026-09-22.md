# P0 Witness Scheduler Diagnostic — 2026-09-22

## Purpose

This change adds a read-only diagnostic surface for the current Control Plane P0: the default-branch witness workflow exists, Supabase witness control is enabled, but GitHub reports zero natural `schedule` workflow runs and the runtime expectation ledger remains empty.

The diagnostic is intentionally separate from the witness runtime. It can never create witness credit.

## Fresh evidence before this branch

Repository:
- current main: `fc4f2f3a482ebadbdc6ad050784bb96873b30d0c`;
- Production deployment: `dpl_4pviAD7XyrBmVs1kKVpGn3XkVvPT`;
- Production SHA exactly matches current main;
- witness workflow exists at `.github/workflows/kk-external-witness-clock.yml`;
- natural schedule: `7 * * * *`;
- GitHub Actions repository-wide activity is proven because issue-comment workflows continue to create runs;
- GitHub REST `actions/runs?event=schedule` currently returns `total_count=0`.

Machine SOT:
- active policy exact1: `v4.9.23 GITHUB OIDC WITNESS TIMESTAMP PRECISION REPAIR`;
- native Scanner OFF;
- native Verifier OFF;
- Canary OFF;
- HF Production OFF;
- business authority remains zero;
- acceptance remains `0/6`.

Supabase:
- canonical project `zehlsagzrpromtfqqflt` is healthy;
- `github_oidc_witness_v1=true`;
- `kk-runtime-ledger-github-witness` is ACTIVE;
- runtime ledger counts remain `0/0/0/0`.

## Diagnostic added

### Script

`scripts/audit-github-witness-scheduler.js`

Uses only GitHub REST GET requests to:
1. read repository default branch;
2. read metadata/state for `kk-external-witness-clock.yml`;
3. read schedule-triggered workflow-run inventory.

Output is secret-safe and contains only:
- default branch;
- workflow id/name/path/state/timestamps;
- total natural schedule run count;
- at most five sanitized schedule-run summaries;
- diagnostic classification.

Classifications:
- `WORKFLOW_NOT_ACTIVE`;
- `WORKFLOW_ACTIVE_BUT_NO_SCHEDULE_RUNS`;
- `SCHEDULE_RUNS_PRESENT`.

The script cannot:
- enable/disable workflows;
- dispatch the witness;
- write Supabase;
- mutate Production;
- grant witness credit.

### Owner-only diagnostic workflow

`.github/workflows/audit-witness-scheduler.yml`

Trigger:
- `issue_comment` only;
- Issue #47 only;
- repository owner only;
- `author_association=OWNER`;
- exact command: `/audit-witness-scheduler`.

Permissions:
- `contents: read`;
- `actions: read`.

Explicitly absent:
- `id-token: write`;
- `schedule`;
- `workflow_dispatch`;
- Supabase credentials;
- Vercel token;
- Scanner/HF enablement.

The diagnostic therefore cannot be counted as a natural witness occurrence.

## Decision after diagnostic

### If WORKFLOW_NOT_ACTIVE

Do not edit Supabase or timestamps. Preserve evidence. The next bounded remediation is an explicit GitHub workflow enable action, followed by observation of the next natural `:07` slot. No manual witness dispatch and no backfill.

### If WORKFLOW_ACTIVE_BUT_NO_SCHEDULE_RUNS

Do not create a second clock. Investigate GitHub default-branch scheduler registration/repository Actions scheduling conditions while preserving the existing cron and authority boundary.

### If SCHEDULE_RUNS_PRESENT

Inspect run conclusion/logs and compare to the Supabase ledger. Only a valid natural run accepted by the canonical Edge can earn witness credit.

## Safety accounting for this branch

- Machine SOT writes: 0
- Scanner task mutations: 0
- Verifier task mutations: 0
- Canary mutations: 0
- witness manual dispatches: 0
- witness expectation writes: 0
- Supabase mutations: 0
- Vercel Production mutations: 0
- business writes: 0
- HF Production activation: 0

This branch is diagnostic-only and must remain unmerged until exact-head CI/review is complete.
