# Runtime Ledger Credential Binding & Zero-Write Probe — 2026-09-19

## Status

**CANONICAL DATABASE PROVISIONED / CREDENTIAL BINDING BLOCKED ON OWNER-AUTHENTICATED DASHBOARD / ZERO-WRITE PROBE STAGED**

The canonical Supabase runtime ledger is provisioned and verified at project ref `zehlsagzrpromtfqqflt`. PR #71 additionally enforces exact URL/ref binding before any ledger network call.

The remaining production binding requires a server-side Supabase secret API key to be created from the canonical project and stored in Vercel Production environment variables.

No production credential has been created, copied, committed, logged, or installed by this change.

## Authenticated binding attempt

A controlled browser workflow attempted to:

1. authenticate to the canonical Supabase project;
2. create a current `sb_secret_...` server key;
3. authenticate to the exact Vercel project;
4. configure Production-only runtime-ledger variables;
5. keep the external Scanner disabled;
6. redeploy only an exact verified production revision.

The workflow stopped before mutation because the browser profile had no authenticated Supabase/GitHub or Vercel account session. The login path encountered GitHub authentication/hCaptcha and no saved account credential was available.

Observed result:
- Supabase secret key creation: **0**
- Vercel environment changes: **0**
- Vercel redeploys from this browser workflow: **0**
- witness expectations inserted: **0**
- business writes: **0**

Any temporary HMAC value generated solely for that failed browser attempt is considered discarded and must never be reused as a production secret.

## Why connector-only binding cannot finish

Available connected APIs can:
- create/manage Supabase projects, SQL, migrations and advisors;
- read Vercel projects, deployments and runtime logs;
- maintain repository code through GitHub.

They do not currently expose:
- creation/retrieval of Supabase secret API keys;
- mutation of Vercel Production environment variables;
- Cloudflare Workers account/secret mutation.

The repository also has no `VERCEL_TOKEN`-backed workflow or existing GitHub Actions secret path for environment mutation.

The binding therefore remains blocked on an authenticated owner dashboard session rather than falling back to:
- hard-coded credentials;
- pasted secrets in chat;
- public/publishable keys for privileged writes;
- permissive RLS;
- mismatched Supabase projects.

## Canonical production environment contract

When an owner-authenticated binding session is available, configure Production only:

```
KK_RUNTIME_LEDGER_ENABLED=true
KK_RUNTIME_LEDGER_PROJECT_REF=zehlsagzrpromtfqqflt
SUPABASE_URL=https://zehlsagzrpromtfqqflt.supabase.co
SUPABASE_SECRET_KEY=<new server-only sb_secret key from the canonical project>
KK_EXTERNAL_SCANNER_MODE=witness
KK_EXTERNAL_SCANNER_SECRET=<new random shared HMAC secret>
KK_EXTERNAL_SCANNER_ENABLED=false
```

`SUPABASE_SECRET_KEY` and `KK_EXTERNAL_SCANNER_SECRET` must be Sensitive/server-only.

The URL and project ref must pass the PR #71 canonical binding gate. Keep `KK_EXTERNAL_SCANNER_ENABLED=false` until the zero-write connectivity probe succeeds and the external clock is ready for a controlled Witness V1 cutover.

## Zero-write connectivity probe

The existing dispatcher supports:

`GET /api/kk-scanner-dispatch?probe=ledger`

This path:
- does not require the external Scanner to be enabled;
- inherits the canonical project-ref binding gate;
- performs at most one bounded `SCANNER / WITNESS_ONLY` expectation read;
- returns aggregate connectivity state and row count only;
- never returns a ledger row, project ref, URL, API key or HMAC secret;
- performs zero inserts/updates/deletes;
- always reports `business_writes: 0`.

Success requires:
- `KK_RUNTIME_LEDGER_ENABLED=true`;
- exact canonical `KK_RUNTIME_LEDGER_PROJECT_REF`;
- exact canonical HTTPS `SUPABASE_URL`;
- valid server-only key belonging to that project;
- successful bounded Supabase REST read.

Expected success shape includes:
- `runtime_ledger_probe.attempted=true`
- `runtime_ledger_probe.ok=true`
- `runtime_ledger_probe.read_only=true`
- `runtime_ledger_probe.bounded_limit=1`
- `runtime_ledger_probe.business_writes=0`

A URL/ref mismatch fails before network access. Missing/invalid credentials or REST failure returns a machine-readable fail-closed result and zero writes.

## Binding acceptance sequence

1. Owner-authenticated session verifies exact canonical Supabase project.
2. Create one new secret API key with a clear KK/Vercel witness label.
3. Verify exact Vercel team/project identity.
4. Configure the seven Production variables above, keeping external Scanner disabled.
5. Redeploy only the exact current main revision.
6. Default readiness GET must show URL/ref binding configured and matching while external Scanner remains disabled.
7. Run `?probe=ledger`; require zero-write PASS.
8. Fresh-read canonical Supabase ledger counts; the probe must create no rows.
9. Generate a fresh HMAC secret and bind the same secret to Vercel and the eventual external clock.
10. Only then enable Witness V1 and collect actual scheduled expectations.

No step above authorizes Scanner business execution, Candidate/AI writes, Machine-SOT mutation, HF production, Make/provider sends, or native Scanner/Verifier task mutation.
