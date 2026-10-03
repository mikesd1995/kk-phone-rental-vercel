# Storefront V6.16 — exact modal scroll return — 2026-10-03

## Evidence
Owner iPhone Safari screen recording at 17:37–17:38 shows the package modal closing and the catalogue visibly moving before settling. The expected behavior is a stationary catalogue: close the modal and reveal the exact viewport that was behind it.

## Root cause
V6.12 restored `window.scrollY` once after releasing a fixed body, then restored focus. Mobile Safari can apply deferred visual-viewport/focus corrections after that synchronous `scrollTo`, causing a visible jump/slide even though the stored Y coordinate itself is correct.

## Fix
- capture both X and Y before body lock
- lock body with matching negative X/Y offsets
- on unlock, restore the captured coordinates immediately, on two subsequent animation frames, and once after the short Safari viewport-settle window
- remove the plain `.focus()` fallback: if `focus({preventScroll:true})` is unsupported, skip focus restoration instead of allowing Safari to scroll the originating card into view
- bump the script cache marker to V6.16 so iPhone Safari cannot retain the old close logic

## Preserved
No pricing, booking, inventory, availability, event visibility, LINE payload/destination, API, Sheets or production-write semantics changed.

## Acceptance
On iPhone Safari: scroll to a mid-catalogue card, open package modal, close with X and Close button. The catalogue must reappear at the same viewport with no top jump and no animated slide back down.
