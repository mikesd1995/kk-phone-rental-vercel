# Runtime Ledger Credential Binding & Zero-Write Probe — 2026-09-19

## Status

**DATABASE PROVISIONED / CREDENTIAL BINDING BLOCKED ON OWNER-AUTHENTICATED DASHBOARD / ZERO-WRITE PROBE STAGED**

The dedicated Supabase runtime ledger is provisioned and verified. The remaining production binding requires a server-side Supabase secret API key to be stored in Vercel Production environment variables.

No production credential has been created, copied, committed, logged, or installed by this change.

## Authenticated binding attempt

A controlled browser workflow attempted to:

1. verify Supabase project `zehlsagzrpromtfqqflt` / `kk-phone-rental-runtime-ledger`;
2. create a new Supabase `sb_secret_...` key;
3. verify Vercel project `kk-phone-rental-vercel`;
4. bind the server-only credential to Vercel Production;
5. configure witness flags without enabling the external Scanner;
6. redeploy the same production revision only after exact commit verification.

The workflow stopped before mutation because the browser profile had no authenticated Supabase/GitHub or Vercel session. The login path encountered GitHub authentication/hCaptcha and no saved account credential was available.

Confirmed result:
- Supabase key creation: **0**
- Vercel environment changes: **0**
- Vercel redeploys from the browser workflow: **0**
- witness expectations inserted: **0**
- business writes: **0**

Any temporary HMAC value generated solely for the failed browser attempt is considered discarded and must never be reused as a production secret.

## Why connector-only binding cannot finish

Current connected APIs can:
- create/manage Supabase projects, SQL, migrations and advisors;
- read Vercel projects/deployments/logs;
- deploy source through normal repository workflows.

Current connected APIs do **not** expose:
- creation/retrieval of Supabase secret API keys;
- Vercel Production environment-variable mutation;
- a Cloudflare Workers account/secret-management connector.

The repository also has no `VERCEL_TOKEN`-backed workflow or other existing CI secret path that can safely bridge these missing operations.

Therefore the credential-binding step correctly remains blocked on an authenticated owner session rather than falling back to copied secrets, hard-coded credentials, public-key write access, or permissive RLS.

## Required production environment contract

When owner-authenticated binding becomes available, configure **Production only**:

```
SUPABASE_URL=https://zehlsagzrpromtfqqflt.supabase.co
SUPABASE_SECRET_KEY=<new server-only sb_secret key>
KK_RUNTIME_LEDGER_ENABLED=true
KK_EXTERNAL_SCANNER_MODE=witness
KK_EXTERNAL_SCANNER_SECRET=<new random shared HMAC secret>
KK_EXTERNAL_SCANNER_ENABLED=false
```

`SUPABASE_SECRET_KEY` and `KK_EXTERNAL_SCANNER_SECRET` must be Sensitive/server-only.

Keep `KK_EXTERNAL_SCANNER_ENABLED=false` until the zero-write ledger probe below succeeds and the external clock deployment has its own controlled acceptance.

## Zero-write connectivity probe

The existing dispatcher now supports:

`GET /api/kk-scanner-dispatch?probe=ledger`

This probe:
- does not require the external Scanner to be enabled;
- performs at most one bounded `WITNESS_ONLY` Scanner expectation read;
- returns only aggregate connectivity state and row count;
- never returns a ledger row, API key or secret;
- performs zero inserts/updates/deletes;
- always reports `business_writes: 0`.

Success requires:
- `KK_RUNTIME_LEDGER_ENABLED=true`;
- valid `SUPABASE_URL`;
- valid server-only Supabase key;
- successful bounded REST read.

Expected success shape includes:
- `runtime_ledger_probe.attempted=true`
- `runtime_ledger_probe.ok=true`
- `runtime_ledger_probe.read_only=true`
- `runtime_ledger_probe.bounded_limit=1`
- `runtime_ledger_probe.business_writes=0`

If credentials are missing or invalid, the probe fails closed with a machine-readable error and no write path.

## Binding acceptance sequence

1. Owner-authenticated session verifies exact Supabase project identity.
2. Create one new secret API key with a clear KK/Vercel witness label.
3. Verify exact Vercel project/team identity.
4. Configure the six Production variables above, keeping external Scanner disabled.
5. Redeploy only the exact current main revision.
6. Confirm default readiness GET reports ledger configured while external Scanner remains disabled.
7. Run `?probe=ledger` and require a zero-write PASS.
8. Fresh-read Supabase row counts; no probe-created rows are allowed.
9. Generate/configure a **fresh** shared HMAC secret on both Vercel and the eventual external clock.
10. Only then enable Witness V1 and collect real scheduled expectations.

No step above authorizes Scanner business execution, Candidate/AI writes, Machine-SOT mutation, HF production, Make/provider sends, or native Scanner/Verifier task mutation.
