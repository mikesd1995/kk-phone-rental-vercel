# GitHub OIDC Witness V2 — Zero-Cost External Clock

Date: 2026-09-21
Status: STAGED / NOT ACTIVE UNTIL EXPLICIT MACHINE-SOT POLICY

## Purpose

Replace the credential-heavy Cloudflare + Vercel static Supabase binding path for witness-only clock certification with:

`GitHub Actions schedule -> GitHub OIDC -> Supabase Edge Function -> kk_runtime_expectations`

This path is intentionally separate from Scanner business execution.

## Security / authority

- GitHub OIDC issuer is verified against GitHub JWKS.
- Audience is the exact canonical Supabase Edge Function URL.
- Claims are pinned to repository, repository id, owner id, `refs/heads/main`, `event_name=schedule`, and the exact workflow ref.
- No GitHub repository secret is required.
- No Vercel token, Vercel environment variable, Supabase secret in Vercel, Cloudflare API token, HMAC shared secret, or TinyFish/browser balance is required for the clock.
- The Supabase Edge Function uses only its platform-internal server credential to insert one idempotent `WITNESS_ONLY` runtime expectation.
- Candidate, AI, event truth, pricing, booking, inventory, notification, provider/customer and HF paths are absent.
- `business_writes=0` and `scanner_execution_started=false` are terminal authority boundaries.

## Natural acceptance

The workflow has schedule only:

`0 * * * *`

No `workflow_dispatch` exists. The Edge Function also requires the GitHub OIDC claim `event_name=schedule`, so a manual GitHub run cannot earn witness credit.

Persisted source/version:

- source: `GITHUB_ACTIONS_CRON`
- trigger version: `kk-scanner-github-witness-v1`
- mode: `WITNESS_ONLY`

Six consecutive valid natural expectations still prove only external clock persistence. They do not prove Scanner runtime or authorize production cutover.

## Activation order

1. Branch CI must pass.
2. Deploy Edge Function while the schedule is not on default branch; confirm zero ledger rows added.
3. Adopt a later explicit Machine-SOT policy that supersedes v4.9.20 clock-source requirements.
4. Merge the exact validated branch to main.
5. Re-deploy Edge Function from exact main source and verify source parity.
6. Confirm native Scanner/Verifier/Canary/HF remain OFF and ledger is clean before first natural top-of-hour.
7. Collect 6 consecutive natural expectations.
8. Any invalid claim/source/version/slot, unexpected business write, native task activation, or clock overlap fails closed.

## Rollback

Remove/disable the scheduled workflow on default branch under an explicit rollback commit/policy. The Edge Function can remain deployed inert because no accepted caller exists without the exact scheduled workflow OIDC claim. Preserve ledger evidence; never delete or backfill rows.
