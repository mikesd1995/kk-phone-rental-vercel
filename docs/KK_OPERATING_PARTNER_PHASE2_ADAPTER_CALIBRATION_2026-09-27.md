# KK Operating Partner Phase 2 — Adapter Calibration Plan — 2026-09-27

## Principle

A source being available does not make an adapter production-ready.

Every adapter starts in SHADOW_READ_ONLY and must be compared against the existing source of truth before its signal can influence the owner brief.

## Rollout order

1. Verified Event
2. Content Performance
3. Inventory + Booking Velocity
4. Revenue
5. System Health
6. Competitor Market
7. Customer Cohorts
8. Storefront Behavior

The first five already have underlying data surfaces. The last three need additional source design or privacy-safe aggregation.

## Shadow-mode procedure

For each adapter:

1. Read current authoritative/observational source.
2. Produce normalized signal contract.
3. Do not feed it into live recommendation ranking yet.
4. Compare a bounded sample against existing truth/manual calculation.
5. Record mismatches with explicit cause.
6. Add regression tests for discovered edge cases.
7. Require zero unauthorized writes.
8. Only after acceptance, enable that adapter as an input to Operating Partner.

## Calibration evidence

Each sampled signal should preserve:

- subject_ref
- observed_at
- source class
- source_ref
- confidence
- normalized metrics
- freshness status
- dropped/invalid fields

No raw customer record should be copied into calibration evidence.

## Important business invariants

### Revenue

Use the approved KK model:

- Actual = completed only.
- Future = pending / confirmed / prepared / picked_up / returned / uploaded.
- Forecast = Actual + Future.
- cancelled / no_show / blank / unknown excluded.

### Inventory

Inventory recommendations must use fresh availability and never assume capacity from a stale snapshot.

### Competitor data

No numeric competitor conclusion without exact-event current evidence. Missing samples are evidence debt, not a zero-competition signal.

### Content performance

Historical performance can nudge creative strategy but cannot override event truth, price truth or inventory truth.

### Customer operations

Only cohort-level counts and rates enter Operating Partner. Direct customer communication remains owner/governed-action territory.

## Promotion criteria

An adapter may move from SHADOW_READ_ONLY to recommendation input only when:

- sampled identity accuracy is 100%;
- no authority-boundary violation is observed;
- stale/invalid evidence fails closed;
- regression tests cover every discovered mismatch class;
- owner/business invariants remain unchanged.

Any material source-format change returns the adapter to shadow mode until recalibrated.
