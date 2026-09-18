# External Scanner Witness Acceptance — 2026-09-18

## Status

**REPOSITORY ACCEPTANCE TOOLING ONLY / PRODUCTION WITNESS STILL OFF**

This adds a deterministic auditor for the witness-only external Scanner clock staged by PR #59.

It does not enable the Vercel witness endpoint, create/restore a Supabase project, apply SQL, deploy Cloudflare, mutate ChatGPT Scanner/Verifier tasks, or authorize Scanner business execution.

## Current control-plane evidence

Active Machine-SOT policy is v4.9.19.

The native recurring-task defect remains open:

- Scanner 20:00 reached governed runtime and then the canonical task became OFF.
- Verifier 22:30 reached governed runtime and the canonical task became OFF while its own runtime was still active.
- Current v4.9.19 persistence acceptance remains 0/6 for both roles.
- v4.9.19 explicitly prohibits another automatic same-ID re-enable loop or identity rotation without a later explicit policy.

Therefore external witness work must remain diagnostic and non-authoritative.

## Supabase project discovery

Connected Supabase currently exposes one project:

- name: `supabase-cerulean-arrow`
- state: `INACTIVE`

The project is not identified as a dedicated KK Phone Rental runtime-ledger project. It was not restored and the staged SQL was not applied.

A dedicated project must be explicitly identified or created before any live ledger mutation.

## New acceptance auditor

Command:

```bash
npm run audit:scanner-witness
npm run audit:scanner-witness -- --required=6 --limit=24
```

The command is read-only. It reads only the bounded control-plane fields from `kk_runtime_expectations` through the server-only service-role credential already required by the staged ledger adapter.

It does not read or print business data.

## Witness acceptance contract

A witness streak passes only when the latest required window has exactly one valid row per hourly Bangkok top-of-hour slot.

Each row must satisfy:

- role = `SCANNER`
- source = `CLOUDFLARE_CRON`
- trigger version = `kk-scanner-trigger-v1`
- mode = `WITNESS_ONLY`
- status is an allowed runtime-ledger state
- `occurrence_id` exactly matches `scheduled_at`
- receipt timing remains inside the bounded ingress window
- no duplicate scheduled slot
- no missing hourly slot
- latest occurrence is fresh

Default requirement is six consecutive hourly expectations.

## Important semantic boundary

`WITNESS_STREAK_PASS` proves only that the external clock → signed ingress → private ledger witness path delivered six consecutive recent expectations.

It does **not** prove:

- Scanner business execution;
- Machine-SOT CORE/SCANNER locks;
- Manifest creation;
- Candidate/AI handoff;
- native task persistence;
- HF production readiness;
- production Scanner cutover.

The auditor therefore always emits:

```json
{
  "scanner_runtime_acceptance": false,
  "production_cutover_authorized": false
}
```

Those values cannot become true in this V1 witness auditor.

## Supabase compatibility note

The staged SQL already includes explicit `service_role` grants for the Data API tables and revokes public/anon/authenticated access. This matches Supabase's 2026 Data API grant change for new/existing projects; RLS remains enabled as defense in depth.

## Next controlled gate

Only after a dedicated KK Supabase project is identified and the ledger is deliberately configured may a later explicit policy authorize:

1. schema application + RLS/advisor verification;
2. Vercel server-only ledger credentials;
3. shared HMAC secret configuration;
4. Cloudflare witness deployment;
5. six consecutive witness expectations;
6. correlation against Machine-SOT runtime evidence;
7. a separately reviewed external Scanner execution design.

No overlapping authoritative Scanner clocks are permitted.
