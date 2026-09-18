# KK Phone Rental — Hugging Face Event Assist V1

Date: 2026-09-18  
Status: STAGED / DISABLED BY DEFAULT / ZERO PRODUCTION WRITE  
Target policy baseline: v4.9.15

## Objective

Add Hugging Face as an assistive inference layer inside the existing KK discovery architecture without creating a new Runner, scheduler, queue, Sheet, final writer, or business authority.

V1 covers:
- zero-shot event-type classification;
- multilingual event embeddings;
- semantic duplicate-candidate detection.

It must never promote an event, write final lifecycle/pricing/monthly truth, send notifications, or bypass the existing Verifier.

## Authority boundary

Canonical flow remains:

External Sources -> Scanner -> optional HF Event Assist -> existing Candidate/AI handoff -> Verifier -> Machine SOT / final projections

Every HF result is advisory:
- `authoritative=false`
- `verifier_required=true`
- `production_writes=0`

## Reuse / no-new-architecture decision

No new queue or scheduler is introduced. The live system already has Candidate/AI staging and Verifier ownership. HF Event Assist is a library boundary callable by the existing Scanner candidate path when explicitly enabled.

## Implementation

### `server/hf-event-assist.js`

Provides:
- `classifyEventCandidate`: event labels `CONCERT`, `FAN_MEETING`, `FAN_SIGN`, `FAN_SCREENING`, `FESTIVAL`, `PREMIERE`, `OTHER`.
- Default zero-shot model: `MoritzLaurer/ModernBERT-large-zeroshot-v2.0`.
- `embedEventCandidates`: default embedding model `intfloat/multilingual-e5-large`.
- `duplicatePairs`: cosine similarity with default threshold `0.92`; all matches are `POSSIBLE_DUPLICATE_REQUIRES_VERIFIER`.

Network requests are restricted to the Hugging Face inference router by validating model IDs and constructing the endpoint internally. Tokens are never returned in result objects.

### `scripts/hf-event-assist-dry-run.js`

Manual diagnostic only. It performs no Machine SOT mutation and always reports zero production writes.

### `tests/hf-event-assist.test.js`

Covers disabled-by-default, missing token, advisory classification, advisory embeddings, semantic duplicate flags, host restriction, and remote failure behavior.

## Runtime configuration

No secret is committed.

Required only for controlled live-call UAT:
- `HF_EVENT_ASSIST_ENABLED=true`
- `HF_TOKEN=<token with Inference Providers permission>`

Optional:
- `HF_ZERO_SHOT_MODEL`
- `HF_EMBED_MODEL`

Without the enable flag the adapter returns `SKIPPED`. Without a token it returns `SKIPPED/HF_TOKEN_MISSING`.

## Intended Scanner use

HF access is external access. Therefore it may run only after the current Scanner occurrence has already passed the existing v4.9.15 policy/no-conflict/lock/Manifest/Planner ordering gate.

Recommended path:
1. Existing Scanner obtains raw source evidence.
2. Normalize candidate text.
3. Optional HF classification.
4. Optional HF embeddings and similarity.
5. Stage possible duplicate flags only; do not auto-merge/delete.
6. Preserve provenance.
7. Hand off through existing Candidate/AI surfaces.
8. Existing Verifier owns final evaluation and canonical writes.

## Failure behavior

- timeout/HTTP/malformed output -> no final decision;
- missing token -> skip HF only;
- model unavailable -> preserve original Scanner path;
- high similarity -> Verifier flag only;
- HF output never increases source coverage by itself.

## Controlled UAT before live enablement

Do not enable in the recurring Scanner yet. First verify on a bounded known-event sample:
1. zero Machine SOT writes;
2. zero task/scheduler changes;
3. zero notification/provider sends;
4. Thai/English event classification quality;
5. known duplicates surfaced;
6. different events remain below threshold;
7. errors preserve original Scanner path;
8. token absent from logs/output;
9. HF call occurs only after Planner exact1 and existing lock/Manifest preflight.

A later governed change may wire the adapter into the existing Scanner runtime. It must reuse the existing Runner/schedule and preserve Verifier final authority.

## Rollback

Set `HF_EVENT_ASSIST_ENABLED=false`.

V1 adds no schema, queue, scheduler, or final-write dependency, so rollback requires no data migration.

## Expected benefit

- better mixed Thai/English event-language classification;
- fewer duplicate candidate packets;
- lower Verifier load for obvious classification/dedup cases;
- unchanged final-truth/fencing/rollback boundaries.

