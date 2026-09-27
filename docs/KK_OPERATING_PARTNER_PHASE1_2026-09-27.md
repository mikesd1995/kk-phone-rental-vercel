# KK Operating Partner — Phase 1 — 2026-09-27

## Objective

Move KK Phone Rental from request-driven AI assistance toward an evidence-driven operating partner that can identify opportunities, prioritize owner attention, learn from outcomes, and propose strategy improvements without receiving unrestricted production authority.

Phase 1 builds the business-brain foundation. It does not create an autonomous publisher, pricing bot, customer messenger, or production deployer.

## Core loop

    Observe
      -> Analyze
      -> Recommend
      -> Owner decision
      -> Governed execution
      -> Measure
      -> Learn
      -> Strategy nudge
      -> Owner review

The system is designed so learning can accumulate indefinitely while high-risk authority remains bounded.

## Components

### server/kk-operating-partner.js

Provides deterministic business reasoning:

- opportunity scoring;
- cross-domain prioritization;
- daily owner brief;
- content-performance integration;
- decision/outcome learning;
- strategy nudges;
- explicit safety envelope.

Opportunity scoring uses seven bounded signals:

- demand_signal;
- competition_gap;
- margin_signal;
- inventory_fit;
- timing_urgency;
- content_reach;
- repeat_customer_fit.

Missing signals are not invented. Signal weights are renormalized only over supplied evidence, while low evidence coverage/confidence causes INSUFFICIENT_EVIDENCE rather than false certainty.

### config/kk-operating-partner-policy.json

Centralizes:

- opportunity weights;
- priority thresholds;
- evidence floors;
- maximum daily actions;
- minimum learning sample;
- autonomy boundaries.

The policy can be proposed for revision later, but is not self-modified at runtime.

### server/kk-decision-ledger.js

Implements append-only decision learning on Supabase.

Decision events:

1. RECOMMENDATION
2. OWNER_DECISION
3. OUTCOME
4. LESSON

No historical event is updated in place.

This allows exact reconstruction of:
- what AI recommended;
- what the owner approved/rejected/modified/deferred;
- what outcome was measured;
- what lesson was proposed.

The ledger stores no customer PII and accepts only a bounded numeric metric whitelist.

### skills/kk-operating-partner/SKILL.md

Defines the operating-partner behavior, learning rules and authority boundary.

### Agent Gateway integration

Registry V3 adds kk-operating-partner and three callable tasks:

- operating_partner_brief
- opportunity_review
- decision_feedback

The existing Admin Guard / Agent Gateway surface is reused. No new Vercel API function is added.

## Daily brief inputs

Phase 1 accepts normalized signals from existing systems:

- verified event opportunities;
- customer-action cohorts without PII;
- system/reliability signals;
- operations actions;
- Content Performance rows;
- aggregate revenue summary;
- Decision Ledger history.

The resulting brief contains a ranked action list and owner questions.

## Learning rules

A single outcome does not become strategy.

Comparable recommendations need at least three measured outcomes before a strategy nudge is produced.

Examples:

    3+ outcomes, average >= 75
      -> REINFORCE proposal

    3+ outcomes, average <= 45
      -> REVIEW_STRATEGY proposal

Neither is auto-applied.

Owner rejection is recorded as preference/constraint evidence. It is not treated as proof the rejected recommendation would have failed because the counterfactual is unknown.

## Decision Ledger privacy and safety

Allowed metrics are numeric operational/business outcomes such as:

- impressions;
- engagements;
- profile visits;
- clicks;
- inquiries;
- bookings;
- revenue;
- booking velocity;
- inventory utilization;
- conversion rates;
- error/latency metrics.

Disallowed/unpersisted data includes:

- customer names;
- phone numbers;
- addresses;
- payment details;
- secrets;
- raw prompts;
- passwords;
- arbitrary free-form customer payloads.

Runtime permission target:

    anon             none
    authenticated    none
    service_role     SELECT + INSERT
    UPDATE           denied
    DELETE           denied

RLS stays enabled.

## Autonomy

Automatically allowed:

- observe bounded signals;
- analyze;
- score/rank;
- prepare drafts and action plans;
- record decision-learning evidence;
- propose strategy improvements;
- run read-only analytics and benchmarks.

Owner approval / governed path remains required for:

- publishing;
- pricing writes;
- booking/inventory writes;
- customer sends;
- ad spend;
- merge/deploy;
- policy changes;
- Machine SOT changes.

## Phase 1 limitations

This is not yet a scheduled autonomous daily brief.

The Operating Partner is callable through Agent Gateway after deployment, but Phase 1 deliberately does not create another scheduler while Scanner/Verifier/control-plane runtime work is still being reconciled.

Live signal collectors are also not invented here. Existing verified data sources must be wired one by one so a missing feed is visible rather than silently guessed.

## Next phases

Phase 2 should wire measured growth signals:

- event/X demand;
- competitor pricing;
- content reach;
- inventory availability;
- booking velocity.

Phase 3 should add customer/operations cohorts and storefront behavior.

Phase 4 may allow controlled self-improvement proposals for weights, skills, prompts and code, but promotion must remain benchmarked, reviewed and reversible.
