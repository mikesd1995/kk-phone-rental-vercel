# Resource Efficiency Post-Merge Acceptance — 2026-10-01

## Scope
Post-merge evidence for PR #413, `Optimize Vercel and CI resource efficiency`.

## Merge evidence
- PR #413 merged into `main`.
- Exact merge commit: `478691e2427d47f90f2ad9c48f66e077c511627a`.
- Pre-merge Admin Regression #1373 completed successfully on exact PR head `46d47fe6eaedb0e39cd23f75ec04aed15575bb3e`.

## Read-back from main
Verified after merge:
- `scripts/vercel-ignore-build.js` no longer forces every `main` commit to deploy.
- Known docs/tests/workflow-only diffs are eligible for `SAFE_PREVIEW_ONLY_CHANGE`.
- Missing SHA, empty/unknown diff, unknown branch, runtime/config/API/UI changes continue fail-safe by building.
- Rental Analytics Production Watch remains push-triggered on `main`; fallback schedule is `17 */6 * * *`.
- Rental Analytics changed-state artifact retention is 7 days.
- HF Event Assist UAT uses `cancel-in-progress: true` and 7-day artifact retention.
- Discovery Crawl4AI UAT artifact retention is 7 days.

## External constraint observed
The merge commit's Vercel status reports the existing build-rate-limit failure. This is an external quota condition, not evidence of a code regression. No claim is made that the quota has reset.

## Safety
- Production/business writes performed by this optimization: 0.
- No booking, pricing, inventory, event, customer, or revenue data was modified.
- Existing fail-closed deployment behavior remains for uncertain/runtime-impacting changes.

## Result
Implementation is merged and read back from `main`. The resource-efficiency controls are active in repository configuration. Vercel quota recovery remains externally time-bound and is intentionally not bypassed.
