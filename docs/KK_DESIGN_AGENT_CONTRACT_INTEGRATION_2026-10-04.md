# KK Design + Agent Contract Integration — 2026-10-04

## Scope
Integrated a repository-native DESIGN.md / scoped-skill governance layer into KK Phone Rental without replacing the existing Agent Registry, Agent Gateway, Scanner/Verifier, project memory, pricing engine, booking guards, writers, or Visual QA runtime.

## Compatibility audit
Validated the new root contracts against current executable authority:
- booking price lock remains protected;
- owner-hidden/tombstone no-resurrection remains protected;
- revenue buckets remain Actual=completed and Future=pending/confirmed/prepared/picked_up/returned/uploaded, with cancelled/no_show/blank excluded;
- storefront UX and seven-reviewer Design Council continue to use existing registered Gateway routes;
- DESIGN.md is mobile-first, bilingual, Light/Dark aware, image/search/FAQ/state aware, and explicitly avoids coupling the brand to one device model;
- production acceptance remains distinct from build/preview/deployment success;
- learning may propose/adapt only inside existing protected-policy boundaries.

## Defect found and repaired
The initial pricing skill described a comparable-event/prior-month/base-price fallback sequence more broadly than the current executable final-pricing engine. That could allow an AI coding agent to infer a parallel final-price policy.

Repaired `skills/pricing/SKILL.md` so executable pricing code and Machine SOT are authoritative. Current final-price delegation is:
1. exact-event competitor evidence -> executable exact-event median policy;
2. no exact-event evidence -> current approved rental-fit score fallback;
3. otherwise current approved/active package baseline;
4. preserve HOLD when executable policy cannot resolve an approved price.

Comparable artist/fandom/type/venue/seat-map evidence may inform evidence collection/scoring or a separately approved future policy change, but is not independent final-price authority.

## Continuous drift protection
Added `scripts/kk-agent-contract-audit.js` plus `tests/kk-agent-contract-audit.test.js`.

The audit fails closed when root contracts/skills disappear or when critical documented contracts drift from executable evidence for:
- pricing authority/fallback;
- booking price lock;
- tombstone/no-resurrection;
- revenue buckets;
- registered storefront UX/Design Council reuse;
- multi-device brand compatibility;
- production acceptance semantics.

The audit performs zero production writes and zero business-data mutations. Because it is a normal `tests/*.test.js` test, any workflow or local run executing `npm test` automatically executes the contract audit.

## CI caveat discovered
At audit time, `.github/workflows/admin-regression.yml` on this branch is configured with `workflow_dispatch` only, while an older continuous-invariant assertion describes PR/main execution. This is a pre-existing CI trigger/evidence mismatch and was not silently changed in this integration. Contract validation was therefore attached to the normal test suite rather than depending on that workflow trigger.

## Acceptance status
- Source compatibility: verified after pricing repair.
- Business-data mutations: 0.
- Production writes: 0.
- Runtime replacement agents/SOTs introduced: 0.
- Final PR/CI/deployment acceptance: requires fresh head checks and, where applicable, production evidence.
