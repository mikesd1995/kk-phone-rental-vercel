# Storefront rendered acceptance follow-up

Starting candidate: PR #462, `ee1bb716d06549323674ecb809d301a5d5e5027f`.

## Reproduced failures

- The general theme span display rule overrode the light-theme moon visibility rule. Both icons rendered despite source-string tests passing.
- Inherited search positioning overlaid the SVG and input text. Inherited date borders and button shadows also survived the presentation reset.
- Full-width desktop posters made each of the two catalogue columns excessively tall. Cards now use an internal poster/detail layout above 900px while the catalogue remains two columns.
- Brand and modal targets were below 44px. Narrow mobile filters could overlap even without page-level horizontal overflow.
- Hero background cropping exposed competing lettering; the existing product image is now positioned in a narrower rail, preserving the approved editorial hero.
- Screenshots were sampled before settled images after interaction re-renders. First-fold metrics were taken after scrolling. Modal, English and dark states were absent.
- Direct council calls lacked Gateway invocation readback. Council synthesis trusted incomplete statuses and acceptance routing claimed agents it had not executed.
- Three-file historical approval ignored other active visual dependencies. Mock-direction approval was insufficient evidence for the current rendered candidate.

## Implementation boundaries

`assets/kk-storefront-v5.css` remains the single storefront presentation layer above functional `style.css`. Changes edit the relevant existing rules, add one desktop card breakpoint and remove the obsolete narrow active-filter minimum width. No additional stylesheet is loaded. CSS and script cache markers advance together. Existing SVG stroke language is preserved; remaining modal/loading decoration is removed from customer copy.

The visual harness delegates evidence handling to `scripts/storefront-evidence.cjs`: actual state geometry, image readiness, raw-key checks, target overlap and clipping, local durable Gateway receipts with exact readback, full frontend dependency digest, and approved screenshot hash comparison. The initial top view is captured at scroll zero. Each width captures Thai top/catalogue/footer/modal, English top/modal, and dark top/modal. Modal forward/reverse focus wrapping and restoration are exercised; no booking links are clicked. Non-GET/HEAD browser requests are blocked. Canonical public CSV snapshots and hashes are preserved with artifacts.

All seven council modules execute through `storefront_design_council` via the Agent Gateway. UX pre-review and visual acceptance also execute through their registered Gateway routes. Project-memory bootstrap remains enabled. Invocation persistence is explicitly LOCAL_ARTIFACT, not a production runtime ledger write. The council returns full reviewer outputs and evidence; its technical status cannot pass missing input, missing roles, invalid review statuses or P0/P1 findings. Art Director direction output is planning guidance, not an aesthetic PASS. Owner visual acceptance remains a separate, blocking gate.

Behavioral tests reproduce missing evidence, counterfeit reviews, incomplete reviewer sets, mismatched packets, clipped/overlapping controls, escaped card content, incorrect columns, modal focus/geometry failures and stale screenshot hashes. Obsolete tests pinning the V6.3 cache marker/direct reviewer call were updated to the new cache marker and Gateway contract; intended visual criteria were strengthened, not relaxed.

## Validation and promotion limits

Local iteration 4: all eight required viewports, interaction checks and seven-agent technical council pass with zero P0/P1. Actual screenshots were inspected, including 1440px contained two-column catalogue, narrow controls and mobile bottom sheet. Final evidence must be rerun after the final commit and preserved separately with its exact SHA.

Local full regression on Windows/Node24 initially ran 1,082 tests: 1,081 passed; the Admin symlink-escape regression could not create its symlink (`EPERM`). The test was preserved. Linux/Node20 CI is required; Windows results must not be represented as a full PASS. Local Project Memory Enforcement equivalents passed (21 tests plus READY bootstrap).

No pricing, availability, inventory, event visibility, booking destinations, Admin logic, Apps Script, scheduled runners, Machine SOT or production data was edited. External poster delivery remains dependent on its provider; a transient failed poster in iteration 3 was kept as failed evidence and a later fresh run passed. Vercel's previously reported deployment-rate limit is independent of local acceptance. No deployment was manually retried. Owner approval, CI and fresh production/runtime readback remain required before merge/promotion; no production acceptance is inferred from the local result.
