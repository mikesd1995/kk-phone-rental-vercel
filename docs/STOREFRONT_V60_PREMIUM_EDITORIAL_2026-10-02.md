# Storefront V6 — Premium Concert Editorial — 2026-10-02

## Why
Production V5.9 was rejected from real iPhone screenshots. Technical visual checks passed but the visual system was over-controlled, dark-heavy and the booking modal read like an admin surface.

## 2026/27 research direction
- quiet/slow browsing: fewer elements and clearer hierarchy
- performance as perceived quality
- expressive but legible typography
- poster/product imagery as primary content
- adaptive light/dark, accessibility and purposeful motion rather than decorative effects

## Applied
- Light-first warm neutral canvas with ink/blue accents; dark remains optional.
- Simplified header controls and removed logo/control-panel styling.
- Removed decorative hero geometry/signatures and reduced first-fold height.
- Search and filters use restrained pill controls without stacked chrome.
- Poster-first catalogue: transparent cards, larger poster presence, minimal metadata.
- Booking modal rebuilt as compact mobile bottom sheet; removed generic phone icons and nested cards; package rows become clean commerce rows.
- Booking/event/price/inventory data paths are unchanged.

## Evidence policy
Do not call this visually accepted from geometry tests alone. Exact-head screenshots must be inspected against the production rejection evidence before merge/deploy.
