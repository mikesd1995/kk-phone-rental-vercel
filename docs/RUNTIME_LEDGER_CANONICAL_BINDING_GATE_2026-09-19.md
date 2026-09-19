# Runtime Ledger Canonical Binding Gate — 2026-09-19

## Status

**RESOLVED / CANONICAL PROJECT IDENTIFIED / RUNTIME BINDING GUARDED / WITNESS STILL OFF**

A concurrent provisioning race created two zero-row V1 runtime-ledger projects. The ambiguity is now resolved from durable provenance and a reversible duplicate disposition.

## Canonical project

- name: `kk-phone-rental-runtime-ledger`
- ref: `zehlsagzrpromtfqqflt`
- region: `ap-southeast-1`
- created: `2026-09-19T07:01:41.216622Z`
- migration: `20260919080906 kk_runtime_ledger_v1`
- persistent V1 rows at acceptance: 0 / 0 / 0 / 0
- current-main PR #69 provisioning documentation explicitly identifies this ref as the dedicated project
- corrected current-main verifier executes without exception against this project
- Security Advisor findings are INFO-only `rls_enabled_no_policy`, expected because anon/authenticated table access is explicitly revoked and no public policy is intended
- Performance Advisor findings are INFO-only unused indexes, expected before witness traffic

## Duplicate project disposition

- name: `kk-phone-rental-runtime`
- ref: `unxangvmhjtlqmiiuurw`
- created: `2026-09-19T07:02:24.290995Z`
- migration: `20260919081210 kk_runtime_ledger_v1`
- persistent V1 rows at verification: 0 / 0 / 0 / 0

The duplicate was created by a second owner-authorized zero-cost provisioning run that began during concurrent repository work, approximately 43 seconds after the canonical project was created. It was independently verified with the corrected current-main verifier, then paused reversibly. Fresh provider readback reports it INACTIVE.

No runtime environment, Worker, or acceptance streak was bound to the duplicate before it was paused.

## Runtime binding contract

Production runtime configuration must include all three of:

```
KK_RUNTIME_LEDGER_PROJECT_REF=zehlsagzrpromtfqqflt
SUPABASE_URL=https://zehlsagzrpromtfqqflt.supabase.co
SUPABASE_SECRET_KEY=<server-only secret from the same project>
```

`SUPABASE_SERVICE_ROLE_KEY` remains a legacy compatibility fallback only.

`server/runtime-ledger.js` resolves the project ref from `SUPABASE_URL` and requires exact equality with `KK_RUNTIME_LEDGER_PROJECT_REF`. The runtime ledger remains unconfigured when:

- the expected project ref is absent;
- the URL is absent or malformed;
- the URL is not a canonical `<ref>.supabase.co` project URL;
- the URL resolves to a different project ref;
- the server key is absent;
- `KK_RUNTIME_LEDGER_ENABLED` is not explicitly true.

A key that belongs to a different project is still rejected indirectly because the URL/ref binding gate must pass first and live Data API authorization must then succeed.

## Secret-safe readiness

`GET /api/kk-scanner-dispatch` may report only configuration-presence and binding booleans:

- `supabase_project_ref_configured`
- `supabase_url_project_ref_resolved`
- `supabase_project_binding_matches`

It must not return the canonical project ref, project URL, server key, or HMAC secret.

## Activation boundary

Resolving the duplicate does **not** activate the external Scanner.

Until a later controlled cutover:

- `KK_RUNTIME_LEDGER_ENABLED=false` / unset
- `KK_EXTERNAL_SCANNER_ENABLED=false` / unset
- production Vercel has no Supabase runtime-ledger URL/key configured
- Cloudflare witness is not connected/deployed
- native Scanner/Verifier remain OFF under v4.9.19 fail-closed handling
- witness acceptance remains 0/6
- `scanner_execution_capable=false`
- `business_writes_capable=false`

Repository/DB provisioning/binding PASS is not external-clock runtime acceptance.

## Audit references

- PR #69: corrected verifier and canonical dedicated-project provisioning acceptance
- Issue #70: duplicate provisioning incident
- PR #71: canonical binding guard
- Machine SOT v232: live reconciliation and duplicate disposition checkpoint
