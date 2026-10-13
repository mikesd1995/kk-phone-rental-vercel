# Storefront visual evidence and mobile price repair — 2026-10-13

Scope: source/local QA only; no production, business data, event visibility, package prices or modal product behavior changed. Baseline 80975dee2435aadb9bd4283b0bfa23bd97424c20, current-main d6dc3bfe4cc0c4dd6fdfec407823752da0572464.

The baseline actual eight-width Gateway visual run is retained at `outputs/visual-current-main-80975de` outside the checkout. Every viewport has UX review, visual QA and design council receipts with exact local persistent readback; the seven registered reviewers actually executed. Technical QA failed at six widths; owner rendered-candidate approval remained separately blocked.

The genuine product defect was narrow English price/ask text inheriting `white-space:nowrap`. Mobile CSS now permits complete text wrapping without reducing font size or hiding prices. CSS marker is paired with index and source assertions; script marker remains unchanged because script behavior is unchanged.

Three measurement mismatches were verified against rendered Chrome and current owner-corrected CSS:

- Offscreen `content-visibility:auto` cards retain descendants larger than their 350px placeholder. The audit now materializes every bounded card for geometry under a reversible local style override, preserves pre-materialization first-fold discovery, and restores inline value/priority on success or error. Later-card actual escapes still block.
- V6.12/V6.13 explicitly implements owner-centered mobile dialogs. The stale bottom-sheet invariant is replaced by measured vertical centering tolerance 4px, retaining viewport, horizontal overflow, focus, title and touch target gates. Product modal positioning is unchanged.
- Nested temporary brand art intentionally occupies 70% of an exact-event summary. The full-rail poster coverage gate now applies to direct poster images. Temporary summaries require actual bounded, loaded artwork, visible label/title/metadata and exact event identity; invalid summaries block. Untreated direct-poster letterboxing still blocks. Degraded official-poster delivery remains truthful deferred P2 when safe fallback renders.

Manual browser regression: `node scripts/storefront-evidence-browser-regression.cjs` using the same optional Playwright/Chrome environment as the existing visual runner. No new dependency is added. It proves all eight synthetic offscreen cards are audited, a later real escape is found, styling restores after error, missing temporary labels and direct poster letterboxing block, and complete English text fits at 320/375/390/430/480px. Red before CSS fix: 375px scrollWidth291 vs clientWidth146; green after fix: all cases. Synthetic fixtures are regression evidence, not production or screenshot acceptance.

Final verification must retain exact-commit eight-width top/sticky/English/dark/footer/modal screenshots and fresh registered Gateway results. Owner approval and production runtime/readback cannot be inferred from local tests or corrected metrics. Hosted jobs at 80975de were rejected before starting for account payment/spending-limit state; no gate bypass or rerun loop is allowed.
