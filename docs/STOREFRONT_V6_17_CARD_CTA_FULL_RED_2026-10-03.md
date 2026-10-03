# Storefront V6.17 — card CTA balance + full red state — 2026-10-03

Evidence: owner iPhone screenshot at 17:38.

## Findings
- Card CTA text (“ดูอุปกรณ์ที่ว่าง / จองคิว” and “จองคิวหลุด”) was visually top/left biased inside the outlined box because multiple legacy mobile rules alternated `.pi-tap` between inline-flex, block, 38/40/44px heights and different padding.
- Fully-booked cards were mostly neutral gray/black, so the unavailable state did not read strongly enough.

## Fix
- Normalize every card CTA to a full-width 48px minimum flex container with centered text/arrow, multiline-safe wrapping and balanced padding.
- Use auto top margin so CTA aligns consistently at the bottom of variable-height card copy.
- Fully booked CTA uses red-tinted surface/border/text.
- Fully booked top badge uses solid red.
- Fully booked availability line uses red.
- Add dark-theme red variants with accessible contrast.
- CSS cache marker: `20261003-v617-card-cta-full-red`.

## Preserved
No event availability calculation, price, booking, waitlist, inventory, event visibility, LINE destination/payload, API or production-write behavior changed.
