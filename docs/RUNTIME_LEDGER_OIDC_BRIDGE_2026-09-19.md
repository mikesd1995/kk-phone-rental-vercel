# Runtime Ledger Vercel OIDC Bridge — 2026-09-19

## Status

**STAGED READ-ONLY / ZERO STATIC SUPABASE SECRET IN VERCEL / WITNESS STILL OFF**

This bridge is an alternative credential path for the canonical KK runtime ledger. It does not replace or activate Witness V1 in this stage.

## Why

The direct REST path requires a Supabase server secret in Vercel. The connected tool surfaces cannot retrieve/create that secret or mutate Vercel Production environment variables, and secrets must not be pasted into chat.

Vercel provides short-lived project OIDC identity to deployed functions. Supabase hosted Edge Functions receive server-side Supabase secret keys internally. The bridge uses those two platform-managed identities so the Supabase secret never leaves the canonical Supabase project.

## Exact caller identity

Only the KK Phone Rental Vercel production workload is accepted:

- team slug: `mikesd1995s-projects`
- team id: `team_uaeOdVIjXMSW690ZM2wPuJyt`
- project: `kk-phone-rental-vercel`
- project id: `prj_snbAmpya7YGmOuMbv1o8T16ouxl6`
- environment: `production`
- audience: `https://vercel.com/mikesd1995s-projects`
- subject: `owner:mikesd1995s-projects:project:kk-phone-rental-vercel:environment:production`

The Edge Function accepts only the two issuer modes documented by Vercel: the team issuer and Global issuer. The JWT signature is verified against Vercel JWKS before exact claims are accepted.

## Edge Function

`kk-runtime-ledger-oidc-probe` is deliberately read-only.

It:
- requires a Vercel OIDC bearer token;
- verifies signature, issuer, audience, subject, owner/team ID, project ID/name and production environment;
- reads the canonical Supabase secret from the Edge Function's built-in `SUPABASE_SECRET_KEYS` environment;
- performs exactly one bounded GET against `kk_runtime_expectations` for `SCANNER / WITNESS_ONLY`;
- returns only aggregate row count and non-secret status;
- performs zero inserts, updates or deletes;
- never returns the OIDC token, Supabase URL or secret key.

## Vercel diagnostic

Production dispatcher supports:

`GET /api/kk-scanner-dispatch?probe=ledger-oidc`

This path reads the short-lived Vercel runtime OIDC token and calls the canonical Edge Function. It does not depend on `KK_RUNTIME_LEDGER_ENABLED`, `SUPABASE_SECRET_KEY`, or the external Scanner HMAC because it is only a bounded connectivity/authentication diagnostic.

The direct `?probe=ledger` path remains unchanged.

## Activation boundary

Even if the OIDC probe passes:
- no witness expectation is inserted;
- external Scanner remains disabled;
- Cloudflare remains undeployed;
- witness acceptance remains 0/6;
- business writes remain 0;
- native Scanner/Verifier remain OFF under v4.9.19.

A later reviewed stage may decide whether OIDC should replace the static-secret Vercel-to-Supabase path for Witness V1 writes. That is explicitly outside this stage.

## Acceptance semantics

A successful OIDC probe proves only this bounded chain:

`Vercel production workload identity -> Vercel JWKS verification -> exact KK production claims -> canonical Supabase Edge Function -> one bounded ledger read`.

It earns **zero** Scanner/Verifier/witness streak credit and is not evidence that Cloudflare scheduling, occurrence insertion, Machine-SOT runtime, or business execution works. The direct static-secret path remains available as a reviewed fallback until a later explicit cutover decision; this PR does not delete or silently replace it.
