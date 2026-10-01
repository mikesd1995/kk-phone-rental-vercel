# Storefront V5 premium commerce redesign — 2026-10-01

## Objective
Raise storefront presentation above the current V3 baseline without weakening KK Phone Rental's concert/fandom identity or changing event, pricing, inventory, package or booking truth.

## Baseline
Production V3 is the mandatory comparison baseline. V4 / PR #402 is a rejected experiment and must never be used as positive visual evidence.

## Design system
Direction: premium concert commerce. Poster/event identity leads; chrome recedes. KK blue is the brand accent, dark navy is the primary action/typography color, neutral surfaces carry structure. Mobile remains poster-led rather than becoming a generic directory.

## Primary flow
Brand proposition -> search/filter -> event poster -> event/package detail -> LINE booking. FAQ/language/social are secondary utilities.

## Governance correction
Visual acceptance is now owner-aware. A later owner rejection invalidates prior automated/screenshot PASS. Final acceptance requires iteration evidence, screenshot artifact, explicit production-baseline comparison and owner_decision=ACCEPTED. Geometry/readiness metrics cannot substitute for visual acceptance.

## Business invariants
Production writes=0 during design QA. No pricing, inventory, event visibility, booking, signature, Apps Script or Sheet SOT mutation. No auto-merge and no auto-deploy.

## V5 implementation changes
- Replaces stacked concert-blue + V3 visual layers with one versioned V5 visual layer above functional base CSS.
- Preserves blue brand identity while reducing decorative noise.
- Compacts hero but keeps a strong branded headline and trust strip.
- Removes persistent LINE overlay from discovery.
- Makes search/filter one contained discovery surface.
- Keeps poster-led event cards with quieter metadata hierarchy and contextual package action.
- Uses responsive 4/3/2/1-column progression rather than V4's thumbnail directory.


## Remediation record — PR #409 exact-head follow-up
- Source failure evidence: Admin Regression at 5f90b163 failed only `new storefront assets are cache-busted`; Visual QA reported P1 `TAP_TARGET_TOO_SMALL` and correctly kept screenshot/owner acceptance blocked.
- Changed `index.html` script cache marker from the stale September poster marker to `storefront-v5-premium-20261001`.
- Raised V5 primary interactive hit areas to the 44px acceptance floor (`.pi-tap`, and mobile `.v3-primary` / `.filter-clear-btn`) without changing pricing, event, inventory or booking semantics.
- Vercel `api-deployments-free-per-day` remains classified as external quota and is not treated as code evidence.
- Safety: no production deploy, no production write, no Sheet/Apps Script mutation, no merge. Owner visual acceptance remains fail-closed and must not be synthesized from automated PASS.


## Visual iteration evidence
Round 1 artifact `11151298431` was rejected by the runtime: 320px event discovery was too late and language targets were below the 44px floor. The implementation was revised rather than approved.

Round 2 artifact `11151078668` cleared automated P0/P1 findings across 320/375/390/430/480/768/1024. Manual screenshot review confirms the intended direction: KK blue remains visible, poster identity remains prominent, persistent LINE obstruction is removed, and the mobile storefront is materially less cluttered than V3 without becoming the rejected V4 directory treatment.

Owner decision is intentionally `PENDING`. This is a hard fail-closed production gate; automated or internal screenshot PASS cannot synthesize owner acceptance.


## V5.1 art-direction reset
The owner quality-bar rejection invalidated V5 round 2 as a final design even though technical P0/P1 were zero. V5.1 therefore changes the art direction rather than polishing the rejected composition.

Reference principles reviewed before implementation: editorial music/festival layouts with image-led programming, oversized typographic hierarchy, controlled high-contrast palettes, and restrained utility chrome. These are principles only; no third-party visual is copied.

Implemented direction:
- deep concert-night brand field above the fold with electric KK blue light treatment;
- oversized editorial hero typography with a shorter proposition;
- warm off-white event canvas to separate brand/story from commerce;
- poster cards lose generic white SaaS containers and become image-led editorial tiles;
- desktop introduces selective larger feature cards instead of a uniform marketplace grid;
- search/filter remains quiet and functional between brand and event catalogue;
- mobile retains two poster columns where width permits, with short-phone rules preserved;
- owner acceptance remains rejected/pending until new screenshots are reviewed; no merge/deploy is authorized.


## V5.2 signature pass — exact-head evidence
Exact design head: `1cd604a6a194e2ead33832b1838a9797fe843124`.

Visual QA run `36845951710` rendered 320/375/390/430/480/768/1024 with P0=0 and P1=0 at every viewport. The workflow remains intentionally red only because the existing owner rejection and production-baseline acceptance gates are active; the geometry/readiness layer itself is clean. Screenshot artifact: `11153511639`.

Admin Regression run `36845952176`: SUCCESS.

Manual screenshot inspection:
- mobile 320/390 keeps the first event discoverable without removing brand/trust context;
- search/filter chrome has been visually reduced and no longer dominates the event heading;
- poster imagery remains the strongest content surface below the fold;
- desktop uses a restrained editorial hero plus selective featured poster scale rather than a uniform marketplace grid;
- a low-contrast `X300` outline was added as a product-specific memory cue, deliberately below copy/poster contrast;
- no pricing, inventory, booking, event SOT or production write path was changed.

