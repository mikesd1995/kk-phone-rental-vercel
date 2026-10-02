# Storefront Codex handoff fresh-port — 2026-10-02

## Purpose

Resume the Codex storefront handoff from PR #462 without merging its stale/diverged history into current `main`.

## Lineage

- Fresh-port base: `e5f7e688b39c537e2178eed409a9abc9d14470ef`
- Codex handoff source branch: `fix/storefront-v62-mobile-finish`
- Source head inspected for this port: `3770bb08f5404582c1374241250ba81cbb837e22`
- Source PR: #462

The source branch was 27 commits ahead and 25 commits behind current main, so direct merge/cherry-pick was rejected as unsafe.

## Ported presentation and QA work

- authoritative V6.3 responsive storefront stylesheet
- inline SVG service/theme/search icon language
- mobile/desktop catalogue containment and short-phone first-fold correction
- localization/copy cleanup and fail-safe language initialization
- eight acceptance widths: 320, 375, 390, 430, 480, 768, 1024, 1440
- rendered-state evidence helper and image-delivery evidence
- top/catalogue/footer/modal/light/dark/Thai/English screenshot states
- seven-role Storefront Design Council execution and evidence validation
- raw i18n-key P0 blocker
- screenshot approval binding to current frontend dependency digest

## Fresh-port conflict policy

`index.html` and `script.js` were reconciled against current main rather than merging the stale PR history. The Agent Task Router kept all current-main routes and changed only `storefront_design_council_acceptance` so acceptance executes the real seven-reviewer council instead of trusting supplied reviews.

## Safety boundary

No pricing, package availability, inventory, event visibility, booking destination, Admin mutation, Apps Script mutation, customer data, Scanner/Verifier authority, Project Memory storage, LINE/X publish, or production business-write path is changed by this storefront port.

Production writes = 0. Auto deploy = false. Owner rendered visual acceptance remains a separate release gate.

## Acceptance required before merge

1. Syntax and full Admin Regression PASS.
2. Project Memory Enforcement PASS.
3. Storefront Automated Visual QA technical capture completes on all eight widths with 0 P0/P1 and interaction pass.
4. Candidate screenshots/artifacts are bound to the exact fresh-port head.
5. Any owner visual approval must be fresh for this candidate; stale PR #462 approval/evidence is not reusable.
6. Vercel quota/deployment status is reported separately from source correctness.


## 2026-10-02 handoff continuation — poster resilience + gate separation

The exact-head Visual QA failure on run `37024949862` was isolated to one external poster delivery defect at 1024x768: `EVT-20261005-KHOM-KHLANG-SPECIAL-EP5` exhausted all canonical Google Drive delivery candidates. All layout, interaction, dark/light, Thai/English, modal, containment and the other seven viewport checks were otherwise clean.

Remediation:
- a failed external poster now renders a deterministic **exact-event summary fallback** using the already-visible event name/date/venue instead of a generic unrelated image;
- the card remains bookable and retains `posterFailed` evidence plus explicit `posterFallback=event-summary`;
- rendered fallback evidence is P2 degraded-source evidence, while an unresolved/broken fallback remains P1 and blocks technical acceptance;
- canonical poster SOT precedence is unchanged; the separate poster-health audit may continue to report the source-permission defect until a verified exact-event image source is restored;
- technical visual CI and owner aesthetic release acceptance are now represented separately. Technical QA may pass with `release_ready=false`; production promotion still requires fresh exact-candidate owner screenshot acceptance.

No pricing, inventory, booking, event visibility, canonical poster field, Apps Script, Admin data or production business write was changed.


## Post-merge evidence audit — card-column metric correction

A manual review of the accepted Visual QA artifact for head `64a7f67b6291590a465f640c53b8543cfef4f71f` found an evidence inconsistency at 480x932: the screenshot and per-state geometry correctly showed two event-card columns, while the summary metric reported one. The UI itself was correct.

