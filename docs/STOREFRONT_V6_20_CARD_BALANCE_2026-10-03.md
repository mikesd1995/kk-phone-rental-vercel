# Storefront V6.20 — card and month balance — 2026-10-03

Owner iPhone screenshots showed paired catalogue cards ending at different vertical positions because content rows had variable heights, and the month selector label was not optically centered.

## Fix
- Stretch each two-column grid row and both cards to the same row height.
- Reserve consistent date, title, venue and availability line boxes.
- Let metadata consume remaining space and pin price/availability/CTA rhythm toward the card bottom.
- Center the month selector using flex alignment plus centered select text while preserving its 44px touch target and native dropdown affordance.
- Presentation only: no pricing, inventory, booking, availability, event visibility or production-write changes.


## Production promotion attempts
- Merge commit: `90e0dfaf8ab95ee56bbf9a946c272d1b97483f7a`; no Vercel deployment record materialized on first verification.
- Main runtime retrigger: `7b17022daeae8417ef6372995a3f5286842c1e6a` with marker `20261003-v620-card-balance-r2`; no deployment record materialized on verification.
- Fallback fresh branch event: `deploy/storefront-v620-recovery-20261003` at `d71e406e4af15ce3869ed6419bac7251e3101604`; no deployment record materialized on verification.
- Current main source contains both V6.20 card-balance CSS lineage and V6.19 stationary-modal-close JS lineage. No business semantics were changed by the recovery attempts.
- Production is not claimed until an exact/newer main deployment is READY and canonical readback serves V6.20.


## Production recovery escalation — prebuilt path
- At 2026-10-03 19:30 ICT, Vercel deployment inventory still showed no deployment newer than production V6.18 (`dpl_GGWV71TkVccvXj3DWpMtAvC9mbhJ`).
- Direct Vercel MCP deploy remained unavailable at runtime (`Tool deploy_to_vercel not found`).
- Used the repository's existing owner-authorized zero-cost prebuilt production workflow as fallback by commenting `/run-v60-prebuilt 923deb95ae32f9e22bd193ef193a027aca17799e` on Issue #213.
- Workflow run `37123113729` was created for the exact current main SHA but failed before exposing step/log detail (`steps=null`, `logs_url=null`). No production deployment was created by that attempt.
- V6.20 remains merged and source-complete; production promotion remains blocked by execution/integration infrastructure, not by the card-balance CSS itself.


## Runner fallback diagnosis — 2026-10-03 19:32 ICT
- The prebuilt workflow was pinned from `ubuntu-latest` to `ubuntu-24.04` at `4aa03d940ffd6a3bb4fc5c314f3af5daa4c08b9a` and retriggered. Run `37123205880` still failed before any step was exposed (`steps=null`, `logs_url=null`).
- A second fallback pinned the same workflow to `ubuntu-22.04` at `15e6be162153bb9ed313445d2204a9915bd2d3b9`. Run `37123235310` produced the same pre-step failure.
- Because two explicit GitHub-hosted runner images fail identically before checkout while other issue-comment workflows can enter `in_progress`, changing the storefront code or repeating deploy commands is not evidence-based. The remaining blocker is GitHub Actions job provisioning/quota/policy for this production job path.
- No production deployment was created; canonical production remains the last READY deployment. V6.20 source remains intact on main.


## Preview-promotion fallback
- Audited the existing `Storefront V6 Zero Cost Promote` path. It can promote an already-READY preview only when the candidate runtime is byte-equivalent to current main and the workflow runner is available.
- Created fresh V6.20 candidate branch `deploy/storefront-v620-preview-promote-20261003` at `17d490e2291af2f48242d5ed042c6344f7224510` with marker r4 to attempt this alternate route.
- Vercel did not create a deployment record for the fresh candidate either. Therefore there is no V6.20 READY preview that can be safely promoted, and promoting an older READY preview would roll back the V6.19/V6.20 runtime changes.
- This closes the safe automated fallbacks currently available without fabricating a deployment or reverting current storefront fixes.


## Production acceptance — recovered
- Production deployment `dpl_F63iiVxWHPXkby1kKegRHBStncfC` for main `c0e5174130d93bd267ff33ee1ef1e6ba583a2a0b` is `READY`, target `production`, with canonical alias `kk-phone-rental.vercel.app` and `aliasError=null`.
- Canonical root returned HTTP 200 and serves CSS marker `20261003-v620-card-balance-r2` plus JS marker `storefront-v619-stationary-modal-close-20261003`.
- Production CSS readback confirms V6.20 invariants: stretched mobile grid, 100%/stretch cards, reserved title height, and centered native month-select text.
- Production JS readback confirms V6.19 overflow-based modal lock and confirms the prior fixed-body/negative-top lock is absent.
- Source/readback acceptance is PASS. Real-iPhone rendered visual acceptance remains owner/device evidence and is not inferred from source readback.
