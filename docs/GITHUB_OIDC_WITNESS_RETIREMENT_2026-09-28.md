# GitHub OIDC Witness Retirement — 2026-09-28

Status: **RETIRED / FAIL-CLOSED / NO REPLACEMENT CLOCK**

## Decision

The experimental GitHub OIDC witness scheduler is retired from the active repository tree.

The scheduled workflow `.github/workflows/kk-external-witness-clock.yml` is removed so a disabled witness no longer produces recurring expected failures or timing noise.

This retirement does not delete forensic history and does not convert the witness into another runtime.

## Preserved historical evidence

The following remain unchanged for auditability:

- Supabase Edge function `kk-runtime-ledger-github-witness`;
- `kk_runtime_expectations` historical rows and uniqueness constraints;
- `kk_control_plane_config.github_oidc_witness_v1`;
- prior GitHub Actions run history;
- v4.9.24 and v4.9.25 witness documentation.

Live readback before retirement established `github_oidc_witness_v1=false`. Keep `github_oidc_witness_v1=false`.

There is **no backfill** and historical missed slots receive zero acceptance credit.

## Runtime successor boundary

The witness is not replaced by Make, another GitHub workflow, Vercel Cron, Cloudflare, or another external clock.

The current Machine SOT already binds the production control plane to exactly two existing ChatGPT scheduled task identities under v4.9.44:

- SCANNER: `6ab272b36b1881919577ff3367fa8245`
- VERIFIER/CLOSURE: `6ab7e060fa788191b5f17a7028494c3a`
- topology: `ACTIVE_TASKS_EXACT2`
- timezone: `Asia/Bangkok`

The exact Scanner cadence is 01:00, 09:00, 12:00, 15:00, 18:00 and 21:00.
The exact Verifier/Closure cadence is 01:30, 07:30, 09:30, 12:30, 15:30, 18:30 and 21:30.

Task registry readback on 2026-09-28 confirmed both exact IDs exist, are enabled, and retain those schedules.

Do not create a replacement witness clock.
Do not create a new Make scenario.
Do not create a new GitHub Actions scheduler.
Do not clone, rename, reschedule or replace the Machine-SOT-bound tasks to hide a missed natural runtime.

## Current runtime evidence

At the retirement checkpoint on 2026-09-28:

- the canonical Scanner and Verifier tasks are enabled;
- their task metadata alone is not runtime proof;
- Machine SOT has no 2026-09-28 Scanner `_Scan_Status`, `_Run_Manifest` or role-lock evidence for the already elapsed 01:00 / 09:00 Scanner slots;
- therefore those elapsed slots are classified `MISSING_RUNTIME`, not repaired or backfilled;
- the most recent durable owner-manual Ultra Deep evidence is from 2026-09-27 and earns no natural-runtime credit.

A natural future slot is the only valid next runtime acceptance opportunity.
Timer metadata alone earns zero acceptance credit.

## Next acceptance

For the next natural Scanner occurrence, require the live Machine SOT gates before any mutation:

1. exactly one Active `POLICY_VERSION`;
2. current exact task binding;
3. `OWNER_PAUSE=FALSE`;
4. no conflicting valid writer;
5. monotonic `CORE_SHARED_WRITER` + `SCANNER_GLOBAL` fencing;
6. exactly one Scanner Manifest;
7. `_Scan_Status` exact1;
8. `_Run_Coverage >= 1` with honest debt accounting;
9. terminal state and exact readback;
10. safe release.

The following Verifier occurrence must independently prove its own lock, Manifest, transaction terminality, packet processing/no-op boundary, exact readback and safe release.

Do not infer success from task `last_run_time`, scheduler metadata, or an API 2xx response.

## Production authority

Scanner remains staging/discovery authority only.
It must not final-write pricing, booking, inventory, customer/provider state, or bypass Verifier and owner-visibility rules.

Verifier remains the governed finalization boundary defined by the current Machine SOT.

Canary and unrelated HF/Make runtimes remain outside this retirement change.

## Rollback

Retirement rollback is not automatic.

Reintroducing the GitHub witness requires a new explicit owner-authorized policy, a new review of its necessity, and fresh fail-closed acceptance. The retired workflow must not be restored merely because a canonical Scanner/Verifier natural slot is missed.

## Changes in this retirement

- remove active scheduled GitHub witness workflow;
- convert witness CI from active-schedule assertions to retirement/fail-closed assertions;
- preserve Supabase Edge and ledger evidence;
- preserve `github_oidc_witness_v1=false`;
- preserve the existing v4.9.44 exact-two Scanner/Verifier task topology;
- create no new scheduler and perform zero business writes.
