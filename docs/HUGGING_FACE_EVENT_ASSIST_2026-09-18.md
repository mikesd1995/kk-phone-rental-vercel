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


## V1.5 first controlled live-UAT attempt — 2026-09-18

A one-shot branch-only GitHub Actions trigger was created to execute the remaining controlled UAT without modifying production runtime. The trigger required the exact commit marker `[RUN_HF_ZERO_WRITE_UAT]`, used `HF_UAT_MAX_CALLS=20`, and had no Scanner/Verifier/Canary/Machine-SOT write path.

### Run evidence

GitHub Actions:
- workflow: `HF Event Assist One-Shot UAT`
- run ID: `35290015708`
- head SHA: `ce777202537fd2b07b5d3d917a7bd8b567897427`

Pre-inference validation:
- full regression suite: `159/159 PASS`
- syntax checks: PASS
- zero-network readiness executed
- readiness result: `BLOCKED`
- blocker: `HF_TOKEN_MISSING`
- `hf_token_present=false`
- bounded live benchmark: SKIPPED
- live inference calls: `0`
- production writes: `0`
- final-truth mutation: `false`
- notification sends: `0`

This is a successful fail-closed safety result, not a model-quality result. No classification accuracy, duplicate recall, latency, or provider reliability score may be inferred from this run.

### Preserved evidence

Artifact:
- name: `hf-event-assist-one-shot-uat-evidence`
- artifact ID: `10526022424`
- size: `544 bytes`
- digest: `sha256:8524242fe4d34490925e6823beef2bf20ee8f4794b6ef41acfdeb3de238ddd3a`
- expires: `2026-10-18T00:10:12Z`

### One-shot trigger cleanup

After the fail-closed result was captured, the temporary push-trigger workflow was deleted from the branch. The permanent manual-only workflow `.github/workflows/hf-event-assist-uat.yml` remains the canonical future execution surface.

No production activation, merge, Machine SOT mutation, recurring-task mutation, or provider notification was performed.

### Current blocker

The exact remaining blocker is now proven rather than assumed:

```text
GitHub Actions secret HF_TOKEN is not configured for this repository/workflow context.
```

A future live UAT must first place a valid Hugging Face Inference Providers credential into the approved GitHub Actions secret named `HF_TOKEN`. The credential value must never be committed, logged, pasted into PR text, or written to Machine SOT.


## V1.6 OIDC credential probe and keyless UAT hardening — 2026-09-18

### Canonical UAT credential strategy changed

The permanent manual workflow `.github/workflows/hf-event-assist-uat.yml` now prefers a short-lived Hugging Face token minted through GitHub Actions OIDC. A repository Actions secret named `HF_TOKEN` remains a fallback only.

The workflow now requests:

```text
permissions:
  contents: read
  id-token: write
```

Credential order:
1. if repository secret `HF_TOKEN` exists, use it;
2. otherwise request a GitHub OIDC ID token with audience `https://huggingface.co`;
3. exchange it at `https://huggingface.co/oauth/token` for the user resource `Mikesd1995`;
4. mask the temporary token before exporting it to later steps;
5. run readiness, then bounded benchmark.

The OIDC token / exchanged HF token is never written to source, PR text, Machine SOT, or benchmark JSON.

### Why OIDC is preferred

Hugging Face current Trusted Publishers documentation supports account CI/CD identities that mint 60-minute user-scoped tokens. When `Allow Inference Providers calls` is enabled, exchanged tokens include the `inference-api` scope while remaining read-only for Hub resources. This removes the need to store a long-lived HF token in GitHub.

### One-shot OIDC probe evidence

A temporary branch-only OIDC probe was executed after full regression.

GitHub Actions:
- workflow: `HF Event Assist One-Shot OIDC UAT`
- run ID: `35290217934`
- head SHA: `3ece417fe7bf0ee97d03efaff255e34cf874fa41`

Pre-exchange result:
- syntax/regression: PASS
- test count: `160`
- passed: `160`
- failed: `0`

