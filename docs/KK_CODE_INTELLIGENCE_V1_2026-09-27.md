# KK Code Intelligence v1 — 2026-09-27

## Objective

Reduce coding-context/token waste and improve engineering consistency without adding a new autonomous coding authority.

The v1 baseline is deterministic, local, zero-cost and dependency-aware.

## Problem

Recent KK changes increasingly require reading many source files, tests, historical docs and runtime contracts. Broad retrieval wastes context and makes long coding sessions more likely to hit response/context limits.

The main problem is not model capability. It is context selection.

## Architecture

    task description
      -> subsystem route scoring
      -> repo/dependency map
      -> bounded context pack
      -> scoped engineering skills
      -> change plan
      -> minimal implementation
      -> targeted tests
      -> full regression when risk requires it
      -> review/readback

## Added

### Root engineering contract

AGENTS.md defines:
- context-first workflow;
- 18k estimated-token / 12-file default budget;
- symbols/ranges-first behavior for large files;
- Planner -> Implementer -> Reviewer discipline;
- preserved business/runtime authority boundaries;
- targeted tests before broad/full regression;
- no semantic retriever until benchmarked.

### Context route registry

config/kk-code-context-routes.json maps common KK tasks to:
- primary source files;
- regression tests;
- scoped skills;
- current contract docs.

Covered domains include:
- Admin;
- Storefront;
- Booking/inventory;
- Event visibility;
- Pricing;
- Content;
- Discovery Scanner;
- Verifier;
- Canary;
- Reliability/debugging;
- Hugging Face;
- Runtime ledger/Supabase;
- Deployment;
- Apps Script;
- Agent orchestration.

### Dependency-aware repo map

server/kk-code-intelligence.js and scripts/build-repo-map.js:
- walk the repo without external packages;
- parse relative CommonJS/ESM imports;
- compute dependency and reverse-dependency edges;
- extract basic JS/TS symbols;
- estimate file token size;
- mark large files for symbols/targeted-range reads first.

The default code:map cache is local under .cache and is gitignored.

### Context pack

Run:

    npm run code:context -- "<task>"

The output contains:
- matched subsystem routes;
- bounded selected files;
- estimated and budgeted tokens;
- symbols where available;
- read strategy per file;
- targeted tests;
- scoped skills;
- current docs;
- full-regression requirement.

Large files get a bounded allocation instead of assuming the whole file should enter context.

### Targeted tests

Run:

    npm run code:test -- "<task>"

The selector uses the same task routes to run the smallest known relevant regression set. Unknown tasks fail safely to full npm test.

### Scoped engineering skills

Added:
- kk-code-change;
- kk-debugging;
- kk-code-review;
- kk-production-release;
- kk-supabase-migration.

These keep detailed procedure out of every prompt and load only for the relevant task.

### Retrieval benchmark

tests/fixtures/kk-code-intelligence-benchmark.json contains representative KK engineering tasks.

Run:

    npm run code:benchmark

The v1 acceptance floor is:
- route recall = 100%;
- required-file recall >= 95%;
- max context budget <= 12k estimated tokens;
- max selected files <= 10.

CI runs this benchmark on every PR/main change.

## Hugging Face policy

No new HF code model is enabled in v1.

Reason:
- deterministic routing already solves the first-order token problem;
- semantic retrieval adds inference/runtime complexity;
- a model should not be adopted without evidence that it improves required-file recall or reduces token cost.

A future semantic retriever must run against the checked-in benchmark and beat the deterministic baseline without creating unacceptable false negatives.

Suggested evaluation dimensions:
- route/file recall;
- average selected tokens;
- max selected tokens;
- false-negative rate on safety-critical files;
- latency;
- monetary/runtime cost.

## Why no Turborepo/Eve/Workflow migration in v1

The current repo is not a large multi-package monorepo, so Turborepo caching would add limited value relative to context routing.

Eve and durable Workflow remain candidates for future agent/runtime architecture, but migrating production Scanner/Verifier now would mix infrastructure migration with a token-efficiency change and increase risk.

v1 deliberately improves engineering retrieval without changing runtime authority or production topology.

## Safety

This implementation does not:
- mutate Machine SOT;
- change Scanner/Verifier task state or schedules;
- change pricing/booking/inventory;
- change Supabase schema/data;
- add a production API function;
- add a production dependency;
- enable HF inference;
- publish content;
- deploy business logic by itself.

## Expected improvement

Before:

    task
      -> broad repo search
      -> many source/docs/tests opened
      -> repeated context reconstruction
      -> long response/tool chains

After:

    task
      -> bounded context pack
      -> 5–10 high-value files/ranges
      -> targeted tests
      -> expand only when evidence requires it

The benchmark result recorded by CI is the source of truth for actual v1 retrieval size/recall.
