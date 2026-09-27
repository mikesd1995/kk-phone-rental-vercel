# KK Agent Invocation Gateway P0 — 2026-09-27

## Problem fixed

KK already had Content Strategy and Content Agent code, but a direct X-post request could bypass them because the request router was a library plus tests, not an enforced request entrypoint.

P0 adds a fail-closed orchestration gate with persistent invocation evidence while **reusing an existing Vercel Function surface** so the Hobby/API function budget does not increase.

## Added

- `server/kk-agent-registry.js`
  - canonical catalog of current KK agents/skills;
  - maps chat content intents to mandatory agents;
  - validates required-vs-invoked coverage.

- `server/kk-agent-gateway.js`
  - chat-facing orchestration gate;
  - direct rental and content draft requests must pass Content Strategy + Content Agent;
  - direct rental still fails closed on verified event/pricing/inventory requirements;
  - blocked requests do not receive a generation prompt.

- `server/kk-agent-invocation-ledger.js`
  - persists non-business invocation evidence to Supabase;
  - stores hashes and routing metadata, not raw user copy;
  - reuses the existing server-side Supabase secret/project binding;
  - no pricing, booking, inventory, customer, event, or Machine-SOT writes.

- Existing `api/kk-admin-guard.js`
  - action `agentGatewayHealth`: authenticated registry + ledger health;
  - action `agentGateway`: authenticated enforced route;
  - no additional Vercel API function was added.

Request shape:

```json
{
  "action": "agentGateway",
  "request": {
    "message": "ขอโพสปล่อยเช่างานนี้บน X",
    "input": {
      "event": "...",
      "verified_event": true,
      "verified_pricing": true,
      "price_display": "...",
      "inventory_available": true
    }
  }
}
```

- `tests/kk-agent-gateway.test.js`
  - required-agent enforcement;
  - persistent-ledger fail-closed behavior;
  - commercial truth fail-closed behavior;
  - deliberate bypass simulation;
  - no raw prompt/input stored in invocation evidence;
  - ledger rows cannot claim production writes or publishing.

- `scripts/kk-agent-gateway-dry-run.js`
  - zero-write smoke test with an in-memory ledger.

## Fail-closed invariants

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

If the persistent invocation ledger is unavailable, the gateway returns BLOCKED and removes the generation prompt.

## Persistent table

`public.kk_agent_invocations` is audit-only.

Security contract:

- RLS enabled;
- anon/authenticated access denied and privileges revoked;
- service_role receives only SELECT + INSERT;
- production_writes and publishes are constrained to zero;
- raw chat message and raw business input are not stored.

## Production safety

- no Machine-SOT mutation;
- no event/pricing/booking/inventory/customer mutation;
- no X auto-publish;
- no auto-spend;
- no Scanner/Verifier schedule change;
- no HF authority expansion;
- no additional Vercel Function surface.

## Important boundary

This repository change creates an enforceable private HTTP entrypoint, but it does **not** automatically install that entrypoint as a ChatGPT custom connector/plugin. A ChatGPT surface still needs an explicit connector/tool integration before every independent chat can be technically forced through this endpoint.

Do not describe this as full cross-chat ChatGPT enforcement until that connector is installed and verified.

## Applied Supabase migrations

Production runtime-ledger project: `kk-phone-rental-runtime-ledger`.

- `20260927022226_agent_invocation_ledger_v1.sql`
- `20260927022311_agent_invocation_ledger_least_privilege_v1.sql`

The second migration is intentional. Verification after the first migration showed the existing Supabase project default privileges still left `service_role` with UPDATE/DELETE. The follow-up explicitly revoked all service-role privileges and re-granted only SELECT + INSERT.

Verified final privileges:

```
anon SELECT             false
authenticated SELECT    false
service_role SELECT     true
service_role INSERT     true
service_role UPDATE     false
service_role DELETE     false
RLS                     true
deny-public policy      present
rows after migration    0
```
