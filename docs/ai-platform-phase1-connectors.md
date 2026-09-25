# KK read-only connectors and advisory boundary

This candidate extends the local Ops pilot on PR #185. It adds bounded observations and an optional local advisory stage. It does not deploy a service, activate a runner, grant production permissions, or claim business acceptance.

## Current authority compatibility

The deterministic business adapter inherited from PR #185 supports v4.9.35/v4.9.36 only. On 2026-09-25, a fresh complete bounded policy read observed primary v4.9.43 and active v5 scoring/pricing/copy extensions. The connector therefore returns `BLOCKED`, a minimized policy observation, and `snapshot: null` before business reads or model calls. It never silently substitutes v4.9.36 or applies its former score threshold to current production.

Supporting current business policy is a separate reviewed change. It must cover primary and relevant active extension rules, owner visibility precedence, poster provenance, scoring bands, price authority, and exact capacity evidence. Updating a version string alone is insufficient. Production remains governed by the current live Machine SOT and compatible active registry, not this document.

Active rules also require a valid calendar timestamp with an explicit UTC/offset timezone. Empty, numeric, invalid or date-only legacy effective times block this adapter; they are not silently interpreted as already effective. Unrecognized suffix versions also block until their contract is reviewed.

## Components

| Component | Behavior |
| --- | --- |
| `platform/ops/sheets-collector.js` | Trusted host provides only `getMetadata({spreadsheetId})` and `getRange({spreadsheetId,sheetName,range})`. Checks exact workbook/tab IDs, headers, range echoes and bounds before projection. No credentials or write methods. |
| `platform/ops/public-collector.js` | Two fixed anonymous HTTPS GETs for public Ready/Packages CSV. Rejects redirects, HTML, malformed CSV, body over 512 KiB and total timeout over 15 seconds. Preserves duplicate identity evidence. |
| `platform/ops/advisory.js` | Converts deterministic findings into opaque references and allowlisted codes. No event names, family/show IDs, notes, URLs or external prose reaches the model. Advice must rank every known issue once and choose one of three inspection/review actions. Thai wording is rendered locally. |
| `platform/ops/openai-advisory-provider.js` | One fixed Responses API POST with structured JSON output, `store:false`, `tools:[]`, `tool_choice:'none'`, bounded response/time/output. No retries, fallback provider, tool executor or raw error persistence. |
| `platform/ops/advisory-journal.js` | Local exclusive lock, fsynced create-once intent before dispatch, checksummed terminal receipt. Same occurrence+input replays historically; changed input/model conflicts. Interrupted or ambiguous calls cannot auto-dispatch again. |
| `platform/ops/connected-cycle.js` | Composes collection, existing persisted pilot, public observation and optional advisory. Defaults to no model. A policy block withholds the pilot/model stage and keeps public observation separate. |

## Evidence and coverage

The fixed Sheets plan reads policy A1:N2000, canonical A1:AN500, lineage A1:M500, Core A4:I1000 and Ready A4:K1000. Every request is under 50,000 cells. Metadata is read before data; policy is read again after a supported collection to detect drift. A grid larger than the range yields PARTIAL, never COMPLETE. Raw responses are not logged: evidence stores hashes and range metadata; selected observation rows exclude notes, pricing, customer and booking fields.

Monthly data is explicitly UNAVAILABLE because this adapter has no stable monthly family/show identity mapping. Null unknown verification, conflict, rental fit and capacity inputs remain unknown. They are not changed to true/false or zero. Dates may normalize exact `dd/mm/yyyy`; ranges and unresolved values remain unresolved. Selected IDs and lineage selection do not establish global duplicate absence or a coherent atomic snapshot across independent Sheets reads.

Public observation stores only event IDs, exact dates, visibility, package IDs, response hash and time. Public rows do not establish authenticated Core authority, correct price, stock availability, expected package completeness, booking acceptance or notification delivery. `OBSERVED` is not a production PASS. Hiding/lens/copy policy acceptance is outside this minimized collector.

## Local use

Use Node 24.13.1 for the persisted pilot and platform suite. No dependency installation is added.

For public observation, create a local JSON file containing only `{"event_ids":["EVT-..."]}` with actual known IDs, then:

```text
npm run ops:public -- --input selection.json --output public-observation.json
```

For optional advisory, the local host must supply `OPENAI_API_KEY` through an appropriate secret store/environment and explicitly select `KK_OPS_ADVISORY_MODEL`. Neither value is read from a model report or committed. ChatGPT/Codex login does not establish availability of this API credential. Do not extract or reuse session authentication secrets as API keys.

The host also supplies a separate local authority JSON file with `environment:"local"`, `enabled:true`, `capability:"advisory.generate"`, strict UTC `observed_at`/`expires_at` (at most one hour), and `max_calls` from 1 to 3. It must be managed by the trusted host, not generated from model output. Setting enabled false blocks new dispatches. There is no recurring service or self-renewal.

```text
npm run ops:advisory -- --input pilot-result.json --authority host-authority.json --state-dir local-advisory-state --initialize local-only --occurrence owner-test-001 --output advisory-receipt.json
```

Omit `--initialize` for an existing journal. Input report must be no more than one hour old, including after host authorization completes. A zero-issue observation consumes no provider call. Receipt input hash binds the report, provider/model, adapter version and generation bounds. Maximum three attempts per journal; an ambiguous attempt counts toward the budget. No automatic journal rollover or reset exists. Receipt usage may be null and cost is explicitly unknown; token/output bounds are not a monetary budget.

For a host connector integration, call `runReadOnlyCycle` with the restricted reader functions and explicit IDs. Initialize local pilot and optional advisory journals separately. Persistent CLI output uses create-only writes. Supply a fresh occurrence for a genuinely new observation, not to bypass unresolved calls. Model and source mocks in tests are fixtures, never provider proof.

## Recovery and deployment boundaries

If `worker.lock` remains or an intent has no receipt, stop and inspect the local journal/provider evidence. Do not automatically delete locks or create a fresh occurrence to retry an ambiguous call. Checksums detect accidental corruption; they are not signatures against a hostile filesystem owner. The journal is single-machine and process-crash oriented, not a distributed transaction or power-loss durability guarantee. Filesystem permissions depend on the host OS.

The caller's trusted process owns credentials and authorization. A malicious process with those credentials is outside this adapter boundary. A timed-out injected Sheets method cannot be cancelled by this generic interface; its result is discarded and no retry occurs. Real model responses remain unverified until an authorized provider test succeeds. No production provider or environment is enabled by this candidate.

Official API contracts: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [Responses creation](https://developers.openai.com/api/reference/cli/resources/responses/methods/create). `store:false` controls response storage and is not a claim of zero provider retention.

## Validation

Run `npm run check`, `npm run check:platform`, `npm test`, and `npm run test:platform`. CI checks the exact PR head on Linux Node 20 for existing regression and Node 24.13.1 for platform/persistence. The added tests cover transport restrictions, selected coverage, policy drift/extensions, input minimization, invalid model references/permissions, current host authority, dispatch freshness, stream cancellation, durable intent, concurrency, replay, no-op budget and ambiguous failure recovery.
