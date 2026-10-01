# KK Storefront Multi-Agent Design Council — 2026-10-01

## Activation
V5 now has a governed multi-agent design council wired through the existing Agent Registry and Task Router.

Review dimensions:
1. Brand / art direction — kk-storefront-art-director
2. Product UX — kk-storefront-ux-reviewer
3. Conversion/CRO — kk-storefront-conversion-reviewer
4. Fandom commerce — kk-storefront-fandom-reviewer
5. Accessibility — kk-storefront-accessibility-reviewer
6. Performance — kk-storefront-performance-reviewer
7. Adversarial visual review — kk-storefront-visual-critic

## Operating contract
All seven roles are read-only reviewers. They produce evidence-backed findings, actions and acceptance tests. They are not allowed to independently edit CSS or business truth. Art direction owns synthesis; one implementation writer applies the approved presentation patch. This prevents competing agent patches and additional CSS override debt.

Acceptance fails closed when any review dimension is missing, any P0/P1 remains open, or owner visual acceptance is not ACCEPTED.

## Safety
production_writes=0
business_truth_writes=0
auto_merge=false
auto_deploy=false
owner_visual_acceptance_required=true

Pricing, inventory, booking, event truth and Machine SOT remain outside council authority.

## Recovery log
- Repaired a literal escaped newline in `script.js` that broke the storefront JavaScript syntax after the mobile FAQ binding change.
- Added a regression guard for the FAQ binding source.
- Made local zero-cost visual QA fixture routing deterministic for `/api/kk-data` and retained canonical read-only production-feed sourcing.
- Updated registry-version contract tests from V23 to V24 after Design Council registration.
- Updated the visual-QA fixture-routing contract test to the new URL-predicate route.
- Latest pre-recovery Visual QA proved the catalogue/interaction readiness issue is resolved across the run; remaining visual workflow blockers were the intentionally active owner rejection and final visual-critic acceptance.


## V5.5 council synthesis and implementation
Exact-head engineering baseline before redesign:
- Admin Regression: PASS (run 36864211124).
- Automated Visual QA: technical_visual_pass=true and interaction_pass=true at all seven target widths.
- Remaining pre-redesign blockers: FINAL_VISUAL_CRITIC_NOT_PASSING and OWNER_VISUAL_REJECTION_ACTIVE only.

Council synthesis used one implementation writer and preserved business truth. The presentation patch:
- adds a KK-specific concert editorial stage/index language instead of generic SaaS chrome;
- makes the hero product story explicitly read as concert optics / X300 night capture;
- strengthens the hero-to-catalogue transition with a numbered editorial event index;
- increases poster hierarchy on desktop through a 12-column asymmetric editorial grid while retaining mobile poster-first browsing;
- exposes service trust as a restrained READY FOR THE NIGHT proof rail;
- strengthens event decision hierarchy around poster, availability, price and package action;
- retains all booking, pricing, inventory and event data semantics unchanged;
- retains reduced-motion, keyboard/focus and touch-target contracts.

Owner rejection remains active by design until new screenshot evidence is reviewed. No production deployment or merge was performed.
