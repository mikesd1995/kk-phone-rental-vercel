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
