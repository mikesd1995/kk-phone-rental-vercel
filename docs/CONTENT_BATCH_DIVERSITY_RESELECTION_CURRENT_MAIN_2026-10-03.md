# Content Batch Diversity Reselection — 2026-10-01

## Problem

Issue #385 proved that three independently selected item winners can each pass item QA/Selector while the combined batch is correctly blocked for duplicate hook structure and repeated generic archetypes. Issue #384 proved that event-specific alternatives can pass the same batch gate.

## Change

The batch bridge now performs bounded cross-item reselection only when the independently selected winners fail Batch QA.

- Candidate source is restricted to the existing three candidates for each item.
- Only candidates already marked eligible by the existing item selector are considered.
- Candidate combinations are ordered by total existing selector score, highest first.
- The first combination that passes the unchanged Batch QA is used.
- If no eligible combination passes, the bridge remains BLOCKED with BATCH_DIVERSITY_QA_FAILED.
- No text is generated or rewritten by the reselection step.
- The original item winner remains preferred whenever the initial batch already passes.

## Unchanged acceptance gates

- HOOK_SIMILARITY_THRESHOLD = 0.58
- MAX_GENERIC_ARCHETYPE_REPEATS = 2
- individual Content QA must PASS
- individual Selector must PASS
- Batch QA must PASS
- owner review required
- auto-publish = false
- production writes = 0
- publishes = 0

## Regression coverage

Added tests for:

1. independent top winners collide, but an existing QA-passing alternative combination satisfies Batch QA -> PASS via BATCH_DIVERSITY_RESELECTION;
2. no existing QA-passing combination can satisfy diversity -> remains BLOCKED;
3. existing positive and negative batch tests remain in place.

## Scope

Files intentionally limited to:

- scripts/kk-content-batch-chat-bridge.js
- tests/kk-content-batch-chat-bridge.test.js
- this implementation record

No pricing, inventory, event SOT, storefront, production publishing, or production write path is changed.

## Current-main fresh-port correction — 2026-10-03

PR #410's original Admin Regression exposed two test-fixture defects: one legacy test still expected BLOCKED after reselection had correctly produced PASS; another negative fixture failed item-level QA before it could exercise Batch QA. This fresh-port corrects those fixtures without changing thresholds or safety gates.

Base: c65b2993e6cf98bae81065a55f5bd7c1e2e9402d
Production writes: 0
Publishes: 0
