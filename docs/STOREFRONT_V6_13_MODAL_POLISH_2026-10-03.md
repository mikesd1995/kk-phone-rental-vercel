# Storefront V6.13 — Owner screenshot modal polish

Date: 2026-10-03
Base: V6.12 production `4147f0d9ae0c9b302d62358faef84a55deeb0804`

## Evidence
Owner iPhone Safari screenshots at 15:30 confirm V6.12 behavior is live: modal is centered. They also expose remaining visual polish debt inside the package dialog.

## Findings and fixes
- Dialog was still visually oversized: cap mobile dialog at 80dvh / 720px and 520px width.
- Title/meta hierarchy was too heavy: reduce title and metadata scale while preserving readability.
- Package rows had an oversized right rail and inconsistent balance: use a proportional 36% action column.
- Price/button relationship was visually bulky: reduce price type and make booking action fill its rail consistently.
- Disabled/fully-booked package buttons had very low white-on-white contrast in dark mode screenshots: add an explicit readable disabled treatment with full opacity.
- Utility actions were taller/heavier than necessary: normalize to 44px.
- Add a <=389px refinement for narrow iPhones.

## Preserved
V6.12 centered positioning and scroll restoration remain unchanged. No changes to pricing, inventory, availability, booking semantics, event visibility, LINE payload, API, Sheets, or production writes.

## Acceptance
TH/EN + light/dark; 360/390/430 widths; disabled and available package states; internal scroll on short screens; close returns to original catalogue position.
