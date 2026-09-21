# Private Reader Read-Only Acceptance — 2026-09-21

Status: **STAGED / READ-ONLY / NO RUNTIME CUTOVER**

## Objective

Provide a deterministic owner-triggered acceptance path for Gate 3 without exposing customer rows, service-account credentials, or granting write authority.

This package validates:
1. read-only Google service-account configuration;
2. exact Core / CRM manifest identity;
3. current sync freshness;
4. exact manifest 8-dataset coverage;
5. Core public-read versus CRM private-read reconciliation for all 8 retained datasets;
6. zero-write evidence.

It does **not** enable strict-private mode, revoke Core fallback, modify Sheet sharing, mutate CRM/Core rows, or change Production environment variables.

## Exact 8-dataset contract

The current CRM manifest exact-read on 2026-09-21 lists:

- `00_Rental_Dashboard`
- `_Rental_Dashboard_Data`
- `11_Customer_Stats`
- `12_Booking_Archive`
- `13_Event_Archive`
- `14_Event_Override_Archive`
- `15_Admin_Audit_Log`
- `16_Admin_Error_Log`

The acceptance runner refuses a manifest whose `sync_coverage` is not exactly this set.

## Current live manifest evidence

CRM Sheet:
`1mmXkDAk3NJtyWqp7qC8ByQyEgKsTY5IO1ca9xLQijaU`

Core Sheet:
`12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`

Fresh manifest read still reports:
- architecture = `dual-sheet-foundation-v1`
- Core remains Production SOT
- `full_read_model_acceptance = PASS_8_OF_8_EXACT_JSON` historically
- `last_synced_at = 2026-09-15T14:15:14+07:00`
- `auto_sync = ACTIVE_DEGRADED`
- `runtime_cutover = PENDING_PRIVATE_READER_ACCEPTANCE / BLOCKED_SAFE`
- `private_reader_runtime = VERCEL_PRIVATE_READER_CREDENTIALS_NOT_CONFIGURED / BLOCKED_SAFE`
- `private_analytics_acceptance = PENDING_PRIVATE_READER_ACCEPTANCE / BLOCKED_SAFE`

Therefore a live acceptance performed now must fail freshness before 8-dataset promotion. Historical 8/8 correctness is not treated as current freshness.

## Runner

`scripts/accept-private-reader.js`

Properties:
- service-account only;
- underlying Google scope remains `spreadsheets.readonly`;
- manifest read occurs first;
- stale sync blocks before dataset reconciliation;
- 8/8 reconciliation runs only when manifest identity, coverage, and freshness pass;
- output contains only status, counts, short hashes, safe IDs, and error codes;
- no row values are emitted;
- exception messages are not emitted;
- writes are fixed at `0`.

Terminal success:

`PASS_PRIVATE_READER_RECONCILED`

Required evidence:
- reader configured;
- manifest Core/CRM IDs exact;
- sync coverage exact 8;
- sync fresh inside configured tolerance;
- all 8 dataset comparisons exact;
- `writes=0`.

## Manual workflow

`.github/workflows/private-reader-acceptance.yml`

Manual trigger only:
`workflow_dispatch`

Required confirmation:
`RUN_PRIVATE_READER_ACCEPTANCE`

Required secret configuration:
- either `GOOGLE_SERVICE_ACCOUNT_JSON`
- or `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

The workflow does not accept credentials through user inputs and does not print them.

It:
1. requires main-branch dispatch;
2. fails before acceptance if read-only credentials are absent;
3. runs targeted regression;
4. runs the 8-dataset read-only acceptance;
5. uploads only the secret-safe JSON evidence;
6. requires terminal PASS with 8 datasets and zero writes.

## Current blocking dependencies

This package does not close Gate 3 by itself.

Current blockers:
1. current CRM sync is stale/degraded because the Make organization remains capacity-blocked;
2. private service-account credential has not been proven in runtime;
3. current Production is exact-main READY at port time; repository packaging still does not prove private-reader credentials or fresh CRM sync;
4. strict-private / Core-public-read removal is not authorized.

## Required final Gate 3 sequence

1. restore fresh 8-dataset sync;
2. configure the read-only service-account securely;
3. execute this acceptance and require `PASS_PRIVATE_READER_RECONCILED`;
4. separately prove the Production private reader health endpoint;
5. prove Rental Analytics uses `crm_private` with Core rollback available;
6. controlled strict-private test;
7. only then reduce anonymous operational-tab exposure.

## Safety accounting

This repository package performs:
- Core writes = 0
- CRM writes = 0
- sharing changes = 0
- Production env writes = 0
- Make mutations = 0
- Apps Script deploys = 0
- Scanner/Verifier/Canary mutations = 0
- HF activation = 0
- customer/provider sends = 0
