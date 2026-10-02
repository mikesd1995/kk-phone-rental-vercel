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
