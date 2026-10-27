# Canonical Rejection Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Finish the durable definitive-rejection to same-identity retry source loop on draft793 while all live senders remain OFF.

**Architecture:** Keep a stable source fence and immutable per-attempt history in the undeployed canonical staged schema. The trusted provider capture adapter records a refusal; existing GAS locked CAS projects it; native confirmation then releases only the next eligible bounded attempt. Unknown outcomes never release retries.

**Tech Stack:** Existing Node built-ins, GAS/Core helpers, PostgreSQL native RPC/constraints, existing Make617 compiler and credential-free CI.

**Spec:** ../specs/2026-10-25-canonical-rejection-retry-spec.md

## Global Constraints

- Same617/gateway/GAS; no new runner, provider request, activation, live DDL/GAS/Make write, protected merge or deployment.
- Preserve v1 UAT source/guards/fixtures; immutable business identity/CreatedAt/dedup and exact-row CAS/locks.
- Freshness120s/future skew15s/original per-attempt TTL120s/provider margin15s unchanged.
- Core default/cap4, rejection429 retry,5/10/20min waits with provider lower bound; unknown/accepted no retry.
- Only verified structured connector response profiles; no invented HTTP body variables or runtime acceptance claims.

## Review Focus

- Old callbacks cannot mutate or complete a new attempt.
- A recorded rejection without exact confirmed Sheet projection cannot become retryable.
- Two simultaneous due claims cannot create two provider attempts for the source.
- Expired/unknown attempts and malformed negative evidence cannot turn into retries.
- Per-attempt timers and same-identity retry due times survive quiet hours and metadata normalization without source re-aging.

### Task1: Coherent rejection/retry contract and executable regressions

Files: canonical gateway/builder, CanonicalOwnerLedger.gs/Core helpers only as needed, staged canonical SQL, canonical Edge allowlist, source/native tests and runbook. These share one security/state-machine interface, so one integrated implementer owns all edits.

- [x] Write failing provider-classification, native attempt/fence/projection and actual GAS/gateway retry-loop tests.
- [x] Preserve RED evidence in the new retry packet.
- [x] Implement stable source + per-attempt records, exact selector across all stages, trusted rejection intake, two-phase Sheet projection confirmation and due retry admission.
- [x] Implement bounded verified response capture binding/handler compiler; default/unbound/unknown fail closed; no Make direct retry.
- [x] Run focused source/native tests and commit a coherent head.

### Task2: Independent verification and draft update

- [x] Root runs targeted/full regression, new JS/GAS syntax and exact native SQL on disposable engine.
- [x] Independent reviewer checks diff, spec, all changed boundaries and failure evidence; fix material findings with targeted rechecks.
- [ ] Push only the existing feature branch, update draft793 and read exact-head hosted CI.
- [ ] Record detailed cross-chat handoff, limits, actual OFF readback and memory update; seal a new evidence packet. Preserve older sealed packets and rejected scratch-cleanup policy; do not retry deletion through another route.
