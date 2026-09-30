# KK Storefront V2 — World-Class Visual Rebuild — 2026-10-01

## Scope
Visual-only V2 foundation. Existing event feed, pricing, inventory, booking semantics, owner-hidden state, APIs and Machine SOT remain unchanged.

## Why
V1 accumulated local UI patches. Functional gates existed, but there was no pre-implementation art-direction authority. This produced design drift: individually valid controls without one coherent visual composition.

## Implemented
- Added callable `kk-storefront-art-director` runtime with deterministic design system and fail-closed acceptance.
- Registered `storefront_art_direction` and `storefront_art_acceptance` in Agent Registry/Task Router.
- Added regression tests proving the agent is callable and cannot self-accept without visual evidence.
- Added V2 premium editorial CSS layer: calmer chrome, poster-first grid, compact sticky discovery controls, stronger typography/spacing, restrained depth, mobile-first two-column event grid, accessible control sizing.
- Existing UX Reviewer and automated browser Visual QA remain mandatory independent gates.

## Safety
No pricing, booking, inventory, event visibility, API, Google Sheets, Apps Script or Machine-SOT write path is changed. No auto-merge and no auto-deploy.

## Acceptance
V2 is not production-accepted until syntax/tests, independent UX review, browser screenshots/metrics at 320/375/390/430/480/768/1024, and `storefront_art_acceptance` all pass.