GitHub OIDC token acquisition succeeded far enough to perform the Hugging Face token exchange. Hugging Face rejected the exchange:

```text
HTTP 400
error = invalid_grant
error_description = No trusted publisher configured for user 'Mikesd1995' matching this OIDC token
```

Therefore:
- readiness step: SKIPPED;
- benchmark step: SKIPPED;
- live Hugging Face inference calls: `0`;
- Machine SOT writes: `0`;
- final truth mutations: `0`;
- notification sends: `0`.

This proves the exact current blocker is Hugging Face account-side CI/CD identity configuration, not GitHub OIDC issuance, repository tests, benchmark code, or model selection.

### Required Hugging Face CI/CD identity for the permanent workflow

Configure the Hugging Face account Authentication → CI/CD Access entry for GitHub Actions and pin it to:

```text
GitHub repository: mikesd1995/kk-phone-rental-vercel
branch: hf-event-assist-v1-20260918
workflow: hf-event-assist-uat.yml
Allow Inference Providers calls: enabled
```

The workflow should then receive a short-lived token with `inference-api` permission. Inference usage remains billed/rate-limited against the Hugging Face account.

### One-shot cleanup

The temporary OIDC push-trigger workflow was removed immediately after evidence capture. Only the manual `workflow_dispatch` controlled-UAT workflow remains as the intended execution surface.

No production Scanner/Verifier/Canary task, policy, Machine SOT business row, Vercel production deployment, or notification transport was changed.


## V1.7 official HF CLI OIDC path and account-write boundary — 2026-09-18

### Permanent workflow simplified to the official Hugging Face OIDC flow

The canonical manual workflow `.github/workflows/hf-event-assist-uat.yml` no longer contains a custom direct RFC 8693 HTTP token-exchange implementation.

If the optional repository secret `HF_TOKEN` is absent, the workflow now:

1. installs the official Hugging Face CLI from `https://hf.co/cli/install.sh`;
2. keeps `HF_OIDC_RESOURCE=Mikesd1995`;
3. calls `hf auth token`;
4. relies on GitHub Actions `id-token: write` and the official Hugging Face client to mint/exchange the OIDC identity;
5. masks the short-lived token;
6. exports it only to subsequent readiness/benchmark steps.

This matches Hugging Face's current Trusted Publishers guidance and reduces bespoke authentication code.

### Authentication fallback order

```text
1. GitHub Actions secret HF_TOKEN (only if explicitly configured)
2. Official hf CLI OIDC / CI-CD identity flow
```

The preferred path remains OIDC because the exchanged account token expires after 60 minutes and can be limited to `gated-repos + inference-api`.

### Connector authority boundary verified

The connected Hugging Face account is authenticated as `Mikesd1995`, but the connector OAuth scopes exposed in this execution context are:

```text
jobs
openid
profile
read-mcp
read-repos
```

There is no account-settings write scope or CI/CD-identity management action exposed by the connector.

Therefore the agent cannot legitimately create or modify the account's Authentication → CI/CD Access entry through the connected app. This is an authority boundary, not a code blocker, and must not be bypassed by scraping session cookies, inventing credentials, or storing a long-lived token in source.

### Required account-side identity remains

The Hugging Face account must contain one GitHub Actions CI/CD identity matching the permanent workflow claims:

```text
repository = mikesd1995/kk-phone-rental-vercel
branch = hf-event-assist-v1-20260918
workflow = hf-event-assist-uat.yml
Allow Inference Providers calls = enabled
```

After that account setting exists, the permanent manual workflow can exchange GitHub OIDC for a short-lived inference-capable token without any repository HF secret.

### Regression hardening

Tests now enforce that the permanent workflow:
- uses `id-token: write`;
- installs the official `hf` CLI;
- uses `hf auth token`;
- preserves explicit secret fallback;
- masks the exchanged token;
- does not contain the direct `/oauth/token` implementation;
- does not read the GitHub OIDC metadata endpoint directly;
- remains manual-only.

