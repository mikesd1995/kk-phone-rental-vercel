# Storefront Owner Production Gate — current-main fresh-port (2026-10-03)

## Purpose
Prevent automatic Git production from bypassing the owner visual acceptance boundary while keeping backend/runtime-only production promotion possible through the existing owner-triggered prebuilt workflow.

## Current-main reconciliation
- Base: c65b2993e6cf98bae81065a55f5bd7c1e2e9402d
- Preserves the current V6.20 dynamic storefront asset marker instead of the stale V6.0 hard-coded marker from PR #522.
- Adds `git.deploymentEnabled.main=false` while leaving Preview branch deployments enabled.
- Production workflow resolves the latest READY main production SHA read-only, compares it to the exact candidate, and invokes `scripts/storefront-release-gate.js`.
- Backend/runtime-only candidates pass without storefront owner screenshot approval when no storefront release dependency changed.
- Storefront presentation changes require exact candidate frontend digest, owner ACCEPTED, baseline comparison PASS, screenshot artifact, and all 8 required widths.

## Safety
- production/business writes from this source change: 0
- no booking/pricing/inventory/event truth mutation
- no deploy performed by this fresh-port
- explicit owner-triggered prebuilt production remains the only intended production path after activation