## Explicit non-goals

- no poster OCR/VLM production integration yet;
- no custom fine-tuning;
- no demand-prediction model;
- no automatic canonical merge;
- no direct production Sheet writes;
- no new Runner, schedule, queue, watchdog, notifier, or coding agent.


## V1.1 hardening and execution log — 2026-09-18

### Changes applied after initial staging

1. E5 embedding quality fix
   - `intfloat/multilingual-e5-large` now receives the model-recommended `query: ` prefix for symmetric semantic-similarity work.
   - Custom non-E5 embedding models are not forced to use that prefix.

2. Classification taxonomy expanded for KK discovery
   - Canonical outputs now include `GRADUATION`, `BRAND_EVENT`, and `ARTIST_APPEARANCE` in addition to concert/fan-event/festival/premiere classes.
   - Hugging Face receives natural-language candidate labels such as `fan meeting` and `graduation event`, then the adapter maps them back to canonical machine labels.
   - A confidence band (HIGH/MEDIUM/LOW) is exposed only as advisory metadata; low confidence never causes automatic rejection.

3. False-positive dedup protection
   - High embedding similarity no longer enters the ordinary duplicate bucket when exact ISO event dates conflict.
   - High similarity also stays out of the ordinary duplicate bucket when explicit Show IDs conflict.
   - These cases are emitted separately as `SIMILAR_BUT_DISTINCT_IDENTITY_REQUIRES_VERIFIER`.
   - No automatic merge/delete is introduced.

4. Bounded KK benchmark fixture
   - Added 14 event-level candidates covering concert, fan meeting, fan sign, fan screening, festival, premiere, graduation, brand event, artist appearance, known duplicate variants, and multi-show same-name/date-conflict cases.
   - Fixtures are syntheticized from KK event/miss patterns and contain no customer/booking PII.

5. Zero-write benchmark harness
   - Added `scripts/hf-event-assist-benchmark.js`.
   - It measures classification accuracy, expected duplicate recall, false-positive duplicate pairs, and identity-conflict handling.
   - Quality gate target for a controlled live run: classification accuracy >= 0.80, duplicate recall >= 0.90, false-positive duplicate pairs = 0.
   - The harness performs zero Machine SOT writes, zero final-truth mutation, and zero notification sends.
   - If HF is disabled or no token is available, it exits as `PREPARED_NOT_EXECUTED` rather than fabricating quality results.

6. Repository checks
   - `package.json` now syntax-checks the benchmark script.
   - Added `npm run hf:assist:benchmark`.
   - Benchmark fixture integrity is covered by the regression test file.

### Defect found and corrected during hardening

A connector-escaping defect briefly produced malformed regular expressions in the staged adapter. It was detected by explicit syntax parsing before merge/production activation and fixed in commit history. Post-fix syntax validation passed for:
- `server/hf-event-assist.js`
- `tests/hf-event-assist.test.js`
- `scripts/hf-event-assist-benchmark.js`
- `scripts/hf-event-assist-dry-run.js`

Post-fix pure regression checks passed for:
- E5 query prefix;
- non-E5 no-prefix behavior;
- exact-date identity conflict;
- Show-ID identity conflict;
- conflict exclusion from duplicate bucket;
- conflict observability;
- same-date semantic duplicate eligibility.

A mocked Hugging Face request also confirmed:
- canonical `GRADUATION` mapping;
- HIGH confidence-band mapping;
- natural-language candidate labels;
- fixed `https://router.huggingface.co` host;
- E5 `query: ` prefix;
- `authoritative=false`;
- `production_writes=0`.

### Current activation state

Still disabled for recurring production use.

Not performed by this hardening pass:
- no production Scanner wiring;
- no recurring task mutation;
- no Machine SOT row write;
- no policy activation/change;
- no Apps Script deployment;
- no Make/provider send;
- no LINE/Telegram notification;
- no production Vercel environment-variable mutation;
- no final event/monthly/pricing mutation.

The next valid gate is a controlled live Hugging Face benchmark using a credential with Inference Providers permission. Do not merge/activate solely from mocked or preview-build evidence.


## V1.2 CI/UAT readiness checkpoint — 2026-09-18

### Additional controls added

- Existing GitHub workflow `.github/workflows/admin-regression.yml` now executes the HF benchmark harness in an explicit disabled mode.
- The CI step fails if the harness reports anything other than:
  - `PREPARED_NOT_EXECUTED`
  - `live_hf_calls=0`
  - `production_writes=0`
  - `final_truth_mutation=false`
  - `notification_sends=0`