No production Machine SOT, Scanner, Verifier, Canary, notification, or Vercel production state was modified by V1.7.


## V1.8 live benchmark pass and multilingual model correction — 2026-09-18

### Account-side CI/CD identity now works

The Hugging Face account CI/CD identity matching:

- repository: `mikesd1995/kk-phone-rental-vercel`
- branch: `hf-event-assist-v1-20260918`
- workflow: `hf-event-assist-uat.yml`
- Inference Providers calls: enabled

was configured by the account owner.

The permanent workflow then successfully completed:
- official `hf auth token` OIDC credential resolution;
- zero-network readiness;
- live Inference Providers access with a short-lived token.

This closes the former `invalid_grant / No trusted publisher configured` blocker.

### First authenticated live benchmark exposed a model-task mismatch

Controlled UAT run `35296196369` reached live inference for the first time.

The then-default model:

```text
MoritzLaurer/ModernBERT-large-zeroshot-v2.0
```

failed on the first classification request:

```text
HTTP 400
PreTrainedTokenizerFast._batch_encode_plus() got an unexpected keyword argument 'candidate_labels'
```

Evidence:
- readiness: `READY_FOR_LIVE_UAT`;
- auth mode: `HF_OIDC_CICD_IDENTITY`;
- attempted live calls: `1`;
- production writes: `0`;
- final truth mutation: `false`;
- notification sends: `0`;
- benchmark status: `LIVE_BENCHMARK_FAILED`.

Root cause: the selected ModernBERT repository is exposed with text-classification task metadata in the provider path, so provider routing did not invoke a zero-shot-classification pipeline that accepts `candidate_labels`.

No production activation occurred.

### Model correction

The default zero-shot model was changed to:

```text
MoritzLaurer/bge-m3-zeroshot-v2.0
```

Public Hugging Face metadata for this model reports:
- `pipeline_tag=zero-shot-classification`;
- `multilingual`;
- `endpoints_compatible`;
- warm inference availability.

The model card explicitly recommends the BGE-M3 zeroshot variant for multilingual / non-English use cases.

The embedding model remains:

```text
intfloat/multilingual-e5-large
```

A regression test now pins the default zero-shot model to the BGE-M3 model.

### Successful bounded live benchmark

Controlled UAT run:

```text
run ID = 35296382494
head SHA = 64271c4d95b28dc720644c2f64367e15161123b6
workflow = HF Event Assist Controlled UAT
result = SUCCESS
```

Readiness:
- candidate count: `14`;
- planned calls: `15`;
- max calls: `20`;
- token present: `true`;
- model config valid: `true`;
- network calls during readiness: `0`;
- production writes: `0`;
- final truth mutation: `false`;
- notification sends: `0`;
- status: `READY_FOR_LIVE_UAT`.

Live benchmark:
- status: `LIVE_BENCHMARK_COMPLETE`;
- live calls: `15 / 20`;
- classification scored: `14`;
- classification correct: `14`;
- classification accuracy: `1.0`;
- expected duplicate pairs: `3`;
- true-positive duplicate pairs: `3`;
- missed duplicate pairs: `0`;
- false-positive duplicate pairs: `0`;
- duplicate recall: `1.0`;
- identity conflicts protected: `2`;
- quality gate: `PASS`;
- recommendation: `ELIGIBLE_FOR_CONTROLLED_SCANNER_WIRING_REVIEW`.

Latency:
- classification total: `13,559 ms`;
- classification average: `968.5 ms`;
- classification max: `4,589 ms`;
- embedding batch: `532 ms`.

Two same-name / high-similarity multi-show cases remained protected as distinct because of `SHOW_ID_MISMATCH`, confirming that semantic similarity does not override hard event identity.

### Evidence artifact

