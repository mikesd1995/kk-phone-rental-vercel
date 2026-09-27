# KK Agent Invocation Gateway P0 — 2026-09-27

## Why this exists

KK already had Content Strategy and Content Agent code, but a direct X-post request could still bypass them because the request router was a library plus tests, not a single enforced chat-facing entrypoint.

P0 adds one enforced entrypoint with persistent invocation evidence.

## Added

- `server/kk-agent-registry.js`
  - canonical catalog of current KK agents/skills;
  - maps chat content intents to mandatory agents;
  - validates required-vs-invoked coverage.

- `server/kk-agent-gateway.js`
  - chat-facing orchestration gate;
  - direct rental and content draft requests must pass Content Strategy + Content Agent;
  - direct rental still fails closed on verified event/pricing/inventory requirements;
  - a blocked request does not receive the generation prompt.

- `server/kk-agent-invocation-ledger.js`
  - persists non-business invocation evidence to Supabase;
  - stores hashes and routing metadata, not raw user copy;
  - reuses the existing server-side Supabase secret/project binding;
  - no pricing, booking, inventory, customer, event, or Machine-SOT writes.

- `api/kk-agent-gateway.js`
  - admin-authenticated HTTP enforcement point;
  - GET returns registry/ledger health without secrets;
  - POST routes a content request through the gateway;
  - ledger unavailable => HTTP 503 and blocked output;
  - content/business truth gate blocked => HTTP 409.

- `tests/kk-agent-gateway.test.js`
  - required-agent enforcement;
  - persistent-ledger fail-closed behavior;
  - commercial truth fail-closed behavior;
  - deliberate bypass simulation;
  - no raw prompt/input stored in invocation evidence.

- `scripts/kk-agent-gateway-dry-run.js`
  - zero-write smoke test with an in-memory ledger.

## Persistent table

`public.kk_agent_invocations` is an audit-only table.

Security requirements:

- RLS enabled;
- anon/authenticated privileges revoked;
- service_role receives only SELECT + INSERT;
- production_writes and publishes are constrained to zero;
- no raw message or raw business input is stored.

## Invariants

Every successful chat-content gateway result must satisfy:

```
required_agents subset_of invoked_agents
persistent_invocation_evidence = written
owner_review_required = true
production_writes = 0
publishes = 0
```

For direct rental:

```
verified event
+ verified current pricing
+ explicit price display
+ confirmed inventory
= required before READY_FOR_OWNER_REVIEW
```

Any missing condition is BLOCKED.

## What this fixes

Before:

```
chat request
  -> could call ad-hoc drafting
  -> Content Agent might be bypassed
```

After:

```
chat/tool caller
  -> /api/kk-agent-gateway
  -> registry
  -> Content Strategy
  -> Content Agent
  -> invocation coverage check
  -> persistent ledger
  -> owner review
```

## Important boundary

This repository change creates the enforcement API and durable evidence layer. It does **not** by itself install that private API as a ChatGPT custom connector/plugin. A ChatGPT surface that can directly call this endpoint still needs an explicit connector/tool integration. Until that connector exists, the repository can enforce callers that use the gateway, but cannot technically force every independent ChatGPT conversation to call a private repo function.

Do not describe this P0 as full cross-chat ChatGPT enforcement until that connector is installed and verified.

## Production safety

- no Machine-SOT mutation;
- no event/pricing/booking/inventory/customer mutation;
- no X auto-publish;
- no auto-spend;
- no Scanner/Verifier schedule change;
- no HF authority expansion.
