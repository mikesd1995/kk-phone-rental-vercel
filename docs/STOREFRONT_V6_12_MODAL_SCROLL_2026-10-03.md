# Storefront V6.12 — Centered modal + scroll restoration

Date: 2026-10-03
Evidence: owner iPhone Safari screenshot after V6.11 production.

## Confirmed defects
1. Mobile package dialog was still intentionally forced to a bottom sheet by the legacy `@media(max-width:700px)` rule using `align-items:flex-end`.
2. Close flow restored `window.scrollY` first, then called `focus()` on the originating event card. Mobile Safari can scroll the focused element into view after the explicit scroll restoration, overriding the intended position.

## Fix
- mobile package and FAQ overlays now center their dialogs
- retain internal modal scrolling and safe-area clearance
- retain 44px close/actions
- `restoreFocus()` now requests `focus({preventScroll:true})`, with compatibility fallback
- existing body lock still records `modalScrollY` and restores it on close
- stylesheet cache marker advanced to `20261003-v612-centered-modal-scroll-fix`

## Preserved
No pricing, inventory, availability, booking, event visibility, LINE payload, API, Sheets or production-write semantics changed.

## Acceptance
- open a card after scrolling down the catalogue
- modal is centered in viewport, not attached to bottom edge
- close by X / Close / backdrop / Escape
- viewport returns to the same catalogue position rather than top or refocusing with scroll
- TH/EN and light/dark remain functional
- modal remains internally scrollable on short screens

Rollback: revert V6.12 CSS block, restore prior restoreFocus implementation and V6.11 cache marker.
