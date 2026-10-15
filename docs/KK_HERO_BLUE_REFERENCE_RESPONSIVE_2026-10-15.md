# Storefront Hero — owner reference, 2026-10-15 (Asia/Bangkok)

## Request and visual source
- Owner supplied a 1536×543 reference screenshot in the 2026-10-15 conversation.
- Target: navy concert-grid top area, blue-lit bordered hero, bright accessible CTAs, two-column product artwork, three trust indicators, clean KK header with FAQ/theme/TH–EN.
- Keep the existing licensed/owned product bitmap `assets/kk-brand-hero-final-20260920.png` in the separate right artwork panel. This commit does **not** claim pixel-identical artwork to the submitted screenshot, and does not include the screenshot itself as a website asset.
- At phone widths, prioritize readable text, tappable CTA and event discovery over forcing a desktop composite into the first fold.

## Scoped implementation
- `index.html`: add three accessible bilingual visual proof points, retain existing anchors `#content` and `#booking-journey`, refresh stylesheet cache token.
- `assets/kk-storefront-v5.css`: append one named **hero-only** presentation block after the older V6.32 override, with 320/375/390/430/480/768/1024/1440 viewport behavior.
- `script.js`: presentation-only CTA translations, no alteration to event data, modal logic or booking.
- `tests/storefront-hero-editorial-contract.test.js`: regressions for scoped selectors, required bilingual text, cache marker, touch targets and acceptance viewport list.

## Required acceptance
1. Native `node --test tests/storefront-hero-editorial-contract.test.js` and existing affected storefront tests.
2. `Storefront Automated Visual QA` GitHub Actions on the **exact candidate SHA** with screenshots, console errors and metrics for 320,375,390,430,480,768,1024,1440.
3. Check TH/EN, Dark/Light, FAQ, both hero CTAs, overflow, accessible 44px targets, art fit and first event discoverability; record P0/P1 findings before any production release.
4. Independently inspect screenshots against the owner's reference; use actual reviewer + `storefront_visual_qa` ledger receipts from the registered Agent Gateway, not a prose-only substitute.
5. Fresh production readback: same approved Git SHA, Vercel READY, correct cache URL, HTTP resource success and before/after screenshots.

## Non-negotiable safety
- No pricing, owner visibility, event cards, booking, phone inventory, client messages, Google Sheet ACL, Scanner/Verifier or provider writes.
- No new dependency or paid external provider.
- Do not merge/deploy/promote while release gates are incomplete or general P0 release HOLD remains in force (see Issue #49). Owner requested production, but still conditioned release on previously established safety gates.
- PR creation is *candidate staging only*, not production success.

## Acceptance status
- Implementation: committed to an isolated feature branch.
- Unit tests: pending hosted native run at initial record.
- Multi-width browser QA: pending exact-SHA GitHub Actions at initial record.
- Visual owner acceptance: pending before production.
- Production: not deployed by these commits; compare canonical production SHA separately.
- Next continuation: inspect check runs and artifact screenshots, correct any failures, record final state in this PR and Issue #49.
