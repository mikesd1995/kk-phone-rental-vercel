# KK OpenAI Platform Agent Layer v1 — 2026-10-02

Status: IMPLEMENTED / ENV-GATED / ZERO PRODUCTION WRITES

## Goal

Add a safe OpenAI Responses API reasoning layer to KK Phone Rental without making a model authoritative for pricing, booking, inventory, event truth, deployment, or customer messaging.

This implementation starts with the three highest-value surfaces:

1. Storefront visual AI reviewer layered on deterministic Design Council evidence.
2. Ultra Deep Scan reasoning assist before the governed Verifier.
3. Unified Inbox structured extraction + reply draft, with owner review and no send authority.

## Architecture

```
existing deterministic evidence
        |
        v
Agent Gateway / Task Router
        |
        +-- storefront_ai_review
        |      -> deterministic 7-agent Storefront Design Council
        |      -> kk-openai-storefront-reviewer
        |      -> Responses API + strict JSON Schema
        |      -> read-only findings
        |
        +-- ultra_deep_ai_reasoning
        |      -> deterministic Ultra Deep coverage/gap plan
        |      -> kk-openai-discovery-reasoner
        |      -> Responses API + strict JSON Schema
        |      -> non-authoritative advisory
        |      -> governed Verifier remains mandatory
        |
        +-- unified_inbox_ai_draft
               -> kk-openai-inbox-drafter
               -> separate customer-data feature gate
               -> extraction + draft only
               -> owner review required
               -> send_authorized=false
```

## Runtime files

- `server/kk-openai-platform.js`
  - minimal Node 20 fetch-based Responses API client;
  - no new package dependency;
  - `store:false`;
  - strict `text.format.type=json_schema`;
  - safe provider/request metadata only;
  - no raw prompts/customer content returned in error objects;
  - timeout and provider failures fail closed.

- `server/kk-openai-agent-adapters.js`
  - storefront multimodal reviewer;
  - discovery reasoning assist;
  - Unified Inbox extraction + reply draft;
  - local safety validation after model output, even when the provider claims schema compliance.

## Model routing

Defaults are cost-aware and overrideable by server environment:

- Storefront visual review: `gpt-6-sol`
- Ultra Deep reasoning: `gpt-6-luna`
- Unified Inbox drafting/extraction: `gpt-6-luna`

Overrides:

- `KK_OPENAI_MODEL_STOREFRONT`
- `KK_OPENAI_MODEL_DISCOVERY`
- `KK_OPENAI_MODEL_INBOX`
- `KK_OPENAI_MODEL_DEFAULT`

Astra is intentionally not the default for high-volume runtime work. It can be selected by an explicit model override for difficult cases.

## Activation gates

Nothing calls OpenAI by default.

Required for any OpenAI request:

```
KK_OPENAI_PLATFORM_ENABLED=true
OPENAI_API_KEY=<server-only secret>
```

Unified Inbox has an additional explicit customer-data gate:

```
KK_OPENAI_ALLOW_CUSTOMER_DATA=true
```

Without that second flag, Inbox AI returns `BLOCKED_CUSTOMER_DATA_NOT_AUTHORIZED` before any network call.

Optional:

```
KK_OPENAI_TIMEOUT_MS=30000
```

Do not put `OPENAI_API_KEY` in Git, browser code, client-side environment variables, screenshots, chat logs, or public error output.

The runtime deliberately does not support an alternate OpenAI base URL. This prevents a misconfigured environment variable from forwarding the API key to a third-party proxy.

## Authority boundaries

### Storefront reviewer

May:
- inspect supplied screenshots, page text, metrics, and deterministic council evidence;
- return visual findings and acceptance tests.

May not:
- merge;
- deploy;
- publish;
- change pricing/booking/inventory/event truth;
- replace owner visual acceptance.

### Ultra Deep reasoning

May:
- classify event type;
- score rental fit as advisory;
- flag duplicate risk;
- identify evidence gaps;
- prepare Verifier questions.

May not:
- become authoritative;
- bypass deterministic dedup;
- bypass Verifier;
- write production truth;
- write price/booking/inventory.

Model output is rejected if it claims authority, removes the Verifier requirement, or reports non-zero production writes.

### Unified Inbox

May:
- extract structured fields from supplied customer text;
- summarize;
- draft a reply.

May not:
- send a message;
- create/update a booking;
- write a price;
- write inventory;
- merge LINE/X identities;
- claim owner approval.

Model output is rejected unless:
- `owner_review_required=true`;
- `send_authorized=false`;
- `booking_write_authorized=false`;
- `production_writes=0`.

