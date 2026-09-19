# Discovery Mesh Foundation — 2026-09-20

Branch: `discovery-mesh-foundation-20260920`  
Baseline main: `3a2cf65e943270e11f6c09cdacbf232fa67ef397`

## Objective

Add a safe repository foundation for the next KK Phone Rental discovery layer without activating a new production runner, scheduler, business writer, or external provider.

Target architecture:

```text
source watch / change detection
        |
        +-- UNCHANGED -> stop
        |
        +-- NEW / CHANGED
                 |
                 v
        discovery / extraction
        (Exa / Crawl4AI / Firecrawl)
                 |
                 v
          Discovery Staging
                 |
                 v
            GPT Verifier
                 |
                 v
        existing governed write path
```

The foundation is deliberately staging-only.

## Why this work is safe now

Current production-completion tracking still has control-plane and Apps Script/atomicity P0 gates. Hugging Face Event Assist has already passed bounded live UAT and has a guarded Scanner staging contract on PR #44, but production activation remains blocked by the existing governance gates.

Therefore this branch does **not** merge PR #44, activate Hugging Face, enable an external crawler, change Make, deploy changedetection.io, add a scheduler, or write Event Tracker rows.

Instead it establishes the reusable authority contract needed before any of those providers can be wired.

## Added: source-watch contract

File:

`server/discovery-source-watch-contract.js`

Contract version:

`discovery-source-watch-v1`

### Allowed provider identities

```text
CHANGEDETECTION_IO
EXA
CRAWL4AI
FIRECRAWL
OFFICIAL_SOURCE_WATCH
```

Provider inclusion means the evidence shape is recognized. It does **not** mean the provider is activated in production.

### Allowed source tiers

```text
OFFICIAL
TICKETING
VENUE
ARTIST_AGENCY
COMPETITOR
SECONDARY
```

### Accepted source states

```text
NEW
CHANGED
UNCHANGED
ERROR
```

Behavior is deterministic:

- `UNCHANGED` -> no downstream discovery call;
- `NEW` / `CHANGED` -> eligible for one staging discovery call;
- `ERROR` -> provider failure only, no fabricated event;
- malformed/stale/unsupported evidence -> fail closed.

### Evidence integrity

Non-error observations require a SHA-256 content hash.

`CHANGED` additionally requires:
- a valid previous SHA-256 hash;
- before/after hashes must be different.

`UNCHANGED` with a previous hash requires both hashes to match.

HTTPS source URLs are required. Credential-bearing URLs are rejected.

Observations older than the bounded freshness window, or materially future-dated, fail closed.

## Added: authority boundary for discovery providers

A discovery/extraction result is accepted only when it explicitly remains:

```text
authoritative = false
verifier_required = true
production_writes = 0
final_truth_mutation = false
notification_sends = 0
```

The contract rejects provider results attempting to carry authority or direct-write fields including:

```text
final_decision
verified
approved
final_truth
monthly_write
pricing_write
booking_write
inventory_write
notification_send
sheet_write
machine_sot_write
```

Candidate fan-out is bounded to 100 candidates per observation before handoff.

## Staging handoff

A successful source-watch flow creates only:

```text
handoff_state = DISCOVERY_STAGING_ONLY
route = EXISTING_SCANNER_STAGING_TO_VERIFIER
authoritative = false
verifier_required = true
production_writes = 0
direct_business_write_allowed = false
direct_notification_allowed = false
```

No Sheet write implementation exists in this contract.

## Regression coverage

Added:

`tests/discovery-source-watch-contract.test.js`

Coverage includes:

1. unchanged source -> zero discovery calls;
2. changed source -> exactly one staging call;
3. Exa NEW source -> staging-only, nonauthoritative;
4. HTTP/credential-bearing URL -> blocked;
5. unknown provider/source tier -> blocked;
6. CHANGED with identical hashes -> blocked;
7. stale observation -> blocked;
8. provider result claiming final authority -> rejected;
9. provider failure -> no handoff and no fabricated decision;
10. candidate count >100 -> rejected;
11. current production API/admin entrypoints are forbidden from importing the staged source-watch contract.

