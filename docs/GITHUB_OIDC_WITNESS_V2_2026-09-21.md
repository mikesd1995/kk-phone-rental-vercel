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
- A dedicated `kk_control_plane_config/github_oidc_witness_v1` kill switch defaults to `enabled=false`; exact1 + true is required before any witness insert.
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
3. Apply the control-table migration with `github_oidc_witness_v1=false`; verify exact1 and clean ledger.
4. Deploy the Edge Function inert; require source parity to the validated branch and verify the disabled gate rejects writes.
5. Adopt a later explicit Machine-SOT policy that supersedes v4.9.20 clock-source requirements.
6. Merge the exact validated branch to main.
7. Re-deploy Edge Function from exact main source and verify source parity.
8. Confirm native Scanner/Verifier/Canary/HF remain OFF and ledger is clean.
9. Flip only `github_oidc_witness_v1=true` immediately before natural certification.
10. Collect 6 consecutive natural expectations.
11. Any invalid claim/source/version/slot, unexpected business write, native task activation, or clock overlap fails closed.

## Rollback

First set `kk_control_plane_config.github_oidc_witness_v1=false` and exact-read it. This immediately makes the Edge Function reject future witness writes. Then remove/disable the scheduled workflow on default branch under an explicit rollback commit/policy. The Edge Function may remain deployed inert. Preserve ledger evidence; never delete or backfill rows.