Root cause: summary metrics grouped the first row by independently rounding card tops into 4px buckets. Fractional layout positions could put visually aligned cards on opposite sides of a bucket boundary. The per-state inspector already used direct rendered-top tolerance and reported the correct two-column result.

Remediation:
- summary metrics now use direct rendered-top tolerance, matching state evidence;
- regression coverage rejects the obsolete rounding-bucket implementation;
- no storefront CSS/copy, pricing, availability, inventory, event visibility, booking destination, Admin, Apps Script or production business data was changed.

The original patch branch diverged while unrelated OpenAI/Ultra Deep work advanced `main`; this correction was therefore fresh-ported onto the then-current main rather than force-merging stale history.


## 2026-10-02 evidence-metric correction — horizontal lane geometry

Post-merge artifact inspection found one evidence inconsistency: the 480px rendered screenshot showed the intended two-column catalogue, while summary metrics could report `card_columns=1`. The storefront itself was not breaking; the harness inferred the first row by comparing card `top` positions within 4px. Image/fallback/content height differences can stagger two same-grid cards by more than that threshold, causing a false one-column measurement.

Correction:
- column count is now derived from clustered horizontal card positions (`left`) rather than first-row top alignment;
- small subpixel horizontal jitter is tolerated while distinct grid lanes remain separate;
- per-column widths use representative median widths so unequal-column evidence remains detectable;
- both rendered-state evidence and Design Council/UX packet metrics use the same geometry algorithm;
- regression coverage includes staggered two-column geometry, one-column narrow geometry, three-column detection, and invalid/zero-width rectangles.

This is an evidence/QA correction only. No storefront CSS, customer copy, price, availability, inventory, booking, Admin, Apps Script, poster SOT, or production business-write behavior is changed.


## 2026-10-02 owner screenshot mobile-polish pass

Fresh owner iPhone screenshots showed that technical Visual QA passing did not mean the presentation was aesthetically complete. The reproduced current-source issues were visual hierarchy/density problems, not booking/data defects.

Changes:
- language switch keeps 44px targets but uses an intentional segmented-control shape instead of circular active halves;
- normal-phone hero is shorter and less dominant, with the second headline phrase kept together where width permits;
- benefits become a readable 2×2 service grid on 360–700px instead of four cramped micro-columns;
- search/filter hierarchy is simplified; status controls stay on one QA-safe weighted row, with compact month labels and proportional widths so all four controls remain fully visible without clipping;
- event heading restores a deliberate two-line hierarchy rather than light inline “ghost” text;
- English mode now localizes the secondary hero CTA and all four benefit messages instead of leaving Thai copy on an English page;
- 320px short-phone rules remain separately protected.

The black circular control visible in the owner browser screenshot was not reproduced in the storefront DOM or exact-head Visual QA artifacts, so no storefront element was removed or hidden on that basis.

Safety boundary: presentation and static localization only. Pricing, availability, inventory, event visibility, booking destinations, Admin, Apps Script, customer data, poster SOT and production business writes are unchanged.


## 2026-10-03 professional brand/i18n finish

Owner direction: brand-level storefront messaging must describe **phone rental**, not a single device model, because the catalogue will expand to additional phones. Specific model names remain valid only at package/detail level where the customer is choosing an actual rentable configuration.

Changes:
- hero eyebrow changed from a model-specific label to `PHONE RENTAL / EVENT PICKUP`;
- Thai/English hero, SEO meta and event meta copy now describe generic phone rental;
- the upcoming-events heading no longer injects a specific model;
- brand subtitle is `Concert Phone Rental`;
- package-level model/lens labels remain intact so booking truth is not made ambiguous;
- hidden/accessibility language binding now covers skip-link, theme-toggle aria, language-switch aria, benefit group, browse/search group, booking journey, month selector and initial loading state;
- Thai empty/error states were tightened from playful filler language to a more professional service tone;
- cache markers were advanced to V6.6 so production browsers do not retain the previous model-specific copy.

Safety boundary: no pricing, package availability, inventory, event visibility, booking destination, LINE payload semantics, Admin, Apps Script, customer data, poster SOT or production business-write authority changed.
