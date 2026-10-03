# Ultra Deep V26 production recovery — 2026-10-03

## Incident

Three V26 production deployments failed during the machine-ingress migration. The latest failed deployment for commit `8b74dc8390c73b1217946cf4a3c1d87d568cb7a1` reported Vercel `unused_function`: `api/kk-ultra-deep-machine.js` was still referenced by the `functions` map although that route had been removed after machine execution was folded into `api/kk-scanner-dispatch.js`.

## Current source state

Current `main` no longer contains the stale `api/kk-ultra-deep-machine.js` function entry. A current-main preview build is READY and `GET /api/kk-scanner-dispatch` returns the V26 readiness contract, including:
- `machine_ingress_version=KK_ULTRA_DEEP_MACHINE_V26`
- `machine_ingress_auth=SUPABASE_QUEUE_VERCEL_OIDC`
- `builtin_unknown_url_search=true`
- `business_writes_capable=false`

This proves the V26 route builds and serves on Vercel. It does not prove production activation.

## Production blocker

The canonical production alias still serves the older scanner readiness payload and reports scanner execution disabled/unconfigured. Therefore V26 must not be called production-ready yet.

## Acceptance contract

Do not claim FULL LOOP production acceptance until all are true:
1. A V26-containing deployment is the canonical production deployment.
2. `GET /api/kk-scanner-dispatch` on the canonical production alias reports V26 machine ingress.
3. Required scanner/runtime-ledger configuration is present and `ready_for_execution=true`.
4. A bounded read-only machine command completes with `business_writes=0`.
5. Verifier remains required and exact readback evidence is recorded.
6. Only after read-only acceptance may a governed commit-mode run be considered.

## Safety

No production/business write was performed by this recovery investigation. No secret was added or exposed. No deployment was created solely for this record.
