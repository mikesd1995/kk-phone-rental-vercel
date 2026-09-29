# Apps Script Gate 2 — 9_5_12 Reconciled Candidate — 2026-09-30

Status: **SOURCE CANDIDATE ONLY / DO NOT DEPLOY**

## Purpose

Reconcile the still-required Gate 2 booking-time and timezone hardening from stale PR #160 with the current-main owner-visibility/tombstone safeguards, without replacing canonical `apps-script/Code.gs` and without touching Production.

## Source strategy

The candidate starts from current `main` `apps-script/Code.gs`, not from the stale PR #160 file. This preserves current-main behavior first, including the persistent owner-hidden/tombstone protections.

Only the following PR #160 behavior was selectively reintroduced:

- optional `return_time` persistence on create/update;
- snapshot `return_time` exposure;
- HH:MM validation for pickup/return clocks;
- cross-day reservation windows;
- blank return conservative reservation through next-day 06:00;
- `picked_up` with no return evidence remains open-ended;
- window-aware physical Asset selection/collision checks;
- same-lock booking collision assertion before write;
- read-only Apps Script/Spreadsheet timezone diagnostics;
- read-only installed-trigger inventory diagnostics;
- fail-closed mutation gate when Script/Spreadsheet timezone is not `Asia/Bangkok`.

## Explicitly preserved from current main

The candidate must retain:

- `EVENT_VISIBILITY_TOMBSTONE_LOCKED`;
- `explicit_owner_reopen`;
- `kkFindVisibilityHistory_`;
- `kkUpsertVisibilityLock_`;
- current event visibility history/tombstone behavior.

These protections were missing or older in stale Gate 2 lineage and are the reason a direct merge of PR #160 is prohibited.

## Files

Candidate:

`apps-script/candidates/Code_9_5_12_GATE2_RECONCILED_RETURN_TIME_TIMEZONE_TOMBSTONE_2026-09-30.gs`

Regression lock:

`tests/apps-script-9-5-12-gate2-reconciled-candidate.test.js`

Canonical `apps-script/Code.gs` is intentionally unchanged.

## What this does NOT yet prove

This candidate does not claim end-to-end production readiness.

Still required before deployment:

1. exact-head repository regression must pass;
2. Vercel/Admin-side `return_time` request/readback surfaces must be fresh-ported from current main, not copied wholesale from stale PR #160;
3. System Health should surface timezone/trigger evidence without exposing secrets;
4. owner-authenticated Apps Script bound project/deployment identity must be read;
5. exact named Project Settings timezone must be read;
6. installed cleanup-trigger inventory and exact schedule must be verified;
7. controlled deployment must preserve rollback;
8. one legitimate owner-directed Admin write must pass with exact booking + audit + Sheet readback;
9. cross-day overlap behavior must be accepted against real runtime;
10. no synthetic business row may be created solely for acceptance.

## Safety

This branch does not:

- deploy Apps Script;
- alter canonical `apps-script/Code.gs`;
- mutate Booking, Event, pricing, inventory, visibility, or customer data;
- change Scanner/Verifier/Canary or Machine SOT;
- change Vercel Production;
- change Apps Script timezone/triggers;
- create provider calls.

The candidate is reviewable source evidence only until the remaining gates are satisfied.