- Added `docs/HUGGING_FACE_EVENT_ASSIST_UAT_RUNBOOK_2026-09-18.md` with controlled live-UAT preflight, quality gate, fail-closed rules, evidence requirements and rollback.

### CI evidence

- Admin Regression run #144: SUCCESS after adding the HF benchmark safety step.
- The job's dedicated `HF benchmark harness safety check` step completed successfully.
- Admin Regression run #145: SUCCESS on the subsequent head containing the UAT runbook.

### External capability check

A ChatGPT Hugging Face plugin is available in the plugin directory for inspecting models, datasets, Spaces and research. It is not currently installed. Installing that plugin can improve model inspection workflows, but it does not replace the inference credential required by the live benchmark.

### Current unresolved external dependency

No connected tool in this execution context exposes a safe read/write surface for the project's Hugging Face inference secret. Therefore the live benchmark was not fabricated or bypassed.

Current state remains:
- code/staging hardened;
- CI green;
- live benchmark prepared;
- production integration disabled;
- PR #44 remains DRAFT;
- no Machine SOT write or production task mutation performed by the HF work.


## V1.3 credential-safety and live-UAT readiness hardening — 2026-09-18

### Live authority re-check

The live Machine SOT was re-read before this hardening pass. Highest Active policy remains:

- `v4.9.15 AUTONOMOUS CLOSURE & OWNER NOTIFICATION HARDENING`

The live registry also contains the Sep 17–18 control-plane forensic gates for post-acquire writer recheck, task-state attribution, own-runtime disable recurrence, and launcher/runtime-boundary divergence. This HF pass therefore made no Scanner/Verifier/Canary task mutation and no policy mutation.

### Hugging Face account/model evidence

The connected Hugging Face OAuth context was verified as authenticated. The plugin exposes read/jobs scopes but not a generic secret-management or direct inference-token export surface.

Hub metadata was read directly for the two configured models:

- `MoritzLaurer/ModernBERT-large-zeroshot-v2.0`
  - task: text-classification
  - library: transformers
  - Hugging Face Inference provider: live
- `intfloat/multilingual-e5-large`
  - task: feature-extraction
  - library: sentence-transformers
  - multilingual metadata explicitly includes `th`
  - Hugging Face and DeepInfra inference providers: live

### HF Jobs execution attempt

A bounded Hugging Face Jobs probe was attempted without printing any credential value. The service returned:

- `402 Payment Required`

No benchmark quality result was inferred from that failure. No fallback through an untrusted third-party Space was used.

### Secret-redaction hardening

`server/hf-event-assist.js` now redacts:
- an exact configured HF token if echoed in a remote error;
- bearer credential text returned by a provider.

The adapter must never surface the configured token through provider error messages.

### Benchmark call-budget and failure hardening

`scripts/hf-event-assist-benchmark.js` now:
- uses an explicit live-call budget (`HF_UAT_MAX_CALLS`, default 20);
- computes planned calls before external access;
- fails closed before any call if the plan exceeds the budget;
- records attempted-call count;
- records per-classification and embedding latency;
- returns a structured `LIVE_BENCHMARK_FAILED` report on provider/model failures;
- redacts secrets from failure output;
- triggers a final serialized-output secret-leak guard;
- keeps `production_writes=0`, `final_truth_mutation=false`, and `notification_sends=0`.

### Zero-network readiness checker

Added:

- `scripts/hf-event-assist-readiness.js`
- npm command: `npm run hf:assist:readiness`

It performs zero network calls and checks:
- enable flag;
- presence of an HF token without exposing its value;
- safe model-ID format;
- fixture size / planned call count;
- UAT call-budget ceiling.

Possible status:
- `BLOCKED`
- `READY_FOR_LIVE_UAT`

A READY result authorizes only execution of the bounded benchmark; it does not authorize Scanner wiring or production activation.

### CI additions

The existing Admin Regression workflow now validates both:
1. disabled benchmark harness safety; and
2. zero-network UAT readiness contract.

The CI readiness check requires:
- `status=BLOCKED` while the feature is explicitly disabled;
- `network_calls=0`;
- `production_writes=0`;
- `final_truth_mutation=false`;
- `notification_sends=0`;
- blocker includes `HF_EVENT_ASSIST_DISABLED`.

### Production impact of V1.3

