# Make Free-plan credit exhaustion — Admin write bridge incident

Date: 2026-09-20 (Asia/Bangkok)
Organization: `KK Phone Auto`
Make team: `My Team` (2671496)
Admin bridge scenario: `05_KK_ADMIN_WRITE_BRIDGE` (6336390)

## Executive finding

The remaining Admin write-bridge outage is caused by **Make Free-plan credit exhaustion**, not by Vercel routing, Google OAuth, webhook schema, Make module wiring, Apps Script, or Google Sheet data integrity.

The Make bridge is intentionally kept fail-closed until runtime credits are available and bridge acceptance passes.

## Account evidence

Owner-account Make notification email received 2026-09-15 states:

- organization `KK Phone Auto` used all credits included in the current Free plan;
- scenarios are paused for the organization.

A preceding warning states that between 2026-09-10 00:55 and 2026-09-14 23:29 the organization had consumed 94% of its available credits.

The previous usage window warning covered 2026-08-10 00:55 onward. The observed account windows therefore begin around the 10th of each month. The next free-plan refresh is expected around 2026-10-10, subject to Make account state.

## Live runtime evidence

Scenario 6336390:

- `isActive=true`
- status = `paused`
- scheduling = `immediately`
- Google connection status = `ok`
- incomplete executions = 0
- webhook payload schema learned successfully
- signed health deliveries accepted by webhook but queued instead of executed

Other scenarios visible in the same organization also report paused.

Scenario-level remediation already attempted without changing business data:

1. deactivate / reactivate scenario;
2. explicitly reset scheduling to `immediately`;
3. learn the webhook payload from a production read-only health probe;
4. confirm Google OAuth connection health;
5. confirm no stored incomplete execution blocks sequential processing.

The state remained paused, matching the account credit-exhaustion notification.

## Vercel / Core status

Production deployment:
- `dpl_D2u3cBqDyZVb1a92ig2juK1iDQC3`
- main commit `b7307d811e1cce2a6a4ddff9af97575dbcbf4cf2`
- READY

Production smoke:
- storefront: healthy
- Admin login: healthy
- Admin auth gate: healthy
- Make bridge transport reaches webhook
- bridge application health remains fail-closed because Make does not execute queued requests

Latest Core identity readback during recovery:
- events: no missing/duplicate required IDs
- bookings: no missing/duplicate booking IDs
- assets: no missing/duplicate asset IDs

## Safety decisions

No action in this incident may silently convert an accepted webhook request into a claimed successful Admin write.

Therefore:

- real Admin writes remain disabled while the bridge is paused;
- no synthetic booking/customer/event/price/asset is created for acceptance;
- no Make upgrade, extra-credit purchase, card action, or billing change is performed automatically;
- no Vercel API key/PIN/secret is exposed or changed;
- no old Apps Script V10 / repo 9_5_8 source is deployed over the historical 9_5_9 production lineage;
- queued bridge requests are read-only health probes.

## Recovery paths

### A — no-cost path

Wait for Make Free-plan credits to refresh. Based on two observed cycles, expected around 2026-10-10.

Then:

1. confirm scenario 6336390 executes rather than queues;
2. require `/api/kk-admin-make-health` = HTTP 200;
3. confirm Google OAuth readback;
4. discard/neutralize stale queued health envelopes before write acceptance if Make retains them;
5. run an idempotent/no-op write acceptance against a controlled non-customer target;
6. exact Google Sheet readback;
7. enable only actions whose write planners and guard tests pass;
8. run post-enable 5xx and identity-integrity scan.

### B — immediate paid path

Organization owner upgrades Make or obtains additional credits. This is a financial/billing action and requires explicit owner action. After credits become available, follow the same technical acceptance gates as path A.

### C — independent transport

Provision a separate authenticated Google writer, e.g.:
- verified service account with write access and limited scope, or
- recovered/controlled Apps Script deployment.

Current public GViz fallback is deliberately read-only and is not a substitute for an authenticated writer.

## Credit-efficiency hardening

Before the next Make runtime window, review bridge failure handling so stale/invalid signed requests fail closed without causing an instant-trigger scenario to pause. Also minimize unnecessary Make modules/operations while preserving precondition and readback guarantees.

## Audit references

- PR #92: guarded Make Admin write transport foundation
- PR #95: production acceptance deployment gate
- Issue #9: Apps Script/write-path recovery
- Issue #49: final production completion gate

This document is an incident/audit record only. It does not enable production writes.
