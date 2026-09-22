# GitHub OIDC Witness Scheduler Reliability Hardening — 2026-09-22

Status: **STAGED / NOT ACTIVE UNTIL MERGED TO DEFAULT BRANCH**

## Problem

The default-branch witness workflow is functional end-to-end, but GitHub scheduled dispatch is intermittent.

Fresh natural evidence on current main `c499427d0d8b18e4bbf9dc963a82c869a372774c`:

- run `35647974704`: natural `schedule`, reached the Edge boundary, rejected as `TRIGGER_SCHEDULE_STALE`;
- run `35666472962`: natural `schedule`, SUCCESS, `GITHUB_OIDC_WITNESS_ACCEPTED`, `ledger_inserted=true`, `business_writes=0`;
- canonical Supabase ledger: expectations=1, observations=0, task_state_events=0, incidents=0;
- no later hourly natural runs are present at this checkpoint.

GitHub documents that scheduled workflow events can be delayed under high Actions load, especially around the start of an hour, and sufficiently loaded queued jobs can be dropped. GitHub recommends using a different minute of the hour to reduce delay risk.

## Narrow change

Keep the same single workflow and same trust path:

`GitHub schedule -> GitHub OIDC -> Supabase Edge -> kk_runtime_expectations`

Change only the natural cron minute:

- before: `7 * * * *`
- candidate: `13 * * * *`

Why minute 13:

- farther from the documented top-of-hour congestion window than minute 7;
- still inside the existing 25-minute Edge receive-lag acceptance window;
- preserves 12 minutes of dispatch-delay headroom before the Edge boundary rejects the occurrence;
- remains one schedule definition in one workflow;
- does not add a second scheduler, provider, watchdog, retry worker, manual dispatch, or backfill path.

The represented witness slot remains the exact Bangkok top-of-hour because the workflow still computes:

`scheduled = floor(now / 1 hour) * 1 hour`

## Observability

The workflow now logs:

`dispatch_offset_minutes=<integer>`

This is diagnostic-only. It does not enter the signed/persisted witness payload and does not change acceptance authority.

## Unchanged safety boundaries

- GitHub OIDC issuer/audience/repository/ref/workflow/event claims remain unchanged.
- Edge Function source and code remain unchanged.
- Edge `MAX_RECEIVE_LAG_MS = 25 minutes` remains unchanged.
- Acceptance `DEFAULT_RECEIVE_LAG_MS = 25 minutes` remains unchanged.
- Six consecutive exact hourly expectations are still required.
- No duplicate/missing/invalid slot is tolerated.
- No manual witness or synthetic expectation is authorized.
- No historical slot may be backfilled.
- `business_writes=0`.
- `scanner_execution_started=false`.
- Scanner / Verifier / Canary / HF Production remain OFF.
- No Machine-SOT business/Candidate/AI write is authorized.

## Acceptance before merge

1. exact branch must be based on current main;
2. only workflow/test/documentation changes are expected;
3. witness contract regression must pass;
4. full repository regression must pass;
5. no Production or Supabase mutation is performed by branch validation;
6. Vercel Preview failure caused solely by existing Hobby build quota is not interpreted as a code failure;
7. merge must not occur while a newer main would make the branch stale without a fresh compare/review.

## Post-merge evidence required

The cron change becomes meaningful only after it exists on the default branch.

After activation:

- do not backfill existing gaps;
- start a fresh natural certification window;
- require six consecutive valid hourly ledger expectations;
- inspect `dispatch_offset_minutes` for each natural run;
- any missing slot, >25-minute receive lag, duplicate, invalid claim, or unexpected business write fails the window.

A six-hour witness streak proves external clock persistence only. It does not authorize Scanner execution or Production cutover by itself.
