---
name: kk-canary-safety
description: Use for KK Phone Rental Canary, rollout acceptance, zero-write safety verification, evidence validation, and production-readiness checks. Requires scenario-specific proof and never treats synthetic or advisory evidence as production acceptance.
---

# KK Canary Safety

Use this skill for Canary validation and rollout acceptance.

## Core invariant

Canary must not mutate production business state.

Required:
- production writes = 0;
- no synthetic business rows;
- no booking/event/pricing/customer/inventory mutation;
- no Scanner or Verifier mutation;
- no policy activation;
- no notification/provider send unless a separately governed test explicitly permits it.

## Model migration acceptance

A new model family is not, by itself, acceptance evidence. A migration PASS requires scenario-specific shadow/runtime evidence and the same zero-write boundary as any other rollout.

Model capability never expands Canary authority. Canary remains deterministic where possible and production writes = 0 regardless of provider or model.

## Evidence requirements

A PASS must be supported by:
- exact scenario identity;
- current provenance;
- scenario-specific assertions;
- zero-write evidence;
- trusted evidence-surface permissions;
- correct task/runtime attribution when scheduler evidence is involved.

A timestamp, healthy dashboard, successful HTTP call, or synthetic fixture alone is not natural production acceptance.

## External discovery providers

changedetection.io, Exa, Crawl4AI, Firecrawl, and Hugging Face are not production authority.

Canary must verify that:
- provider output remains advisory;
- direct Machine-SOT writes remain impossible;
- failures produce no fabricated success;
- rollback/disable path is preserved;
- the existing Verifier remains final authority.

## Fail closed

If evidence identity, provenance, permissions, or scenario-specific assertions are missing or ambiguous, classification remains BLOCKED/INCOMPLETE rather than PASS.