## Agent Registry / Gateway

Registry bumped to `KK_AGENT_REGISTRY_V29`.

Registered agents:

- `kk-openai-storefront-reviewer`
- `kk-openai-discovery-reasoner`
- `kk-openai-inbox-drafter`

Registered routes:

- `storefront_ai_review` — invokes the existing seven deterministic Storefront Design Council agents plus the OpenAI reviewer in one hybrid route.
- `ultra_deep_ai_reasoning` — invokes deterministic source-watch/scanner planning plus the OpenAI discovery reasoner, with Verifier still downstream.
- `unified_inbox_ai_draft`

All routes require persistent invocation evidence under the existing Agent Gateway contract.

The existing authenticated Admin guard already exposes the Agent Gateway action, so no new unauthenticated public AI endpoint was added. When this branch is merged and server-side environment gates are enabled, authorized Admin calls can invoke these task types through the existing guarded gateway while invocation records persist hashes instead of raw prompts/customer messages.


## Storefront Visual QA wiring

The existing screenshot acceptance harness now always records the full seven-agent deterministic Design Council for every acceptance viewport. When `KK_OPENAI_PLATFORM_ENABLED=true`, it additionally sends final JPEG screenshot evidence for selected viewports to `kk-openai-storefront-reviewer` through the Responses API. Default AI-review widths are `390,1024` and can be narrowed/expanded with `KK_OPENAI_STOREFRONT_AI_VIEWPORTS` using widths already present in the deterministic policy.

When the OpenAI feature flag is enabled, a missing key, provider failure, malformed output, or unresolved model P0/P1 finding blocks technical visual acceptance. When the flag is disabled, the pipeline remains zero-cost and continues using the existing deterministic acceptance path. Owner visual acceptance remains a separate mandatory gate.

## Dry-run

A zero-write manual harness is available:

```bash
npm run openai:agents:dry-run
```

With the platform disabled, it proves the no-network fallback. With staging environment variables enabled, it exercises the hybrid storefront and discovery routes with synthetic evidence. Inbox remains skipped unless the separate customer-data flag is explicitly enabled.

## Tests

`tests/kk-openai-platform.test.js` covers:

- disabled-by-default zero-network behavior;
- missing-key fail closed;
- separate Inbox customer-data authorization;
- Responses API strict JSON Schema request shape;
- HTTPS/data-image allowlist and rejection of `file://` image paths;
- cost-aware model routing;
- discovery non-authoritative/Verifier invariants;
- local rejection of unsafe model output;
- Inbox draft-only invariants;
- provider 429 fail-closed behavior without raw input leakage;
- registered route/runtime proof.

Existing agent registry contract test is updated to V29.

## Rollout plan

### Phase A — merge code only

Safe without an API key. All new runtime paths remain disabled and zero-write.

### Phase B — staging API enablement

Configure a restricted server-side API project/key and enable `KK_OPENAI_PLATFORM_ENABLED=true` in staging only.

Run:
1. storefront screenshot review against known accepted/rejected screenshots;
2. Ultra Deep benchmark against known events/misses;
3. Inbox synthetic conversations only.

Measure useful finding rate, false positives, token usage, and latency.

### Phase C — selective production advisory

Only after staging acceptance:
- allow storefront/discovery advisory calls;
- keep all existing deterministic and owner gates;
- leave Inbox customer data disabled until explicit privacy/operations approval.

### Phase D — Inbox draft pilot

Enable `KK_OPENAI_ALLOW_CUSTOMER_DATA=true` only after the Unified Inbox durable branch is accepted and operator workflow is ready. Outbound remains owner-reviewed; no auto-send is introduced by this layer.

## Non-changes

This implementation does not:
- configure an API key;
- change Vercel production environment;
- call the OpenAI API in CI;
- add a package dependency;
- modify pricing;
- modify bookings;
- modify inventory;
- write Machine SOT;
- alter Scanner/Verifier write authority;
- merge the existing Unified Inbox PR;
- enable LINE/X outbound send;
- deploy or promote production.

## References used for implementation

OpenAI current API documentation was checked on 2026-10-02. The independent review corrected the storefront default model from an invalid `gpt-6.1-sol` draft identifier to the documented `gpt-6-sol` model ID and removed the custom API-base override entirely so `OPENAI_API_KEY` can only be sent to the official OpenAI API origin:

- Responses API for direct model requests;
- Structured Outputs via `text.format` with strict JSON Schema;
- tool/function architecture remains optional for later phases.

The v1 layer deliberately sends only supplied evidence and does not enable OpenAI web-search/tool calls, keeping cost and authority boundaries narrow.
