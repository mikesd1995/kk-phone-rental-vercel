# KK Full Project Cleanup — 2026-10-04

## Goal
Reduce ambiguity and unnecessary work without deleting runtime code merely because a filename/version looks old.

## Evidence-first findings
1. Ultra Deep V2/V3-era modules still have tests, router/registry references, acceptance records or active handoff evidence. They are not safe deletion candidates by name alone.
2. The repository intentionally has two skill classes:
   - `.agents/skills/*`: engineering/runtime-specific procedures already referenced by tests and Code Intelligence.
   - `skills/kk-*/*`: existing product/reliability/operating skills.
   - new `skills/*/SKILL.md`: canonical domain orchestration contracts.
   These are complementary until caller/equivalence evidence proves consolidation is safe.
3. Code Intelligence initially did not route the new canonical contracts/skills into relevant task packs. That meant agents could continue receiving only legacy scoped skills/docs.
4. Vercel ignored-build policy treated `skills/**` as runtime/unknown, causing governance-only skill changes to request builds and consume quota unnecessarily.
5. Admin Regression is currently manual `workflow_dispatch`; older invariant language implying automatic PR/main execution is stale evidence and must not be treated as current trigger proof.

## Repairs performed
- Routed storefront, booking, pricing, discovery, verifier, reliability, deployment and agent-orchestration Code Intelligence routes through the applicable canonical docs/skills.
- Added regression coverage proving storefront/pricing/incident tasks retrieve the new contracts.
- Updated Vercel ignored-build classification so `skills/**` is safe preview-only governance content.
- Preserved fail-safe behavior: runtime, package, Vercel config and unknown paths still require a build; changing the ignored-build guard itself still requires a build.
- Added regression proving skills-only + root-MD governance changes skip Vercel builds.
- Kept the agent-contract drift audit in the normal test suite.

## Deliberately not deleted
- Ultra Deep V2/V3 modules.
- Existing `.agents/skills/*`.
- Existing `skills/kk-*/*`.
- Historical acceptance/recovery docs.
- Existing writers/scanners/verifiers.

Reason: current evidence shows active references or durable historical/runtime value. Deletion requires caller/dependency proof plus regression, not naming/version assumptions.

## Canonical working model
User task -> Code Intelligence context route -> smallest applicable canonical contract(s) + domain skill(s) + existing scoped engineering skill(s) -> existing Agent Gateway/Registry/runtime -> targeted regression -> acceptance -> validated learning promotion.

## Expected improvement
- Less agent context drift between old docs and new authority.
- Lower chance of parallel pricing/booking/design policy.
- Governance-only changes no longer needlessly consume Vercel build quota.
- Runtime architecture remains unchanged.
- Historical evidence is retained without being promoted to current authority.

## Remaining non-cleanup blockers
CI/provider availability and production deployment state are acceptance concerns, not reasons to delete code. Current production acceptance must continue to use fresh exact-head/runtime evidence.

## CI trigger repair (follow-up)
The pre-existing Admin Regression trigger mismatch was repaired in this cleanup branch. `.github/workflows/admin-regression.yml` now runs on governed pull-request changes and main pushes, while retaining manual dispatch. Path filters cover canonical contracts, skills, runtime/config/scripts/tests and workflow/package changes. This makes the existing `npm test`, invariant gate and Code Intelligence benchmark actual PR/main regression evidence instead of a manual-only assertion.

A direct local clone fallback was attempted from the execution environment but failed before checkout because DNS could not resolve github.com. This is environment/network evidence, not a repository test failure. GitHub-side CI remains the canonical exact-head execution path.