Acceptance remains fail-closed. This evidence supersedes the rejected V5 composition technically and visually, but it does not synthesize owner approval or authorize merge/deploy.


## V5.3 event-card language — exact-head evidence
Exact design head: `b67a083e2d2da6754eca8129818560b309f85768`. Draft PR #418 was opened solely to restore exact-head review/CI after the prior PR was closed; it is not an authorization to merge or deploy.

Changes are presentation-only:
- card information order is explicitly poster → event/date → venue + price → availability → action;
- price receives a restrained KK-blue commercial marker without changing source values or formatting logic;
- availability gets a semantic dot using the existing availability state/color, with no inventory inference;
- CTA underline becomes a small interaction signature on hover/focus;
- keyboard focus is visible and poster treatment remains dominant;
- featured desktop cards receive a slightly stronger type/price scale while mobile remains compact.

Evidence: Admin Regression run `36847098272` SUCCESS. Visual QA run `36847098334` rendered all seven target widths with P0=0 / P1=0. Screenshot artifact: `11154141023`. The workflow remains intentionally blocked only by `OWNER_VISUAL_REJECTION_ACTIVE` and `PRODUCTION_BASELINE_COMPARISON_MISSING`.

No pricing, package availability, booking, inventory, event SOT, Apps Script or production write path changed. Production writes=0. Owner acceptance remains fail-closed.


## Final V5.3 production-baseline comparison — 2026-10-01
Candidate screenshot evidence: artifact `11153628618` at design head `e2c85a87266be865178e7323d1665203cb53b495`.
Accepted V3 baseline evidence: artifact `11145158829`, V3 evidence head `817c354e1a9e22e9165bb4e980b07e1a1b656ba8`.

Baseline decision: PASS for the candidate design. V5.3 improves poster/content hierarchy, reduces competing pre-event chrome, preserves earlier event discovery on narrow mobile, and carries a more coherent KK/X300 editorial language from hero through commercial event cards. V3 remains the unchanged production fallback.

The screenshot-review config was updated in commit `b9a705528f762837bb66d7c983ef1c294b2f1377` with `baseline_comparison_pass=true` while deliberately retaining `owner_decision=REJECTED`.

Post-recording exact-head verification:
- Admin Regression run `36848402963`: SUCCESS.
- Storefront Visual QA run `36848402940`: P0=0 / P1=0 at 320, 375, 390, 430, 480, 768 and 1024.
- The former `PRODUCTION_BASELINE_COMPARISON_MISSING` blocker is cleared.
- The only acceptance blocker is `OWNER_VISUAL_REJECTION_ACTIVE`, which must not be cleared without explicit owner re-acceptance.

No merge, production deploy, pricing/inventory/booking/event-SOT mutation, or production write was performed.


## V5.4 final optical pass — 2026-10-01
The final screenshot review found one remaining visible narrow-phone defect in V5.3: at 320px the horizontally scrolling filter toolbar exposed a clipped fourth control, which read as unfinished even though earlier geometry checks allowed horizontal scrolling.

First correction `fc1a557355e75d2229ca9fa129c6353e82930095` converted the <=350px toolbar to a contained four-column layout and removed touch-only hover residue, but the first exact-head QA correctly failed P0 because the month select had been reduced to 13px, violating the iOS no-auto-zoom contract.

Fallback correction `d9a2ab34905f3c29df267abe8101c08a8b2cf288` retained the contained toolbar while restoring the month select to 16px. Exact-head evidence:
- Admin Regression `36850903951`: SUCCESS.
- Visual QA `36850903931`: P0=0 / P1=0 at 320, 375, 390, 430, 480, 768 and 1024.
- Screenshot artifact `11154949860`.
- Production-baseline comparison remains PASS.
- The only acceptance blocker is the deliberately retained `OWNER_VISUAL_REJECTION_ACTIVE` / screenshot-review gate.

V5.4 also disables decorative card hover movement on touch-only devices and respects `prefers-reduced-motion` for card/action transitions. No pricing, inventory, booking, event SOT, Apps Script or production write path changed. Production writes=0. No merge or production deploy was performed.


### V5.4 final confirmation after evidence recording
Documentation head `2044c73702326c02034c9bab4b15babfc76c70c1` was re-verified after the V5.4 evidence was recorded. The design itself remains `d9a2ab34905f3c29df267abe8101c08a8b2cf288`.

- Admin Regression `36851111983`: SUCCESS.
- Storefront Visual QA `36851111979`: P0=0 / P1=0 at all seven target widths.
- Final screenshot artifact: `11155482599`.
- Manual inspection of 320x568, 390x844 and 1024x768 confirms the contained narrow-phone filter treatment, visible first-event discovery, poster-led hierarchy, coherent navy/electric-blue KK signature, and no floating CTA obstruction.
- Production baseline remains PASS.
- The sole acceptance blocker remains `OWNER_VISUAL_REJECTION_ACTIVE`; it is governance, not a geometry/regression failure.

No merge, deploy, production write, pricing, inventory, booking, or event-SOT mutation was performed.