The final test is a rollout barrier. A later production integration must deliberately change the test and carry separate acceptance evidence.

## Added: repository Agent Skills

Repository skills are stored under `.agents/skills`, following the Agent Skills `SKILL.md` structure.

Added:

- `kk-discovery-scanner`
- `kk-event-verifier`
- `kk-canary-safety`
- `kk-discovery-source-watch`

### What this improves

A future Codex/agent session operating in the repository now has explicit reusable instructions for:

- Scanner staging-only authority;
- source priority and evidence provenance;
- change-detection behavior;
- Verifier conflict handling;
- semantic-dedupe hard identity boundaries;
- Canary zero-write acceptance;
- external-provider nonauthority;
- production rollout separation.

This reduces dependence on long ad-hoc prompts and makes safety rules versionable with the code.

## External tooling status

### Exa

The ChatGPT Exa plugin is connected and can be used interactively for semantic research/discovery.

This branch does **not** add an Exa runtime API key, Vercel environment variable, cron, or production network call.

### changedetection.io

Selected as the preferred source-watch candidate for controlled evaluation because it directly fits the required change-detection role.

Not deployed or connected in this branch.

### Crawl4AI

Selected as a controlled/custom crawler candidate for JavaScript pages and structured extraction.

Not installed or invoked in this branch.

### Firecrawl

Retained as an optional managed crawl/extract provider.

Not installed or invoked in this branch.

### Hugging Face

Existing HF Event Assist work remains separate on PR #44.

This branch does not merge, enable, import, or activate HF production wiring.

### Vercel Workflow / Queues

Recommended later for durable orchestration after current control-plane acceptance.

No Workflow or Queue production dependency is added in this branch, avoiding a second runtime path while the current Scanner witness/control-plane gates are still open.

## Production surfaces intentionally untouched

```text
Booking logic = unchanged
Admin write path = unchanged
Apps Script = unchanged / not deployed
Event Tracker business rows = 0 writes
Pricing = unchanged
Inventory = unchanged
Customer data = unchanged
Machine SOT policy = unchanged
Scanner task = unchanged
Verifier task = unchanged
Canary task = unchanged
Make scenarios = unchanged
HF production activation = OFF
Exa runtime activation = OFF
changedetection.io runtime activation = OFF
Crawl4AI runtime activation = OFF
Firecrawl runtime activation = OFF
Production Vercel deployment = 0
```

## Expected operational improvement after later provider activation

The new contract enables a cost-controlled sequence:

```text
unchanged page
-> stop before semantic search / crawler / LLM

changed page
-> one bounded discovery stage
-> staging candidate
-> Verifier
```

This is designed to reduce unnecessary deep-scan work while increasing detection coverage.

The repository foundation itself does not claim those runtime gains until a real provider is activated and measured.

## Rollout gates before provider activation

1. current main CI must pass with this foundation;
2. PR Preview must be healthy;
3. no production entrypoint may import the source-watch module before explicit acceptance;
4. current control-plane natural persistence gate must be re-evaluated;
5. provider credentials must be stored in an approved secret surface, never committed;
6. provider must remain read/discovery only;
7. first provider run must be bounded and zero-business-write;
8. result must land in staging only;
9. Verifier remains final authority;
10. rollback must be a single provider/feature disable;
11. only after evidence may scheduling/Workflow/Queue integration be reviewed separately.

## Current classification

```text
DISCOVERY_MESH_REPOSITORY_FOUNDATION = IMPLEMENTED_ON_REVIEW_BRANCH
SOURCE_WATCH_AUTHORITY_CONTRACT = IMPLEMENTED
CUSTOM_AGENT_SKILLS = IMPLEMENTED
PRODUCTION_PROVIDER_WIRING = NOT ENABLED
PRODUCTION_BUSINESS_WRITES = 0
PRODUCTION_DEPLOYMENT = NOT PERFORMED
```
