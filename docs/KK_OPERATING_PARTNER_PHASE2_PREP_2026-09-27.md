# KK Operating Partner — Phase 2 Preparation — 2026-09-27

## Status

Prepared on a non-production branch only.

This work intentionally does **not** wire live feeds, change production routing, add schedules, write business data, or merge into main while P0 acceptance remains open.

## Goal

Make the next Operating Partner phase contract-first so every business signal is explicit about:

- signal type;
- subject identifier;
- observation time;
- freshness TTL;
- source class;
- confidence;
- allowed numeric metrics;
- canonical opportunity score mapping;
- PII restrictions;
- advisory-only authority.

Missing/stale/invalid evidence must be visible and excluded instead of guessed.

## Signal types

### event_demand
Expected future source: verified event truth + measured demand evidence.

Canonical score outputs:
- demand_signal
- content_reach

### competitor_market
Expected future source: persistent evidence from competitor research.

Canonical score outputs:
- competition_gap
- margin_signal

Current state: ADAPTER_NEEDED.

### inventory_capacity
Expected future source: aggregate booking/inventory truth.

Canonical score output:
- inventory_fit

TTL is short because availability changes quickly.

### booking_velocity
Expected future source: aggregate booking state.

Canonical score outputs:
- timing_urgency
- demand_signal

### content_performance
Expected source: existing kk-content-performance module.

Canonical score output:
- content_reach

### revenue
Expected source: rental-dashboard aggregates only.

No customer-level revenue rows are required by Operating Partner.

### customer_cohort
Expected source: PII-free aggregate cohorts such as follow-up due, pickup due, return due, upload due, review opportunity and repeat-customer counts.

No names, phone numbers, emails, addresses or raw messages enter the signal contract.

### system_health
Expected source: Reliability/Agent Gateway/runtime/deployment observability.

### storefront_behavior
Current state: NOT_WIRED.

A privacy-safe analytics source must be selected before implementation.

## Freshness policy

Phase 2 preparation defines explicit TTLs by signal type. Stale evidence is excluded from opportunity-input construction.

Examples:

- inventory capacity: 60 minutes
- customer cohorts: 60 minutes
- system health: 30 minutes
- competitor market: 12 hours
- event demand: 24 hours
- content performance: 7 days

These are initial technical safety defaults, not permanent business strategy. Changes require evidence and review.

## Source precedence

When more than one fresh signal maps to the same canonical opportunity score, the Phase 2 contract currently selects the higher-confidence signal.

It does not average contradictory evidence silently.

A future live adapter should preserve individual signal IDs so conflicts can be audited.

## Privacy

All source/subject references must be identifier-like and non-PII.

Metric keys are whitelist-based per signal type.

Unknown keys are dropped before reasoning.

## Wiring matrix

See:

    config/kk-operating-partner-signal-sources-v1.json

Current assessment:

- verified event truth: AVAILABLE_EXISTING
- content performance: AVAILABLE_EXISTING
- booking/inventory: AVAILABLE_EXISTING
- revenue: AVAILABLE_EXISTING
- system health: AVAILABLE_EXISTING
- competitor market: ADAPTER_NEEDED
- customer cohorts: ADAPTER_NEEDED
- storefront behavior: NOT_WIRED

AVAILABLE_EXISTING means the underlying data exists, not that the Operating Partner live adapter is already wired.

## Activation gate

Do not merge runtime wiring until:

1. natural canonical Scanner/Verifier acceptance is complete;
2. exact current main is accepted on Vercel Production;
3. Production Baseline has no unresolved blocker that would make live-signal conclusions unsafe.

After P0 closes, build one adapter at a time and compare its output against known business truth before enabling it in Operating Partner briefs.
