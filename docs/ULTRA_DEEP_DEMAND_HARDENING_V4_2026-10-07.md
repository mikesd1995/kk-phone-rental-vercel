# Ultra Deep Demand Hardening V4 — 2026-10-07

## Purpose
Hardening after the October external-demand reconciliation. This patch does not change the current 75/60/45 thresholds and does not deploy or write production business data.

## 1. State Consistency Gate
Every monthly plan audits Core, visibility history and Web Ready before candidate planning.

Fail-closed invariants:
- LOCKED + Core active => CRITICAL
- LOCKED + production show/show_full => CRITICAL
- Core hidden + production visible => CRITICAL

Reconcile-required invariants:
- REOPENED or OWNER_KEEP history + Core hidden
- Core active + Web Ready hide

A CRITICAL result returns BLOCKED_STATE_CONSISTENCY with production_writes=0.

## 2. External Evidence Ledger
External demand may be supplied as machine-readable evidence receipts. Every valid evidence item requires:
- signal type
- 0-100 signal score
- source URL
- observed_at timestamp
- concise evidence summary

The ledger derives only the six approved external signals, computes the score using the canonical scorer, and hashes the complete receipt with SHA-256. KK bookings, revenue, inquiries and waitlists are excluded.

## 3. OWNER_KEEP durability
Visibility history reasons prefixed OWNER_KEEP are first-class owner-visible intent. Love On Hire — Blessing Ceremony already has OWNER_KEEP_DEMAND_PRUNE_EXCEPTION_2026-10-07 in the canonical Sheet.

## 4. Calibration / backtest
Threshold calibration is read-only. It groups historical external scores into PRIORITY/PUBLISH/WATCH/REJECT and evaluates only external post-event outcomes for threshold fit.

KK booking count may be carried only as a diagnostic field and is explicitly marked kk_used_for_threshold_fit=false.

Under 30 historical scored events with external outcomes, the calibrator returns KEEP_THRESHOLDS_COLLECT_MORE_EXTERNAL_OUTCOMES. It never auto-changes thresholds.

## 5. Acceptance incident
PR #650 was merged into main even though its exact-head Ultra Deep V2 Acceptance run 37513493864 failed before steps were allocated and log retrieval returned BlobNotFound. This is not a test pass and not a proven source assertion failure.

This hardening therefore lives in a separate PR and must not be merged/deployed until executable exact-head acceptance exists.

## Safety
- production_writes=0 for consistency/calibration
- no automatic threshold mutation
- no deployment
- no owner LOCKED override
- no internal KK business signal in External Demand Score
