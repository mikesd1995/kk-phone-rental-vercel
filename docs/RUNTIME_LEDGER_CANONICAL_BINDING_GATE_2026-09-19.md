# Runtime Ledger Canonical Binding Gate — 2026-09-19

## Status

**BLOCKED / DUPLICATE PROVISIONING PROVEN / NO RUNTIME BINDING AUTHORIZED**

Fresh connected Supabase readback found two ACTIVE_HEALTHY KK-named projects with the same V1 ledger contract.

### Project A — repository-documented dedicated ledger
- name: `kk-phone-rental-runtime-ledger`
- ref: `zehlsagzrpromtfqqflt`
- created: `2026-09-19T07:01:41.216622Z`
- migration: `20260919080906 kk_runtime_ledger_v1`
- persistent V1 rows: 0 / 0 / 0 / 0
- #69 provisioning document explicitly identifies this ref as the dedicated project.

### Project B — duplicate-provisioned candidate
- name: `kk-phone-rental-runtime`
- ref: `unxangvmhjtlqmiiuurw`
- created: `2026-09-19T07:02:24.290995Z`
- migration: `20260919081210 kk_runtime_ledger_v1`
- persistent V1 rows: 0 / 0 / 0 / 0

Both projects expose the same four V1 table comments and both have the same migration name. This proves duplicate provisioning but does not prove the actor or intent that created Project B.

## Fail-closed canonical rule

Until provenance is resolved:
1. Do not set `SUPABASE_URL` or a Supabase server key in the production witness runtime.
2. Keep `KK_RUNTIME_LEDGER_ENABLED=false`.
3. Keep `KK_EXTERNAL_SCANNER_ENABLED=false`.
4. Do not deploy/enable an external witness clock.
5. Do not count any witness streak.
6. Do not pause/delete either project merely to remove ambiguity.
7. Do not infer canonical identity from project name alone.

Repository evidence currently nominates Project A, but binding requires explicit control-plane provenance/readback so that a second provisioned project cannot silently become a split-brain ledger.

## Resolution acceptance

The ambiguity can be closed only after durable evidence records:
- canonical project ref;
- why the non-canonical project exists;
- explicit confirmation that no runtime/env/worker points at the non-canonical project;
- disposition of the non-canonical project;
- exact readback after any later runtime binding.

Issue #70 is the incident record. This gate is repository documentation only and performs no Supabase/Vercel/Cloudflare/Machine-SOT/task/business mutation.