Still zero:
- Machine SOT business writes;
- Candidate/AI/Lifecycle/monthly/pricing mutations;
- policy mutation;
- Scanner/Verifier/Canary recurring task mutation;
- LINE/Telegram sends;
- production Vercel promotion;
- HF recurring production activation.


## V1.4 controlled GitHub live-UAT execution attempt — 2026-09-18

### Manual-only execution route added

Added:

- `.github/workflows/hf-event-assist-live-uat.yml`

The workflow:
- has no schedule;
- does not run on ordinary pushes;
- triggers only on the PR `ready_for_review` transition;
- checks out the exact PR head SHA;
- runs `npm run check` and `npm test` before UAT;
- runs the zero-network readiness checker first;
- sources `HF_TOKEN` only from GitHub Actions secrets;
- caps planned live calls with `HF_UAT_MAX_CALLS=20`;
- runs the bounded benchmark only after readiness passes;
- uploads only redacted JSON UAT evidence;
- enforces the quality gate after the artifact is preserved;
- has read-only repository contents permission;
- performs no Machine SOT, Scanner, Verifier, Canary, pricing, monthly, LINE or Telegram mutation.

### Workflow verification before trigger

The workflow addition passed:

- Admin Regression run #155: SUCCESS.

The PR was then intentionally moved from Draft to Ready for review to trigger exactly one controlled UAT attempt.

### Live UAT run #1

Workflow:
- `HF Event Assist Live UAT`
- run ID: `35289177526`
- head SHA: `74644fd6979980608c1cba069f7e2c49b0c695dc`

Pre-UAT repository verification:
- checkout: PASS
- Node setup: PASS
- `npm run check`: PASS
- `npm test`: PASS

Zero-network readiness result:
- `candidate_count=14`
- `planned_live_calls=15`
- `max_live_calls=20`
- `hf_enabled=true`
- `hf_token_present=false`
- blocker: `HF_TOKEN_MISSING`
- `status=BLOCKED`
- `network_calls=0`
- `production_writes=0`
- `final_truth_mutation=false`
- `notification_sends=0`

Because preflight failed closed:
- the live benchmark step was SKIPPED;
- live Hugging Face inference calls remained zero;
- the final quality gate was not executed;
- no live classification/embedding score was fabricated.

### Evidence artifact

Artifact:
- name: `hf-event-assist-live-uat-35289177526`
- artifact ID: `10525876337`
- SHA-256 digest: `c984c4e95c3651c6c0b03385a1ddf0b8c9a4d5c443eaa30ca937fa8bfc21b88a`
- retention expiry: 2026-10-17

The artifact contains the redacted readiness evidence generated before any external model call.

### PR state restored

After the controlled attempt proved that the GitHub Actions inference secret is missing, PR #44 was converted back to Draft.

Current blocker is now proven rather than inferred:

- GitHub Actions repository secret `HF_TOKEN` is not available to the UAT workflow.

No attempt was made to:
- expose or copy the Hugging Face OAuth credential from the connected plugin;
- commit a token;
- place a token in logs/PR/docs;
- bypass the missing secret using a public/community Space;
- lower the quality or identity-safety gate.

### Next valid external action

Add an inference-capable Hugging Face access token as the GitHub Actions repository secret named:

`HF_TOKEN`

Then retrigger the same Draft -> Ready-for-review UAT boundary. The workflow will first re-run zero-network readiness, then execute at most the bounded call plan if and only if the secret is present.


## V1.4 controlled UAT execution surface — 2026-09-18

Added a manual-only GitHub Actions workflow, `.github/workflows/hf-event-assist-uat.yml`, to close the execution-surface gap without changing production architecture.

Properties:
- manual `workflow_dispatch` only;
- explicit `RUN_HF_ZERO_WRITE_UAT` confirmation;
- operator-configurable bounded call ceiling, default 20;
- repository `HF_TOKEN` Actions secret is the only supported credential input;
- full syntax/regression suite runs before inference;
- zero-network readiness must pass before inference;
- bounded benchmark is the only live external stage;
- non-secret readiness/benchmark evidence is retained as a 30-day workflow artifact;
- no push, pull-request, cron, Scanner, Verifier, or Canary trigger;
- no Machine SOT write;
- no notification send;
- no production deployment/promotion;
- no merge or activation authority.

A missing `HF_TOKEN` secret fails at readiness before live inference. Secret presence/value cannot be read through the connected GitHub tool and is therefore not assumed.
