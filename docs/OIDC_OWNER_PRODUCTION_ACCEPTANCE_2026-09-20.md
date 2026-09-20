# Owner OIDC Production Acceptance Tool — 2026-09-20

## Purpose

Finish the remaining Vercel Production -> canonical Supabase OIDC connectivity acceptance without weakening the fail-closed control-plane design.

This tool exists because the connected Vercel app can read/deploy but cannot mutate Project Environment Variables, the GitHub repository has no `VERCEL_TOKEN`, and no authenticated Vercel/GitHub browser session or vault credential is currently available.

The tool does **not** enable Scanner business execution. It temporarily enables only the read-only OIDC diagnostic gate, runs exactly one bounded probe, and restores the gate to false.

## Command

```bash
npm run accept:oidc-prod -- \
  --source-deployment <current-production-dpl_id> \
  --expected-sha <exact-current-main-40-char-sha>
```

Authentication is accepted in either form:

1. `VERCEL_TOKEN` environment variable, or
2. an already authenticated Vercel CLI session from `vercel login`.

No credential should be pasted into chat or committed to the repository.

## Dry-run

```bash
npm run accept:oidc-prod -- \
  --source-deployment <current-production-dpl_id> \
  --expected-sha <exact-current-main-40-char-sha> \
  --dry-run
```

Dry-run performs:
- source deployment read;
- exact READY check;
- exact Git SHA match;
- Production readiness read;
- verifies external Scanner OFF;
- verifies Scanner execution incapable;
- verifies business writes incapable;
- verifies OIDC probe gate currently false.

Dry-run performs **zero mutations**.

## Live sequence

The live tool performs this exact sequence:

1. authenticate to Vercel through existing owner credential;
2. read exact source deployment;
3. require state READY;
4. require deployment Git SHA exact-match `--expected-sha`;
5. read Production `/api/kk-scanner-dispatch`;
6. require:
   - external_scanner_enabled=false
   - scanner_execution_capable=false
   - business_writes_capable=false
   - runtime_ledger_oidc_probe_enabled=false
7. upsert only:
   - `KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED=true`
   - target=production
8. redeploy the exact source deployment;
9. wait for READY;
10. wait until Production readiness exact-reads probe gate=true;
11. call exactly one:
    - `GET /api/kk-scanner-dispatch?probe=ledger-oidc`
12. require:
    - HTTP 200
    - authenticated=true
    - read_only=true
    - bounded_limit=1
    - business_writes=0
    - external Scanner still OFF
    - Scanner execution still incapable
    - business writes still incapable
13. enter rollback even on probe failure;
14. upsert only:
    - `KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED=false`
15. redeploy the same exact source deployment;
16. wait READY;
17. require final Production readiness exact-reads probe gate=false.

## Rollback semantics

Rollback is in a `finally` block.

If mutation reaches the point where the flag may be true, any later failure attempts:
- flag=false;
- exact-source redeploy;
- final readiness false.

If rollback itself cannot be verified, the tool exits with:

`OIDC_ACCEPTANCE_ROLLBACK_FAILED`

and includes only secret-safe evidence.

## Secret handling

The tool never prints:
- Vercel token;
- Authorization header;
- Supabase secret;
- OIDC JWT;
- unrelated environment values.

Evidence redaction replaces object keys matching token/secret/authorization/key with `[REDACTED]`.

## Evidence schema

Successful output:

```text
schema = KK_OIDC_PRODUCTION_ACCEPTANCE_V1
result = PASS_AND_ROLLED_BACK
probe.authenticated = true
probe.read_only = true
probe.bounded_limit = 1
probe.business_writes = 0
rollback.ok = true
rollback.oidc_probe_enabled = false
rollback.external_scanner_enabled = false
rollback.scanner_execution_capable = false
rollback.business_writes_capable = false
```

## Current exact production baseline at creation

At the time this tool was created:

- main SHA: `959c8d00c92610cdf91846db02e9cffd9b95146f`
- Production deployment: `dpl_GU2NHKaz7tmctb9CksMBw6xF5YjF`
- Production state: READY
- branch: main

These values are documentation only. The operator must supply the current exact deployment/SHA at execution time. The tool refuses SHA drift.

## Current blocker

As of 2026-09-20:

- connected Vercel app exposes no project-env write action;
- GitHub `VERCEL_TOKEN` secret is absent;
- TinyFish Vercel/GitHub profile is unauthenticated;
- TinyFish vault reports no credentials configured.

Therefore the live acceptance cannot be honestly claimed until an owner-authenticated Vercel credential exists in one of the supported execution surfaces.

## What this tool does not authorize

Even a PASS does **not** authorize:
- native Scanner re-enable;
- native Verifier re-enable;
- Scanner/Verifier acceptance credit;
- external Scanner recurring execution;
- Google Sheet business writes;
- HF production activation;
- Cloudflare scheduler deployment;
- Make Admin write routing.

A PASS proves only the bounded OIDC connectivity chain.

## Related

- Issue #47 — control-plane audit
- Issue #14 — Scanner persistence
- Issue #49 — final production completion gate
- PR #97 — merged OIDC bridge
- PR #98 — temporary CI acceptance runner, closed unmerged after `VERCEL_TOKEN_MISSING`
