# KK Storefront UX/UI Reviewer V1 — 2026-09-27

## Objective

Add a governed UX/UI reviewer to the existing KK Agent Gateway so storefront design work stops being ad-hoc CSS tweaking and instead follows a repeatable evidence -> recommendation -> acceptance loop.

This phase is intentionally read-only. It does not grant autonomous merge/deploy authority.

## Added

- `config/kk-storefront-ux-policy.json`
  - responsive UX budgets and acceptance viewports;
  - iOS 16px form-size rule;
  - mobile 44px tap-target rule;
  - sticky-control and fixed-CTA viewport budgets;
  - single-row mobile filter preference;
  - zero-write/owner-review safety boundary.

- `server/kk-storefront-ux-reviewer.js`
  - consumes viewport/layout metrics plus optional screenshot observations;
  - emits P0/P1/P2/P3 findings;
  - calculates a bounded professional-readiness score;
  - produces concrete acceptance criteria for each finding;
  - exposes fail-closed visual QA;
  - prepares an AI advisor prompt without changing business truth.

- Agent Gateway integration
  - `storefront_ux_review`;
  - `storefront_visual_qa`;
  - invocation evidence remains append-only through the existing Agent Invocation Ledger.

- `skills/kk-storefront-ux/SKILL.md`
  - defines evidence priority, design hierarchy, mobile rules and safety.

- regression coverage and dry-run command.

## Current mobile issue addressed in the same PR

The sticky search/filter concept remains, but the mobile status filters are kept on one compact horizontal row instead of allowing the waitlist filter to fall onto a large second row. Narrow screens may horizontally swipe the filter row.

The controls preserve iOS-safe 16px form text. Mobile interactive height is aligned to the 44px policy target, and the fixed LINE CTA receives safe-area-aware spacing.

## Acceptance model

Required visual widths:

- 320
- 375
- 390
- 430
- 480
- 768
- 1024

The reviewer fails visual QA when:

- viewport evidence is missing;
- P0 horizontal-overflow/iOS-zoom blockers remain;
- P1 sticky obstruction, filter wrapping, undersized targets, CTA obstruction or card-density issues remain.

## What this does not yet do

V1 does not autonomously capture browser screenshots or call an external vision model. It reviews supplied screenshot observations and measurable layout evidence. This is deliberate: the model/vision provider can be attached later without giving it production authority.

Until browser screenshot capture is wired, source/regression tests are not treated as final visual proof.

## Safety / writes

- Production writes: 0
- Booking writes: 0
- Pricing writes: 0
- Inventory writes: 0
- Google Sheet writes: 0
- Apps Script writes: 0
- Auto publish: false
- Auto merge: false
- Auto deploy: false
- Owner review required: true


## 2026-09-30 enforcement upgrade

Product/UX review is now a required project gate for storefront layout/flow, responsive UI, Admin UI, and product-flow changes. The canonical route is `storefront_ux_review`, followed by `storefront_visual_qa`, regression tests, and production acceptance. A mobile clear-filter overflow incident triggered this hardening. Reset controls must remain readable and contained at 320/375/390/430/480px; they may move to a dedicated row rather than being compressed into a multi-line pill.
