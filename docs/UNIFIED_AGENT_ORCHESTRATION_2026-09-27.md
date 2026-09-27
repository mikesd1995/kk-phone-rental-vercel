# KK Unified Agent Orchestration — 2026-09-27

## Objective

Make agent use explicit, measurable and fail-closed across KK workflows without pretending that a contract-only module is already a live worker.

## Registry truth model

Every agent exposes a runtime state:

- `LIVE_GATEWAY` — actively invoked through the production Agent Gateway.
- `LIVE_AUDIT_AND_CALLABLE` — already used by an existing audit path and callable through Gateway.
- `CALLABLE` / `CALLABLE_AUDIT_ONLY` — real code path is callable, but it is not an autonomous scheduled worker.
- `CONTROLLED_UAT_OR_CALLABLE_WHEN_ENABLED` — bounded advisory integration only.
- `WITNESS_ONLY_NOT_SCANNING` — current Scanner external endpoint proves the clock/witness path, not event discovery.

This prevents “file exists = agent is live” reporting.

## Unified routes

| task/intent | required now | downstream | runtime |
|---|---|---|---|
| direct_rental_x | Content Strategy + Content Agent | — | LIVE |
| content_draft | Content Strategy + Content Agent | — | LIVE |
| source_watch_check | Discovery Source Watch | Scanner + Verifier | CALLABLE |
| verifier_no_drop_audit | Event Verifier | — | CALLABLE AUDIT |
| canary_audit | Canary Safety | — | CALLABLE + CLI |
| reliability_audit | Reliability Learning | — | LIVE AUDIT + CALLABLE |
| hf_event_assist | HF Event Assist | Event Verifier | CONTROLLED |
| scan_event | Source Watch + Discovery Scanner | Event Verifier | BLOCKED: full worker not wired |
| verify_event | Event Verifier | — | BLOCKED: final commit worker not wired |

## Gateway behavior

`agentGateway` accepts either a normal content request with `message` or an operational request with `task_type`.

Callable operational tasks execute the real module, validate required-agent coverage, persist invocation evidence, then return the result.

If persistent invocation evidence fails, the operational result is suppressed.

Routes whose runtime does not really exist return `BLOCKED_RUNTIME_NOT_AVAILABLE` and record that gap instead of pretending the agent ran.

## Existing workflow integration

- `scripts/kk-system-audit.js` records `reliability_audit` invocation evidence whenever Reliability Learning runs.
- `scripts/audit-canary-snapshot.js` records `canary_audit` invocation evidence.
- `scripts/audit-verifier-no-drop.js` is the canonical CLI for Verifier no-drop audit and records evidence.
- Source Watch, Verifier audit, Canary audit, Reliability audit and HF assist are callable through the same production Agent Gateway.
- Content remains owner-review-required and zero-publish.

## Health/readback

`agentGatewayHealth` returns:

- Registry V2 runtime truth;
- ledger configuration;
- last 100 invocation coverage summary;
- complete vs blocked counts and coverage percentage by intent;
- known runtime gaps.

## Safety

No route added here can write event truth, pricing, booking, inventory, publish X content, change Scanner/Verifier schedules, change policy, or turn HF into authority.

All invocation rows remain `production_writes=0` and `publishes=0`.

## Remaining hard gaps

1. Full event discovery is not a live repo worker today. The external Scanner endpoint is witness-only.
2. Final governed Verifier commit is not exposed through Agent Gateway; only no-drop audit is.
3. ChatGPT cannot be forced across every independent chat until this private Gateway is installed as a callable ChatGPT connector/tool.

These remain visible as blocked routes, not hidden technical debt.

## Supabase migration applied

Production runtime-ledger project received:

- `20260927025019_agent_invocation_ledger_unified_routes_v2`

Verified after migration:

```
anon SELECT             false
authenticated SELECT    false
service_role SELECT     true
service_role INSERT     true
service_role UPDATE     false
service_role DELETE     false
owner-review forced-true constraint removed
production_writes=0 constraint preserved
publishes=0 constraint preserved
rows at verification    0
```

The owner-review constraint was intentionally relaxed only because internal read-only audits do not require owner approval. Public content still sets `owner_review_required=true` in the Content route.
