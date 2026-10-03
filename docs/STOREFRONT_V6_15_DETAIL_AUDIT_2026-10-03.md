# Storefront V6.15 — exhaustive detail audit — 2026-10-03

## Scope
Final storefront-only audit after owner real-device screenshots. No pricing, inventory, booking, availability, event visibility, API, LINE destination, Sheets, Make, or production-write semantics changed.

## Findings and corrections
1. **Theme/language first-paint flash** — persisted dark theme and EN preference were applied only after deferred `script.js` executed, so users could briefly see the wrong theme/language shell. Added a tiny defensive head bootstrap before CSS to set `html[lang]`, `data-theme`, and theme-color from URL/localStorage before first paint.
2. **Stale JS cache lineage** — HTML still requested `script.js?v=storefront-v67-lower-page-finish-20261003` even after V6.14 i18n work. Bumped both JS and CSS cache markers to V6.15 so real devices cannot remain on a stale storefront script.
3. **320–359px readability** — legacy short-phone rules could compress four benefit cells and microcopy too aggressively. Narrow phones now use a 2×2 benefit grid with readable 10.5px copy while retaining 44px touch targets.
4. **320–359px header pressure** — tightened brand typography and normalized FAQ/theme/language controls so the header fits narrow iPhones without sacrificing touch target size.
5. **Keyboard/accessibility focus** — added a consistent `:focus-visible` ring to interactive storefront controls, including language, filters, modal actions, booking CTA and LINE CTA.
6. **Long localized/modal strings** — added safe wrapping for modal/package text so TH/EN content cannot force horizontal overflow.
7. **Motion preference** — reinforced `prefers-reduced-motion` behavior for transitions/animations and smooth scrolling.
8. **iOS modal/sticky behavior** — retained momentum scrolling inside modal and safe-area handling.

## Preserved invariants
- Package prices and package availability are unchanged.
- Booking and waitlist semantics are unchanged.
- Event visibility and storefront SOT are unchanged.
- LINE destination/payload behavior is unchanged.
- No external business-data mutation is introduced.
- Modal scroll restoration remains JS-owned.

## Acceptance
- Source audit: index, authoritative V6 stylesheet and i18n/runtime script.
- Required runtime checks: exact-head Vercel Preview HTTP 200 + V6.15 asset marker.
- GitHub automated Visual QA/Admin/Memory results must be reported as observed; pre-step runner failures are not treated as visual regressions.
- Production promotion only after preview is reachable and PR remains mergeable.


## Production acceptance — 2026-10-03
- Squash merge commit: `633df565dcf6ec9cf66d3d784245a4badff961ab`.
- Vercel production deployment: `dpl_Fbq721EoikAeVKaqhKd2tWwWwpmf`.
- Deployment state verified: `READY`, target `production`.
- Canonical storefront `https://kk-phone-rental.vercel.app/` verified HTTP 200.
- Canonical HTML verified to reference both V6.15 cache markers:
  - CSS: `20261003-v615-detail-audit`
  - JS: `storefront-v615-detail-audit-20261003`
- This proves the V6.15 production lineage is live. It does not fabricate a rendered-device/interaction PASS; no exact-merge GitHub workflow runs were returned for the merge SHA at verification time.
