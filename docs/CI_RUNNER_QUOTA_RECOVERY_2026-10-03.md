# CI Runner Quota Recovery — 2026-10-03

## Incident
GitHub-hosted jobs on current main `d8b4845f216f6e94d450701e7ed68cce37795f0c` fail before executing any workflow step.

Observed exact runs:
- Project Memory Enforcement: 37116189242 / job 111183357349
- Rental Analytics Production Watch: 37116189267 / job 111183357664
- Admin Regression: 37116189287 / job 111183357583

Each failed within roughly two seconds, exposes zero executed steps through the Actions API, and has no downloadable job log. This is runner/provisioning infrastructure evidence, not evidence that repository tests failed.

## Recovery change
- Remove the redundant `push: main` trigger from Rental Analytics Production Watch.
- Reduce its fallback schedule from every 6 hours to every 12 hours.
- Keep `workflow_dispatch` for deliberate read-only verification.
- Do not change Admin Regression or Project Memory Enforcement semantics.
- Do not weaken any production/business-data safety gate.

The production watcher is observability, not a release gate. Its existing runtime is read-only and explicitly performs zero Production/business writes.

## Acceptance while hosted runner is unavailable
Static/local execution can validate repository-only gates, but must not be represented as GitHub CI. A green GitHub acceptance requires an actually allocated hosted runner. Do not rerun repeatedly while jobs continue to terminate before step 1.

After runner service/quota recovers:
1. Run Admin Regression at exact head.
2. Run Project Memory Enforcement at exact head.
3. Dispatch Rental Analytics Production Watch once.
4. Require normal step/log evidence; a job with zero steps is infrastructure failure and earns no acceptance credit.

## Safety
- production_writes = 0
- business_writes = 0
- Verifier requirements unchanged
- no self-hosted runner introduced
- no new credential surface introduced
- no production deployment requested by this recovery


## Zero-cost exhaustion mode

While GitHub-hosted private-repository runner capacity is exhausted, Admin Regression and Project Memory Enforcement are manual-dispatch only. This prevents every repository push from generating guaranteed pre-step failures and consuming CI queue/noise.

This is an explicit degraded CI mode, not a PASS:
- required repository logic is unchanged;
- no test command is removed;
- no safety assertion is weakened;
- production/business writes remain zero;
- Vercel preview/build evidence remains independent evidence only;
- a normal hosted-runner execution is still required before restoring automatic pull_request/push triggers.

Recovery procedure:
1. Manually dispatch Project Memory Enforcement once.
2. If it reaches step 1 and passes, manually dispatch Admin Regression.
3. Require both to pass with normal logs.
4. Restore automatic pull_request/push triggers in one reviewed change.
