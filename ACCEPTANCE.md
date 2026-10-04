# KK Phone Rental — Acceptance Contract

## Definition of done
A change is done only when the smallest applicable acceptance set below is satisfied. A commit, green build, mergeable PR, preview URL, deployment request or successful API call alone is not acceptance.

## Universal gates
- Requested behavior implemented without unrelated scope drift.
- Relevant safety/business invariants preserved.
- Targeted regression passes; broader regression runs when risk requires it.
- Material fixes have independent review.
- No unresolved P0/P1 defect in the affected surface.
- Evidence identifies the exact code/deployment/data version being accepted.

## Storefront/UI
- Conforms to `DESIGN.md`.
- Required UX review ran before implementation.
- Visual QA passes representative mobile plus required wider viewports.
- Thai/English and Light/Dark parity are checked when affected.
- Search, image failure, loading/empty/error and accessibility states are checked when affected.
- Fresh production evidence is required before saying the change is live.

## Booking/pricing/inventory
- Canonical row/entity identity is known before repair.
- Governed writer/authority is used.
- Exact readback matches intended mutation.
- Booking/day locks, tombstones and availability invariants remain intact.
- Revenue semantics remain: Actual=completed; Future=pending/confirmed/prepared/picked_up/returned/uploaded; Forecast=Actual+Future; cancelled/no_show/blank excluded.

## Discovery / Ultra Deep
- Required source universe/coverage executed with reconciliation.
- Known-miss regression passes.
- Commercial evidence and Verifier gates pass before governed publication.
- No discovery-only evidence is represented as final truth.
- Full-loop acceptance requires end-to-end evidence, not scanner success alone.

## Learning
A durable lesson may be promoted only when:
1. evidence is preserved;
2. root cause or decision rationale has explicit confidence;
3. a repair/rule is concrete;
4. regression or measurable validation exists;
5. the target authority layer is identified;
6. protected policy is not silently changed;
7. review/approval required by that layer is satisfied.

Otherwise status is CANDIDATE/BLOCKED, never LEARNED_AND_ACCEPTED.

## Release status vocabulary
Use: NOT_STARTED -> IMPLEMENTED -> LOCALLY_VERIFIED -> PR_VERIFIED -> DEPLOYED_UNVERIFIED -> PRODUCTION_ACCEPTED.
Do not collapse these states.
