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