Artifact:
- name: `hf-event-assist-uat-evidence`;
- artifact ID: `10528303318`;
- size: `1,989 bytes`;
- digest: `sha256:98d5c375da68dbaa87fd4b6f8e9b6dba2a47e765b8321b1ebf42256096e30915`;
- created: `2026-09-18T01:42:41Z`;
- expires: `2026-10-18T01:42:40Z`.

### One-shot execution cleanup

A temporary guarded push path was used only because the connected GitHub app does not expose workflow-dispatch creation and the TinyFish browser profile had no authenticated access to the private GitHub repository.

The temporary push route required:
- exact branch `hf-event-assist-v1-20260918`;
- exact commit marker `[RUN_HF_ZERO_WRITE_UAT]`;
- the same workflow filename `hf-event-assist-uat.yml` so OIDC claims remained exact.

After the successful benchmark:
- the push trigger was removed;
- the workflow was restored to manual `workflow_dispatch` only;
- regression guards were restored to reject push/pull-request/schedule triggers.

### Current authority boundary

The live benchmark passing does not authorize production activation.

Current status:

```text
Empirical HF quality gate = PASS
Production HF activation = OFF
Scanner wiring = NOT YET ENABLED
Verifier remains final authority
Machine SOT business writes from HF UAT = 0
Notification sends from HF UAT = 0
```

The next permitted step is a controlled Scanner wiring review under the current live highest Active Machine SOT policy and its external-source preflight / lock / Manifest / Planner gates.


## V1.9 controlled Scanner wiring staging review — 2026-09-18

### Scope

After V1.8 passed the live empirical quality gate, the next step was limited to repository-level Scanner integration staging. No production Scanner task/prompt, Machine SOT business row, recurring task state or Vercel production target was modified.

Dedicated evidence document:

```text
docs/HF_SCANNER_WIRING_REVIEW_2026-09-18.md
```

Tracking:
- Issue #46 = Controlled Scanner wiring review for Hugging Face Event Assist
- Issue #47 = Scanner/Verifier task-persistence blocker before HF production activation

### New executable wiring contract

Added:

```text
server/hf-scanner-wiring-contract.js
server/hf-scanner-adapter.js
tests/hf-scanner-wiring-contract.test.js
tests/hf-scanner-adapter.test.js
```

The wiring contract is pure / zero-write and requires exact runtime evidence before permitting one advisory external HF call.

Required gates:
1. `HF_EVENT_ASSIST_ENABLED=true`;
2. nonblank Scanner Run ID and Candidate identity;
3. exactly one Active policy;
4. zero pre-acquire conflicting writers;
5. exactly one held CORE shared-writer lock with fence;
6. exactly one held Scanner role lock with fence;
7. explicit post-acquire writer recheck;
8. zero post-acquire conflicting writers;
9. exactly one frozen Scanner Manifest;
10. Manifest policy matches Active policy;
11. Manifest fencing token matches Scanner role lock;
12. exactly one Planner item for the run;
13. exactly one authorized Planner item.

Failure of any gate prevents the HF adapter from invoking network inference.

### Authority boundary

HF result acceptance requires:

```text
status = ASSISTED
authoritative = false
verifier_required = true
production_writes = 0
```

Any HF result that attempts final authority, final truth mutation, production writes or notification sends is rejected.

The generated handoff remains:

```text
handoff_state = READY_FOR_VERIFIER
route = EXISTING_SCANNER_TO_VERIFIER_HANDOFF
authoritative = false
verifier_required = true
direct_business_write_allowed = false
direct_notification_allowed = false
```

Provider errors produce no fabricated decision or handoff.

### Production-import isolation

A regression test recursively checks current production API/admin entrypoints and fails if they import the staged `hf-scanner-adapter`.

Therefore the adapter is executable and composable for review but is not silently production-wired.

### Regression evidence

Staging head before documentation-only checkpoint:

```text
7a6cd7ccd82ceda5c00a986cfbd46eff2ba32438
```

Admin Regression #191:

```text
tests = 187
pass = 187
fail = 0
```

