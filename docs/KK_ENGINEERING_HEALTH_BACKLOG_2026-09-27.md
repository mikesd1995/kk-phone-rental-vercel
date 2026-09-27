# KK Engineering Health Backlog — Read-only Audit — 2026-09-27

## Scope

This is a planning artifact only. No refactor is authorized by this document.

The audit used current-main repository structure and dependency references while Production is intentionally frozen behind P0 acceptance gates.

## Large-file hotspots

Current-main source-size observations:

| File | Approx bytes | Interpretation |
|---|---:|---|
| admin/admin.js | 224,291 | Major maintainability hotspot; highest-priority modularization candidate after P0 |
| script.js | 89,148 | Storefront hotspot; candidate for feature-boundary extraction |
| api/kk-admin-snapshot-v5.js | 37,660 | Still required by v6 wrapper; not dead code |
| api/kk-admin-guard.js | 24,546 | Sensitive auth/orchestration surface; refactor only with strong regression coverage |
| server/admin-direct-writer-phase1.js | 24,301 | Business-write boundary; avoid opportunistic refactor |
| server/admin-proxy.js | 21,196 | Upstream resilience boundary |
| server/rental-dashboard-core.js | 19,518 | Revenue/business analytics contract |
| server/kk-operating-partner.js | 12,770 | Currently moderate; do not split prematurely |

File size alone is not proof of a defect. It identifies review/refactor candidates only.

## Important dependency findings

### Admin snapshot v5/v6

api/kk-admin-snapshot-v6.js is explicitly a thin safety/auth wrapper over v5 and imports v5 directly.

Therefore:
- v5 is not currently removable;
- any consolidation must preserve the v6 auth/classifier behavior and v5 runtime contract;
- no cleanup should happen before the Production Baseline.

### Rental dashboard v5/v6/core

api/kk-rental-dashboard-v6.js imports:
- kk-rental-dashboard-v5;
- rental-dashboard-core;
- private Google Sheets reader;
- CRM freshness;
- CRM reconciliation.

Therefore legacy-looking v5/core code remains part of the active compatibility/fallback architecture.

Do not remove or merge these layers based only on version naming.

## Post-P0 engineering priorities

### E1 — Admin modularization study

State: PLAN_ONLY

After a stable Production Baseline:
1. build symbol/dependency map for admin/admin.js;
2. identify cohesive boundaries such as event controls, booking controls, pricing/override, diagnostics and rendering;
3. move one boundary at a time behind existing tests;
4. compare behavior before/after;
5. avoid a rewrite.

### E2 — Storefront modularization study

State: PLAN_ONLY

For script.js:
- isolate search/filter logic;
- event-card/detail rendering;
- booking CTA/interaction;
- data/cache handling;
- shared utilities.

Do not combine this with UX changes.

### E3 — Compatibility-layer retirement criteria

State: DEFERRED

Before considering removal of any v5 file require:
- zero runtime imports from current v6;
- zero Vercel function/rewrite requirement;
- production baseline proving new path;
- rollback strategy;
- full regression.

### E4 — Operating Partner growth

State: PHASE2_PREP

Prefer adding bounded adapters around existing authoritative modules instead of copying their business logic into Operating Partner.

## Safety conclusion

There is no evidence from this read-only audit that a large refactor is needed before P0 closure.

The highest-value action remains:
- finish natural Scanner/Verifier acceptance;
- deploy exact current main;
- record Production Baseline;
- then perform incremental modularization and Phase 2 adapter work.
