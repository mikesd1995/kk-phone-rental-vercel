# GitHub OIDC Witness v4.9.25 — Live Authority Reconciliation

Date: 2026-09-28  
Status: **FAIL-CLOSED RECONCILIATION / WITNESS MUST REMAIN DISABLED**

## Purpose

Record the currently observable control-plane authority for the GitHub OIDC witness without inventing missing policy details.

This document does **not** activate, retime, backfill, replace, or widen the witness. It reconciles a live authority state that is newer than the latest committed witness policy artifact.

## Verified live authority

Read-only Supabase inspection on 2026-09-28 returned exactly one control row for:

`github_oidc_witness_v1`

Observed state:

- `enabled=false`
- the row note identifies **v4.9.25 cutover staging**
- the note says the unreliable GitHub witness is to be retired before owner-authorized daily Ultra-Deep automations are created
- historical witness evidence must be preserved
- no backfill is authorized

No second matching control row was observed.

## Repository reconciliation

Repository history contains:

- v4.9.24 dual-natural-attempt authorization in PR #150 / commit `9588391d8caa7e40eb1381dc98e86b6873f155ae`
- current witness diagnostics in PR #265 / commit `e378a8ba64e358c6bb09f4cfaf662553dbee6582`

Repository search found **no committed v4.9.25 policy artifact** and no commit message establishing an alternate v4.9.25 witness activation contract.

Therefore the safe interpretation is:

1. live `enabled=false` remains authoritative for runtime activation;
2. v4.9.24 cannot be used to turn the witness back on while a newer live cutover state says retirement/staging;
3. the missing v4.9.25 detailed policy must not be reconstructed by assumption;
4. witness failures while disabled are diagnostic evidence, not a reason to enable or weaken the gate.

## Current technical evidence

- Current main: `e378a8ba64e358c6bb09f4cfaf662553dbee6582`
- Main Admin Regression run `36371706189`: PASS
- Current-main Vercel Production deployment `dpl_GdSTdCjFqRgxCKC3WqrCEoULxguC`: READY
- Supabase Edge function `kk-runtime-ledger-github-witness`: ACTIVE, version 2
- Edge receive-lag gate remains 25 minutes
- Ledger constraints remain:
  - PRIMARY KEY `occurrence_id`
  - UNIQUE `(role, scheduled_at)`
  - UNIQUE `nonce`
- Historical ledger contains one valid natural witness expectation and has not been backfilled
- Latest observed witness failures remain attributable to either receive-window lateness or the intentionally disabled control gate

## Binding safety rule

Until an owner-authorized successor policy is committed and its exact runtime transition is explicitly approved:

- keep `github_oidc_witness_v1=false`;
- do not widen the 25-minute receive-lag gate;
- do not retime a missed occurrence;
- do not backfill historical expectation rows;
- do not add `workflow_dispatch` for acceptance credit;
- do not add a second external clock merely to repair the witness;
- do not treat repeated disabled-gate failures as code defects;
- do not delete historical witness evidence.

Any future attempt to re-enable this witness must first reconcile the live control-plane note with a committed policy version and exact readback.

## Relationship to v4.9.24

The v4.9.24 document remains historical evidence of the prior authorized dual-attempt design. It is **not** authorization to override the newer observed v4.9.25 cutover state.

No v4.9.24 acceptance credit is awarded by this reconciliation.

## Release boundary

This reconciliation changes documentation only.

It makes no changes to:

- Supabase control-plane rows
- Edge Function code
- GitHub Actions cron
- Scanner / Verifier / Canary / HF state
- business data
- pricing
- production aliases

## Evidence trail

- PR #150 — v4.9.24 dual natural witness attempts
- PR #265 — witness failure diagnostics
- Main Admin Regression run 36371706189
- Witness runs 36362495108 and 36351032525
- Live Supabase `kk_control_plane_config` readback on 2026-09-28
- Live Supabase `kk_runtime_expectations` constraints/readback on 2026-09-28
