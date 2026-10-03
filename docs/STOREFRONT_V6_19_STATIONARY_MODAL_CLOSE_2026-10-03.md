# Storefront V6.19 — stationary modal close — 2026-10-03

## Root cause
V6.16 captured the correct scroll position, but locked the page with `body{position:fixed;top:-scrollY}`. On close it removed the fixed positioning before `window.scrollTo()`. Mobile Safari could paint that intermediate state at document scrollY=0, so the user visibly saw the page jump upward and then return.

Repeated requestAnimationFrame/timeout scroll restoration corrected the final coordinate but could not remove that intermediate paint.

## Fix
- Remove fixed-body / negative-top modal locking.
- Lock scrolling with `html/body overflow:hidden` and body `touch-action:none`, preserving the document's existing coordinate space.
- Keep captured X/Y only as a drift guard; call scrollTo only if the viewport actually differs by >1px.
- Preserve focus `preventScroll` behavior.
- No changes to modal semantics, pricing, booking, inventory, availability, event visibility or production business writes.

## Acceptance target
Closing package/FAQ modal on iPhone Safari must reveal the same catalogue viewport without any top-of-page frame or animated correction.
