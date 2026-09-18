# KK External Scanner Runtime V1 — Staging

Date: 2026-09-18
Status: STAGED / DISABLED BY DEFAULT
Target policy: v4.9.20 external Scanner cutover staging

## Why this exists

The canonical ChatGPT Scanner repeatedly reaches valid governed Machine-SOT runtime and then becomes disabled, while other diagnostic recurring tasks can persist. Verifier has also shown launcher-only gaps and later task-off recurrence. Repeated task-ID rotation, same-ID recovery, and prompt minimalization did not produce a stable consecutive natural streak.

This change does not claim an exact platform actor or root cause. It reduces dependency on ChatGPT recurring-task persistence for the Scanner clock while preserving existing Machine-SOT authority.

## Phase 1 implemented in this branch

### 1. External clock contract

`cloudflare/kk-scanner-clock.mjs` produces one signed hourly Scanner expectation.

The envelope is deterministic:

- version: `kk-scanner-trigger-v1`
- role: `SCANNER`
- occurrence_id: `SCANNER|<Asia/Bangkok top-of-hour>`
- scheduled_at
- issued_at
- nonce
- source: `CLOUDFLARE_CRON`

HMAC-SHA256 is computed over the canonical newline-delimited envelope.

### 2. Vercel witness ingress

`POST /api/kk-scanner-dispatch`

The endpoint is deliberately witness-only in V1. It performs zero Scanner business work and zero Candidate/AI/business/provider writes.

It rejects requests unless all of the following are true:

- `KK_EXTERNAL_SCANNER_ENABLED=true`
- `KK_EXTERNAL_SCANNER_MODE=witness`
- `KK_EXTERNAL_SCANNER_SECRET` is configured
- runtime ledger is enabled and configured
- trigger version/role/source/occurrence identity are valid
- timestamp skew is within bounds
- HMAC signature is valid

Accepted requests only attempt to persist one idempotent runtime expectation.

### 3. Supabase runtime audit ledger

Staging SQL:
`supabase/staging/kk-runtime-ledger-v1.sql`

Tables:

- `kk_runtime_expectations`
- `kk_runtime_observations`
- `kk_task_state_events`
- `kk_control_plane_incidents`

The schema contains no booking, customer, KYC, pricing, inventory or notification business truth.

Security posture:

- RLS enabled on every table
- PUBLIC / anon / authenticated table access revoked
- server-side `service_role` only
- no browser/client service-role exposure
- no permissive RLS policy
- no Supabase project modified by this branch

The currently connected Supabase project named `supabase-cerulean-arrow` was observed INACTIVE and was not assumed to belong to KK Phone Rental. No restore/schema mutation was performed.

## Runtime ledger environment contract

All remain unset/disabled until the dedicated KK project is identified:

```
KK_RUNTIME_LEDGER_ENABLED=false
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

The service role must remain server-only.

## External Scanner ingress environment contract

All remain unset/disabled until controlled cutover:

```
KK_EXTERNAL_SCANNER_ENABLED=false
KK_EXTERNAL_SCANNER_MODE=witness
KK_EXTERNAL_SCANNER_SECRET=
```

Cloudflare Worker requires:

```
KK_SCANNER_DISPATCH_URL=https://<production-host>/api/kk-scanner-dispatch
KK_SCANNER_SHARED_SECRET=<same secret, stored as Worker secret>
```

Do not commit either secret.

## Cutover sequence

1. Merge this disabled staging code after CI/Preview.
2. Explicitly identify/create the dedicated KK Supabase project.
3. Apply the ledger SQL and verify tables/grants/RLS.
4. Configure server-only Supabase credentials on Vercel.
5. Configure matching HMAC secret on Vercel and Cloudflare.
6. Deploy Cloudflare Worker with `0 * * * *` only.
7. Enable witness mode first; prove at least 6 consecutive expectations.
8. Correlate expectations with Machine-SOT Scanner runtime evidence.
9. Only under a later explicit policy add the actual external Scanner worker/business staging path.
10. Disable the legacy/native Scanner clock before external Scanner becomes authoritative. Never run overlapping authoritative Scanner clocks.

## Non-goals in V1

- no production Scanner business execution
- no Candidate/AI writes
- no Machine-SOT write
- no task re-enable
- no new ChatGPT recurring task
- no HF production activation
- no Make/provider send
- no Apps Script deploy
- no booking/inventory mutation
- no Supabase project mutation
- no production secret mutation

## Acceptance

Repository staging PASS requires:

- `npm run check`
- `npm test`
- Preview deployment READY
- endpoint remains disabled without explicit env configuration
- zero production business writes

Production witness acceptance is a later gate and must not be inferred from repository CI.
