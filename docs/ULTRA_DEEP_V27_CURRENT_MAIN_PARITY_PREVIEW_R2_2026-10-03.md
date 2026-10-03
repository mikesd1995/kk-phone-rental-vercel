# Ultra Deep V27 current-main parity preview R2 — 2026-10-03

Base main: `8a13bfaa9f5b9f91f4e7dc720385795544994f9c`

Purpose: trigger a zero-cost Preview artifact whose deployable runtime exactly matches current main after PR #591.

Constraints:
- documentation-only branch delta
- no runtime/business logic change
- no production write authorization
- no secret/environment weakening
- no legacy scanner reactivation
- promote only if current main is unchanged and deployable-runtime equivalence is re-proven
