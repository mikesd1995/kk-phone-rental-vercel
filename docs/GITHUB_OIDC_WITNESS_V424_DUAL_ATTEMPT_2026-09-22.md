# GitHub OIDC Witness v4.9.24 — Single-Workflow Dual Natural Attempt

Date: 2026-09-22  
Status: **POLICY-AUTHORIZED STAGING / KILL SWITCH FALSE UNTIL ACCEPTANCE**

## Purpose

Improve natural GitHub schedule persistence without introducing a second clock, provider, manual dispatch path, synthetic expectation, or historical backfill.

The control path remains:

`GitHub Actions schedule -> GitHub OIDC -> Supabase Edge -> kk_runtime_expectations`

## Evidence that triggered v4.9.24

Under the prior :07-only policy, the natural workflow produced:

- one schedule run delayed to approximately minute 56, rejected by the unchanged 25-minute Edge receive-lag gate;
- one valid natural run at approximately minute 12, accepted end-to-end with `ledger_inserted=true` and `business_writes=0`;
- no later hourly natural runs in the observed GitHub schedule inventory.

OIDC, Edge validation, ledger insertion, and business-authority isolation are therefore already proven functional for at least one natural occurrence. The remaining issue is natural schedule delivery reliability.

## Authorized scheduler topology

Exactly one workflow and one provider remain authorized.

The workflow has one schedule expression:

`7,13 * * * *`

This creates two natural delivery attempts for the same represented top-of-hour occurrence:

- primary attempt at minute :07;
- bounded retry attempt at minute :13.

Both attempts compute:

`scheduled = floor(now / 1 hour) * 1 hour`

and therefore use the same:

`occurrence_id = SCANNER|<top-of-hour Bangkok timestamp>`

The workflow does not use `workflow_dispatch`, repository secrets, Cloudflare, HMAC, Vercel runtime scheduling, Scanner execution, or business writes.

## Why this is still one external clock

The policy does not introduce another workflow, runner, provider, watchdog, or clock source. The same GitHub Actions workflow/provider receives two natural schedule events within one hour for one represented occurrence.

A second successful attempt is not additional acceptance credit.

The canonical ledger enforces:

- `occurrence_id` primary key;
- unique `(role, scheduled_at)`;
- unique nonce.

The Edge insert uses conflict-ignore semantics. Therefore a later valid natural attempt for an already persisted occurrence must resolve idempotently and cannot create a second persisted expectation for that slot.

## Acceptance

Certification restarts at 0/6 only after:

1. v4.9.24 is exact1 Active in Machine-SOT;
2. the exact v4.9.24 workflow is merged to current main;
3. current-main regression is green;
4. exact current-main Vercel Production is READY;
5. Supabase Edge source/trust contract remains unchanged;
6. ledger uniqueness remains intact;
7. Scanner, Verifier, Canary and HF remain OFF;
8. `github_oidc_witness_v1` is exact1 FALSE immediately before activation.

Then only the witness kill switch may be changed to TRUE.

A certification slot earns at most one credit when one valid persisted natural expectation exists for the exact top-of-hour slot with:

- source `GITHUB_ACTIONS_CRON`;
- trigger version `kk-scanner-github-witness-v1`;
- mode `WITNESS_ONLY`;
- event `schedule`;
- second-precision Bangkok timestamps;
- receive lag <= 25 minutes;
- valid payload hash and identity;
- business writes = 0.

A later natural attempt for that same slot may be idempotently ignored. It earns zero extra credit and does not repair a previously missed historical slot.

Six exact consecutive hourly persisted expectations are still required. Any missing slot breaks the streak.

## Fail closed

Set the witness kill switch FALSE with exact readback and award zero credit if any of these occur:

- active policy ambiguity;
- a second witness workflow or second clock provider;
- cron not exactly `7,13 * * * *`;
- `workflow_dispatch` appears;
- the two attempts compute different represented occurrence IDs;
- persisted duplicate expectation for one role/hour;
- ledger uniqueness drift;
- OIDC claim drift;
- Edge source drift;
- timestamp precision/format drift;
- receive lag invalid;
- unexpected Scanner/Verifier/Canary/HF activation;
- any business write.

Preserve all evidence. Never delete or backfill missed witness rows.

## Rollback

1. set `github_oidc_witness_v1=false`;
2. exact-read it;
3. preserve all ledger evidence;
4. revert the default-branch workflow to the v4.9.23 :07-only schedule or disable the schedule under explicit policy;
5. keep Scanner/Verifier/Canary/HF OFF.

Rollback never creates replacement witness credit.
