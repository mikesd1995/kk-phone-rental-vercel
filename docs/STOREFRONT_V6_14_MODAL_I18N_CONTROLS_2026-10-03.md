# Storefront V6.14 — Modal i18n + control contrast

Date: 2026-10-03
Evidence: owner iPhone Safari screenshots at 17:04 after V6.13 production.

## Confirmed defects
1. Dark-mode booking CTAs rendered near-white background with white text. Root cause: `.book-pill` used `background:var(--v6-ink)`; in dark theme `--v6-ink` becomes near-white while button text remained white.
2. English modal leaked Thai package helper/use-case text because feed-provided `use_case` was rendered verbatim regardless of UI language.
3. TH/EN segmented switch was visually unbalanced due to accumulated legacy responsive rules and unequal container geometry.

## Fixes
- explicit dark-theme booking CTA: blue background + white text
- EN package subtitle rejects Thai-only feed helper copy and falls back to localized package tagline
- TH mode continues to use valid Thai feed helper copy
- mobile language switch locked to a 94px two-column segmented control with two equal 44px targets
- active/inactive geometry is identical; 44px minimum interaction size preserved
- cache marker: `20261003-v614-modal-i18n-controls`

## Preserved
V6.12 scroll restoration and V6.13 centered modal/layout remain intact. No pricing, inventory, availability, booking semantics, event visibility, LINE destination/payload, API, Sheets, or production-write behavior changed.

## Acceptance
Dark/light + TH/EN; active package CTA contrast; no Thai package helper text in EN; equal TH/EN segment geometry; modal close returns to prior catalogue position.
