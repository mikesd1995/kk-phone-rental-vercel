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
