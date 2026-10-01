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
