# KK Stable Business V1 — Mobile Month Selector Integration (2026-10-19 ICT)

## Scope and ancestry
- Baseline: Draft integration PR #766, exact SHA `1e22775bf00349c7823b750fb1b896abb49520ca` (not main or production).
- Cherry-port concept from Draft PR #767 (month typography only); do not merge whole #767 because it was based on older main and had unrelated visual QA failures.
- Changed only `assets/kk-storefront-v5.css`, `index.html`, `script.js`, and added `tests/storefront-month-select-mobile-typography.test.js` plus this evidence note.
- Existing current Hero/theme and the 111-file integration from #766 are inherited unchanged except the scoped additions listed above.

## Defect and fix
- On mobile the selected month text was visually too large for the filter pill.
- Visible text is 14px via `month-select-wrap::before`, while the real select remains 16px to avoid iOS Safari focus zoom. The 44px tap target and native picker are preserved.
- `renderMonthSelect` mirrors the selected/localized option to `data-month-display`; normal re-renders refresh it after filtering/language changes.
- Asset query versions updated so stale browser CSS/JS cannot mask the change.

## Verification performed at source-construction time
- All three baseline file contents and PR #767 donor files read directly from GitHub; exact replacement anchors asserted unique.
- Source CSS marker, both font sizes, source test, and exact index script/CSS cache bust were statically checked before commit.
- This is NOT a Node test run, visual/browser verification, current owner acceptance, or production release.

## Required gates
1. Exact-head `node --test tests/storefront-month-select-mobile-typography.test.js`, `npm test`, `npm run check`, `npm run postinstall` with zero additional spend.
2. Browser screenshots/interaction at 320/375/390/430/768/1440px in Thai/English, light/dark; native 16px, visible 14px, 44px tap height, focus/selection/keyboard, 320px truncation and horizontal overflow.
3. Compare all 64 baseline PR #766 screenshots and P0/P1 visual critic output; no regression in Hero, posters, modals, booking CTA.
4. Owner visual signoff; only then consider integrating with #766 and a separately approved Production release/readback.
5. Security ACL Core/Drive, revenue private reader and canonical booking/LINE provider acceptance remain separate P0 HOLD. No merge, deploy, ACL, Booking, customer, automation, payment or paid service changes.

## Rollback
- Revert only this scoped commit/branch; PR #766 SHA `1e22775bf00349c7823b750fb1b896abb49520ca` remains untouched and is the exact pre-change reference.
