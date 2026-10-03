# Storefront V6.20 — card and month balance — 2026-10-03

Owner iPhone screenshots showed paired catalogue cards ending at different vertical positions because content rows had variable heights, and the month selector label was not optically centered.

## Fix
- Stretch each two-column grid row and both cards to the same row height.
- Reserve consistent date, title, venue and availability line boxes.
- Let metadata consume remaining space and pin price/availability/CTA rhythm toward the card bottom.
- Center the month selector using flex alignment plus centered select text while preserving its 44px touch target and native dropdown affordance.
- Presentation only: no pricing, inventory, booking, availability, event visibility or production-write changes.
