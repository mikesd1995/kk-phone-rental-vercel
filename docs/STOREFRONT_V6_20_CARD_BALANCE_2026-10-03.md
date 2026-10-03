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
