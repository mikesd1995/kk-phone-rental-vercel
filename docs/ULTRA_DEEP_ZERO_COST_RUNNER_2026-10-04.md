# Ultra Deep Zero-Cost Runner

Purpose: execute the existing governed Ultra Deep Full Loop without GitHub-hosted runner minutes.

## Required repository runner labels
- self-hosted
- linux
- x64
- kk-ultra-deep

## Required local tools
- git
- Node.js 20+
- npm
- Python 3
- curl

Register the runner at repository scope using GitHub Settings > Actions > Runners > New self-hosted runner. Use GitHub's generated registration command; registration tokens expire after one hour. Add custom label `kk-ultra-deep`.

Do not store the registration token, Vercel token, GitHub OIDC token, or Admin PIN in this repository.

## Execution
Use workflow_dispatch for `Ultra Deep Full Loop Direct`:
- month: target YYYY-MM
- confirm: RUN_ULTRA_DEEP_FULL_LOOP
- zero_cost_self_hosted: true

The workflow fails closed unless it is actually running on a self-hosted runner and required tools exist. Existing owner authorization, OIDC, discovery FULL, commercial, production COMPLETE, tombstone, booking-price-lock and exact-readback gates remain authoritative.

## Acceptance
A run is COMPLETE only when the production COMPLETE gate passes and exact storefront readback is present. A queued job without an online `kk-ultra-deep` runner is not acceptance.


---

# Ultra Deep Full Loop — Cross-Chat Handoff (2026-10-04)

## Objective
Complete October 2026 Ultra Deep Full Loop end-to-end: discovery -> verification -> competitor pricing -> verified poster -> tombstone/duplicate guard -> governed production write -> exact storefront readback.

## Locked business/safety rules
- Never recreate hidden/tombstoned events.
- Dates/events with existing bookings: do not re-discover unnecessarily and do not reprice booked events.
- Unbooked events: use fresh exact-event competitor median when available; otherwise use the governed pricing fallback.
- New events require exact-event evidence, safe price evidence/fallback, and verified official artwork before publish.
- Scanner/discovery stages remain zero-write.
- Production mutations only through governed Admin/OIDC path with exact readback.
- Full Loop is COMPLETE only when production COMPLETE gate passes and storefront readback is verified.

## Repairs completed

### PR #597 — V27 command identity contract
Merged SHA: `ebab93a4b438f496be3fda9568ca3d1201b1fd5a`

Confirmed root cause of historical `REQUEST_ID_INVALID`:
- V27 admin write control validates `request_id` before `commandClaim` / `commandComplete`.
- `api/kk-scanner-dispatch.js` supplied only `command_id`.

Repair:
- command claim/complete now send deterministic `request_id = ultra-deep-command:<command UUID>`.
- OIDC and write guards remain intact.
- No booking/event/price/inventory mutation was part of this repair.

### Historical reconciliation blocker now covered
Older Full Loop run 37030462536 reached discovery with:
- 284 candidates
- 33 reference candidates
- one reconciliation gap
- production writes = 0

The sole reconciliation gap was false event:
`Home - Bangkok Festivals`, inferred date 2026-10-05, source `https://bangkokfestivals.com/`.

Current main contains a regression rule rejecting this generic reference page as `GENERIC_REFERENCE_PAGE`. Do not reopen this as an unresolved discovery defect unless a fresh run reproduces it.

### PR #600 — zero-cost execution path
Merged SHA: `0bb7e672bd25a8ef978d3709d70d128ba4caa2ec`

Added opt-in workflow_dispatch input:
`zero_cost_self_hosted: true`

When enabled, Full Loop targets:
- self-hosted
- linux
- x64
- kk-ultra-deep

Default hosted behavior remains unchanged.

### PR #601 — zero-cost runner hardening
Merged SHA: `df9e24cfc8dbb356fa821be85d4ea6ca2cf0d424`

Added fail-closed preflight requiring:
- actual self-hosted runner environment
- git
- Node/npm
- Python 3
- curl

Added runbook:
`docs/ULTRA_DEEP_ZERO_COST_RUNNER_2026-10-04.md`

