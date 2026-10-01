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
