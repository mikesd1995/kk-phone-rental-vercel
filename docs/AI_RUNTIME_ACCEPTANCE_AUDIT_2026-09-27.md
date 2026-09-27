# KK AI Runtime Acceptance & Learning Audit — 2026-09-27

## Scope
Live read-only audit of GitHub main/CI, Vercel production/runtime observability, Supabase agent/decision ledgers, and Hugging Face Jobs. This record does not mutate business truth, pricing, bookings, inventory, Machine SOT, Scanner/Verifier schedules, or provider sends.

## Evidence snapshot
- Accepted GitHub main at audit start: `e45f800c0c3007b2eb730d9c632f1743da9fee15`.
- GitHub Admin Regression for that SHA: PASS.
- GitHub Rental Analytics Production Watch for that SHA: PASS.
- Vercel status for exact main: `Deployment rate limited — retry in 24 hours.`
- Current READY production artifact remains commit `1946b836a241e30f2209ed7265ba669769c9f198`.
- Vercel production Agent Runs, 30-day window: 0.
- Supabase `kk_agent_invocations`: 0 rows at audit.
- Supabase `kk_decision_events`: 0 rows at audit.
- Hugging Face account authenticated as `Mikesd1995`.
- Hugging Face Jobs: 0 running / 0 historical jobs visible.
- Hugging Face scheduled jobs: 0 active / 0 historical schedules visible.

## Interpretation
The repository contains real governed agent code, routing, QA, scanner worker core, HF adapters, reliability memory, operating-partner logic and append-only ledgers. However, live evidence does not yet justify claiming full production AI utilization or outcome learning. The missing boundary is execution evidence, not another agent definition.

## Actions taken
1. Preserved current production because exact-main deployment is externally rate-limited.
2. Did not promote stale preview artifacts that omit later accepted main changes.
3. Did not create dummy commits or deployment loops.
4. Added reliability fingerprint `VERCEL_BUILD_RATE_LIMIT` with an external-capacity repair recipe and regression guards.
5. Kept HF disabled as authority; no HF job/schedule was created.
6. Kept Scanner/Verifier/Make authority unchanged.
7. Kept Operating Partner Phase 2 draft PR #231 unmerged.

## Acceptance gates after Vercel capacity returns
### A. Production alignment
- deploy exact accepted main SHA;
- verify production deployment metadata SHA equals accepted main;
- storefront smoke test;
- Admin smoke test;
- agentGatewayHealth readback.

### B. Agent invocation acceptance
Run one authenticated, non-publishing content request through `agentGateway` using verified event/pricing/inventory fixture data.
Required readback:
- status `READY_FOR_OWNER_REVIEW`;
- invoked agents include Marketing, Content Strategy, Content Agent, Content QA;
- `production_writes=0`;
- `publishes=0`;
- exactly one persisted `kk_agent_invocations` row for the acceptance correlation/invocation;
- no raw prompt/business input stored in the ledger.

Do not insert a synthetic ledger row directly. Evidence must be produced by the real gateway path.

### C. Decision-learning acceptance
After a real owner-reviewed recommendation exists:
- record RECOMMENDATION through the governed decision-feedback path;
- record OWNER_DECISION when the owner actually decides;
- record OUTCOME only from measured metrics;
- verify append-only readback from `kk_decision_events`;
- require enough outcomes before any strategy nudge;
- never auto-apply price, publish, booking, inventory, policy or Machine-SOT changes.

### D. Hugging Face shadow acceptance
Only after Scanner/provider execution is accepted:
- enable HF only in bounded shadow/UAT;
- classification/embedding/dedup remain non-authoritative;
- compare HF assist with verifier evidence;
- keep production writes/final truth mutation/provider sends at zero;
- do not create a competing recurring scanner.

## Known blockers
- P0 external: Vercel exact-main deployment rate limited.
- P0 evidence: production SHA behind accepted main.
- P1 evidence: agent invocation ledger has no real production invocation yet.
- P1 evidence: decision ledger has no real recommendation/outcome history yet.
- P1 Scanner: recurring public-web provider executor remains gated.
- P1 Verifier: final governed commit worker remains unavailable.
- P2 HF: integration exists but has no live job/scheduled-job evidence.

## Exit criteria
Do not describe the project as having production-learning AI until all are true:
1. exact-main production alignment is proven;
2. at least one real gateway invocation is persisted by the gateway itself;
3. at least one real owner decision and measured outcome are persisted through the governed decision path;
4. learning summary consumes that outcome without autonomous business mutation.

## Safety
All audit/remediation work in this change is advisory/configuration/documentation only. Production business writes = 0; publishes = 0; provider sends = 0; task mutations = 0.
