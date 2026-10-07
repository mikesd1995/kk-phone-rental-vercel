# KK Phone Rental — Operations Runbook

## Operating rule
Diagnose the first failing boundary. Do not create replacement runners, writers, schedulers or sources of truth to hide a symptom.

## Standard recovery order
1. Preserve exact failure evidence and version/SHA.
2. Classify boundary: code/test, runner/provisioning, provider/quota, deployment, runtime binding, data/SOT, external writer, or UI/runtime.
3. Check known reliability fingerprint/repair first.
4. Retry only when the failure class is transient and retry is safe.
5. Use an existing approved fallback before inventing infrastructure.
6. After any authorized mutation, exact-readback the affected external state.
7. Run the applicable `ACCEPTANCE.md` gate.

## Vercel/deployment
A requested deployment is not proof of production. Rate-limit/quota failures are deployment blockers, not code failures. When READY becomes available, resolve the current production deployment and verify runtime binding/version before acceptance.

## GitHub Actions
Separate runner/provisioning failure from test/code failure. Preserve job/step/log evidence. Re-run only failed jobs when appropriate; do not weaken tests to obtain green status.

## Scanner/Verifier
Scanner remains staging/evidence. Provider failure must fail closed where required. Do not bypass Verifier or governed writer to complete a scan.

## Business data
Before repairing booking, pricing, inventory or event truth, identify canonical row/entity evidence. Avoid broad rewrites. Read back the exact changed record and dependent availability/read model.

## Storefront
For visual defects, preserve viewport/screenshot evidence, reproduce the affected state, use the UX/Visual QA gate, then verify production. Do not mask root causes with clipping/fixed heights.

## Learning after recovery
Feed confirmed recurring incidents into the existing reliability learning flow. Promote only validated lessons according to `ACCEPTANCE.md`; unknown incidents remain hypotheses.
