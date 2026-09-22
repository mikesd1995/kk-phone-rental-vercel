# v4.9.24 — GitHub OIDC single-workflow dual-natural-attempt reliability

Status: **STAGED — kill switch remains FALSE until all entry gates pass.**

## Problem evidence

The v4.9.23 natural witness path proved that GitHub Actions schedule -> GitHub OIDC -> Supabase Edge -> canonical ledger can succeed, but hourly schedule creation/delivery was intermittent:

- natural run `35647974704` reached the Edge too late and failed with `TRIGGER_SCHEDULE_STALE`;
- natural run `35666472962` succeeded with `GITHUB_OIDC_WITNESS_ACCEPTED`, `ledger_inserted=true`, `business_writes=0`;
- later expected hourly schedule runs were absent;
- historical ledger evidence is preserved and receives zero v4.9.24 certification credit.

GitHub scheduled workflows can be delayed under load, so v4.9.24 adds a second natural attempt inside the **same workflow/provider**, not a second external scheduler.

## Authorized topology

Exactly one default-branch workflow remains authoritative:

`.github/workflows/kk-external-witness-clock.yml`

Exactly one cron expression is allowed:

`7,13 * * * *`

This produces two natural GitHub schedule attempts per UTC hour from the same workflow. Both attempts compute:

`scheduled = floor(now / 1 hour) * 1 hour`

and therefore the same Bangkok top-of-hour:

`occurrence_id = SCANNER|<top-hour +07:00>`

No `workflow_dispatch`, repository secret, second workflow, second provider clock, watchdog, manual trigger, synthetic row or historical backfill is authorized.

## Idempotency and one-credit-per-slot

The unchanged Edge function writes with:

- `on_conflict=occurrence_id`;
- `resolution=ignore-duplicates`.

The canonical runtime ledger independently enforces:

- primary key `occurrence_id`;
- unique `(role, scheduled_at)`;
- unique `nonce`.

Therefore the first valid natural attempt may persist one expectation. A later valid attempt for the same hourly occurrence is an idempotent duplicate and may not create a second persisted row or a second certification credit.

## Unchanged Edge/trust contract

No Edge source or database schema change is part of v4.9.24.

Unchanged boundaries include:

- GitHub OIDC issuer/repository/ref/workflow/event claim checks;
- `MAX_RECEIVE_LAG_MS = 25 minutes`;
- exact top-hour Bangkok scheduled timestamp;
- second-precision timestamp format;
- witness-only mode;
- `scanner_execution_started=false`;
- `business_writes=0`.

Supabase Edge source must remain byte-equivalent to current main before activation.

## Activation gates

Before setting `github_oidc_witness_v1=true`, require all of:

1. exactly one Active `POLICY_VERSION=v4.9.24`;
2. witness kill switch exact FALSE before activation;
3. current main and Production exact SHA parity;
4. exactly one witness workflow;
5. exactly one cron expression `7,13 * * * *`;
6. no `workflow_dispatch`;
7. OIDC claims and Edge source unchanged;
8. runtime-ledger uniqueness constraints present;
9. exact-head CI PASS;
10. exact-head Preview READY;
11. current-main CI PASS after merge;
12. Scanner / Verifier / Canary remain OFF;
13. HF Production remains OFF;
14. business writes remain zero.

Only after every gate passes may the existing kill switch be enabled with exact readback.

## Certification

v4.9.24 starts a new certification window at **0/6**.

A creditable slot requires exactly one persisted natural expectation for the represented hourly occurrence with valid source/version/mode/hash/timestamp/receive-lag and zero business writes.

The second natural attempt for the same slot can be accepted idempotently but earns **zero extra credit**.

Any missing hourly slot, persisted duplicate, invalid receive lag, identity/source/hash drift, unexpected runtime activation or business write breaks the streak.

Six consecutive persisted hourly expectations prove external-clock persistence only. They do **not** authorize Scanner, Verifier, Canary, HF Production or business cutover.

## Rollback

Rollback is database-first:

1. set `github_oidc_witness_v1=false`;
2. exact-read FALSE;
3. preserve all ledger evidence;
4. revert the default-branch cron to v4.9.23 `:07` only, or disable the schedule if required;
5. never delete or backfill historical expectations;
6. keep Scanner / Verifier / Canary / HF OFF.
