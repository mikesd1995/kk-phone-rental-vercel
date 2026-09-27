# Storefront Mobile UX Audit — 2026-09-27

## Evidence

Recent iPhone screenshots showed two useful design truths:

1. the sticky search behavior is valuable and should be preserved;
2. the sticky/filter block was too tall because the waitlist filter wrapped onto a dedicated second row.

The screenshots also showed excessive above-the-fold chrome from three stacked utility rows (follow-X, FAQ, language) before users reach the event inventory.

## Changes applied in PR #237

### Sticky browse controls

- Keep the search/filter shell sticky on mobile.
- Keep month + status controls on one horizontal row.
- Permit horizontal swipe only when the viewport is too narrow.
- Preserve 16px select text to prevent iOS Safari focus zoom.
- Raise compact filter hit areas to 44px to meet the storefront UX policy.
- Reduce search-result counter spacing and sticky-shell padding.

### Mobile utility hierarchy

Before:
- Follow X
- FAQ
- Language

After:
- Follow X stays full width because it communicates the active rental benefit.
- FAQ and language share the next row.
- This reduces vertical chrome before event inventory without deleting functionality.

### Event-card density

The prior Phase 4 rule collapsed the event grid to one column below 400px. The new breakpoint is 340px.

Reason:
- 375–390px devices can retain two readable columns under the policy minimum card-width budget.
- 320px-class devices still collapse to one column to avoid cramped cards.

### Fixed LINE CTA

- Target compact height: 56px.
- Add iPhone safe-area-aware bottom offset.
- Add matching body bottom padding so the last event remains reachable.

## New governed UX agent

Added `kk-storefront-ux-reviewer` with two gateway tasks:

- `storefront_ux_review`
- `storefront_visual_qa`

It audits:
- horizontal overflow;
- iOS auto-zoom risk;
- sticky viewport obstruction;
- fixed CTA obstruction;
- safe-area handling;
- touch target size;
- filter wrapping;
- event-card density/width;
- above-fold event visibility;
- excessive backdrop blur;
- supplied screenshot observations.

It is read-only and cannot merge/deploy, mutate pricing, booking/inventory, Google Sheets, Apps Script or Machine SOT.

## Acceptance widths

320 / 375 / 390 / 430 / 480 / 768 / 1024

## Remaining evidence gap

Automated browser screenshot capture is not yet wired. Therefore GitHub source/regression success is necessary but is not treated as final visual proof. A Preview or Production screenshot/browser check is still required before calling the visual change fully accepted.


## Validation checkpoint

- First regression run exposed one stale 400px breakpoint assertion after the policy moved the one-column threshold to 340px.
- The stale assertion was corrected rather than reverting the UX change.
- GitHub Admin Regression run #751: PASS at commit `eef96561b041e541db283c0a8e6b6fd84c4b9f0b`.
- This documentation checkpoint records the successful retry and intentionally gives Vercel one fresh opportunity to evaluate Preview capacity.
