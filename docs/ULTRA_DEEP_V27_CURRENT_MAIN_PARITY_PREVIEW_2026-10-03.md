# Ultra Deep V27 current-main parity preview — 2026-10-03

Purpose: create a zero-cost Preview artifact whose deployable runtime is exactly current main, while recording the recovery evidence rather than changing production behavior.

Base main: `036eaf6bb56f18745b1dd1c8dee5e4b7c11bdc1a`

Constraints:
- documentation-only branch delta
- no runtime/business logic change
- no production write authorization
- no secret or environment weakening
- no legacy scanner reactivation
- candidate may be promoted only after runtime-equivalence, Production OIDC, and read-only acceptance gates pass

This branch exists only to establish a promotable READY artifact for the already-merged V27 + booking E2E source lineage.