No OIDC, owner authorization, discovery FULL, commercial, production COMPLETE, tombstone, booking lock, or exact-readback gate was weakened.

## Infrastructure findings
- Recent GitHub-hosted Full Loop attempts can fail before runner allocation (job has no steps/log blob).
- On merge SHA, relevant Actions jobs were scheduler-skipped; do not misdiagnose this as Ultra Deep runtime failure.
- `ubuntu-slim` is not the chosen solution: private-repo execution remains metered and the runner has a 15-minute hard limit.
- Make A contains `05_KK_ADMIN_WRITE_BRIDGE`, but it is paused/quarantined after free-plan credit exhaustion. Do not move Full Loop there as the zero-cost architecture.
- TinyFish browser fallback required paid wallet balance; do not use it for the zero-cost route.
- Vercel fixed preview observed READY: `dpl_8feL9S47j8GaxiSWeX6cUHtFVQFr`.
- Production was still observed on older SHA `12c7b0f...` during this repair sequence. Re-check before any execution; do not assume this remains current.
- The connected GitHub integration in the repair session did not expose/allow Actions runner registration/admin endpoints. Repository code is ready for self-hosted execution, but a real machine still must be registered with label `kk-ultra-deep`.

## Do not do
- Do not create V28/V29 or another scanner/control plane just to bypass runner infrastructure.
- Do not make the repository public merely to obtain free hosted minutes.
- Do not repeatedly rerun a hosted workflow that dies before runner allocation.
- Do not claim Full Loop COMPLETE from discovery-only, preview READY, or a successful code merge.
- Do not issue production COMMIT before governed acceptance requirements are satisfied.

## Resume sequence in a new chat
1. Read this handoff and Issue #368 before changing architecture.
2. Re-check current `main` SHA and current production deployment SHA.
3. Confirm an online repository self-hosted runner with labels `self-hosted, linux, x64, kk-ultra-deep`.
4. Dispatch `Ultra Deep Full Loop Direct` with:
   - month: `2026-10`
   - confirm: `RUN_ULTRA_DEEP_FULL_LOOP`
   - zero_cost_self_hosted: `true`
5. Require self-hosted preflight PASS.
6. Require discovery FULL and zero discovery writes.
7. Require verifier + commercial gate.
8. Verify compatible production executor/OIDC.
9. Execute governed production Full Loop.
10. Require production COMPLETE.
11. Verify exact storefront/SOT readback.
12. Record created/repriced/locked/tombstoned/date-venue/poster/no-change counts and production write count in Issue #368.

## Current acceptance status at handoff
- Code repair: DONE
- Zero-cost workflow path: DONE
- Zero-cost preflight/runbook: DONE
- Physical self-hosted runner registered/online: NOT PROVEN
- Fresh October Full Loop after repairs: NOT RUN
- Production COMPLETE: NOT PROVEN
- Full Loop production writes from this repair sequence: 0

Do not mark the project complete until the remaining acceptance steps pass.


## Fresh continuation evidence — 2026-10-04
- Repository remains private and authenticated connector reports owner/admin permission.
- Current production deployment re-check: `dpl_8xqonqLFnB84QN2WqwELKaaYjW9V`, production SHA `12c7b0f3fbd0d4cf2e0b992c1bbbeca0cfccce88`.
- Current repo/main history is ahead of production; the cross-chat handoff commit is `1104dab3f94b7959d996e1cbc1b49297fb842469`.
- Latest Actions activity after the handoff is still scheduler-skipped before job execution.
- Repository search found no pre-existing actions-runner bootstrap, registration script, runner service, or alternate self-hosted runner definition. The only self-hosted routing is the governed `kk-ultra-deep` path added in PR #600/#601.
- Therefore there is no hidden zero-cost compute substrate already provisioned in this repository to execute the job.
- GitHub documentation confirms self-hosted Actions jobs have no billable Actions minutes, but the runner host itself must exist, be registered, and be online. Registration requires a time-limited token and access to the host machine.
- Do not dispatch `zero_cost_self_hosted=true` until an online runner with labels `self-hosted, linux, x64, kk-ultra-deep` is visible; otherwise the job can remain queued and provides no acceptance evidence.