HF benchmark harness safety: PASS.
HF live-UAT readiness contract: PASS.
Production-import isolation: PASS.

Vercel Preview for the staging head: READY, preview target only.

### Live authority / task-registry read-only finding

Machine SOT highest Active policy remained:

```text
v4.9.15 AUTONOMOUS CLOSURE & OWNER NOTIFICATION HARDENING
```

Read-only task-registry inspection observed:
- canonical Scanner = OFF;
- canonical Verifier = OFF;
- Canary = OFF.

No task state or prompt was changed.

This is not attributed to any actor/root cause by this review. Current v4.9.15 already defines own-runtime-disable / launcher-boundary / attribution controls.

The task-persistence dependency is tracked separately in Issue #47 and blocks HF production activation.

### Current verdict

```text
HF live quality gate = PASS
Scanner HF repository staging contract = PASS
Scanner HF adapter composition = PASS
Production entrypoint integration = NOT ENABLED
Canonical Scanner task persistence = BLOCKED / separate control-plane dependency
HF production activation = OFF
```

The next permitted feature step is production-runtime integration review only after the canonical task-persistence blocker is accepted under current live Machine SOT governance.


## V1.10 pre-production evidence freshness and merge hardening — 2026-09-18

### Runtime-evidence freshness gates

Scanner HF preflight now requires normalized snapshot schema:

SCANNER_HF_GATE_SNAPSHOT_V1

New fail-closed checks:
- evidence snapshot timestamp must parse;
- Candidate must be explicitly bound to the current Scanner Run ID;
- CORE lease must contain valid Acquired At / Lock Until and be live at the evidence snapshot;
- Scanner role lease must contain valid Acquired At / Lock Until and be live at the evidence snapshot;
- post-acquire writer recheck must have a valid timestamp;
- post-acquire recheck cannot precede role-lock acquisition;
- post-acquire recheck cannot be later than the evidence snapshot;
- Manifest Created/Frozen timestamps must be valid and ordered;
- Manifest cannot be frozen before the Scanner role lock;
- Manifest cannot be frozen after the evidence snapshot;
- Planner Planned At cannot be later than the evidence snapshot.

This prevents stale or temporally impossible runtime rows from authorizing an HF external call merely because status/fence text appears valid.

### Normalized-evidence boundary

Live _Scan_Planner physical rows use Plan ID / Run Key / Decision / Planned At and do not directly match the internal adapter snapshot shape.

The production caller must normalize live policy evidence into SCANNER_HF_GATE_SNAPSHOT_V1 before calling the adapter.

Raw Sheet rows are rejected.

### Workflow surface reduction

Removed obsolete:
.github/workflows/hf-event-assist-live-uat.yml

Reason:
- it triggered on PR ready_for_review;
- it duplicated the proven manual OIDC UAT workflow;
- it created unnecessary accidental-provider-call surface.

The only controlled UAT workflow remains manual workflow_dispatch.

Regression coverage now prevents reintroduction of the automatic PR-triggered live-UAT workflow.

### Acceptance / rollback documentation

Added:
- docs/HF_PRODUCTION_ACCEPTANCE_PACK_2026-09-18.md
- docs/HF_PR44_MERGE_READINESS_AUDIT_2026-09-18.md

The acceptance pack separates:
- task-persistence acceptance;
- repository merge readiness;
- normalized runtime evidence;
- approved integration surface;
- controlled first production occurrence;
- observability;
- abort conditions;
- rollback.

Merge and production activation remain separate decisions.

### Natural acceptance automation

A one-time read-only acceptance check is scheduled after the 2026-09-18 Asia/Bangkok Verifier 09:30 and Scanner 10:00 natural boundaries.

It must not mutate task state or business truth and must keep HF production disabled unless both natural occurrences are proven.

### Current safe state

HF live quality = PASS
Scanner repository staging = PASS
Production adapter import = blocked by regression
Canonical Scanner/Verifier same-ID mitigation = applied
Natural task persistence = pending
HF production activation = OFF
