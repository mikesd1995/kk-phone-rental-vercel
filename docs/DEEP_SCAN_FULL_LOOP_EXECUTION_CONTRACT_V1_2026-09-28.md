# Deep Scan Full-Loop Execution Contract V1

Effective 2026-09-28.

A user request to run Deep Scan / Ultra Deep Scan is one end-to-end execution request, not a sequence of conversational checkpoints.

## Required execution loop

1. Resolve requested date range and geography.
2. Discover across the required eight source tiers.
3. Cross-check event identity, date, time and venue; reject conflicts and false positives.
4. Deterministically deduplicate events and source mirrors.
5. Gather exact-event competitor evidence.
6. Normalize competitor identity and package scope; never mix bare device, lens bundle, other devices, per-day and per-round pricing.
7. Build commercial proposal using Pricing Fallback V2 when exact competitors are sparse or absent.
8. Resolve canonical verified poster evidence.
9. Run final Verifier and duplicate guard.
10. If all governed write prerequisites are satisfied, use the existing governed Admin createEvent path only.
11. Verify Web Ready, storefront visibility and exact readback.
12. Record an audit result and then report once to the owner.

## Continuation rule

Do not stop after discovery, pricing, poster collection, or verifier preparation merely to ask the owner to say "continue". Continue automatically through every safe stage authorized by the original Deep Scan request.

If a stage fails, classify the boundary and try the next already-approved evidence-based fallback. Do not weaken production validation to make a test pass.

## Hard-stop conditions

Stop mutation, preserve evidence, and report only when continuation requires a new credential/permission, an explicit governance approval not already granted, an external quota/capacity reset, or when evidence cannot support a safe business write.

A hard stop must report: last successful stage, exact blocker, fallback(s) attempted, production/business writes performed, and the smallest remaining action.

## Reporting rule

Intermediate progress updates are informational only. They are not completion reports and must not imply that the owner needs to prompt the next stage.
