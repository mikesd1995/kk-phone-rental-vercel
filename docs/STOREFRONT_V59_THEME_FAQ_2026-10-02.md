# Storefront V5.9 — Mobile hierarchy, theme switch, FAQ promotion (2026-10-02)

Evidence source: owner-provided iPhone production screenshot.

Changes:
- Keep FAQ as a top-level header action and remove the duplicate footer FAQ CTA.
- Add persisted Light/Dark theme toggle using localStorage key `kk_public_theme`, with system preference fallback.
- Update browser theme-color with the active theme.
- Tighten mobile hero, browse controls, catalogue spacing, and remove sticky browse behavior on phones so event posters enter the viewport sooner.
- Preserve 44px interaction targets and 16px search/select anti-iOS-zoom contracts.
- No pricing, booking, inventory, event, availability, customer, or admin business truth changes.

Acceptance: Admin Regression + Storefront Automated Visual QA must pass before merge. Production requires post-merge readback.
