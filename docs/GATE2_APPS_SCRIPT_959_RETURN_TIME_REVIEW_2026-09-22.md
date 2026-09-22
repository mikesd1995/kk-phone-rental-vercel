# Gate 2 — Apps Script 9_5_9 Recovery + Return-Time Atomicity Review

Date: 2026-09-22
Status: **DRAFT / REVIEW-ONLY / DO NOT DEPLOY APPS SCRIPT**

## Provenance

Production runtime evidence reports:

`v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX`

The recovered owner source artifact `KK_Phone_Rental_Code_9_5_9_RECOVERY.gs` was staged without behavior changes first.

Provenance checkpoint:
- baseline commit: `0d2f445e36c230b482b7244b140ac31f5807d3e0`;
- baseline GitHub `apps-script/Code.gs` text was compared directly with the Library recovery artifact;
- result: exact text match;
- baseline content SHA: `5fb6430fbbe8eeb8191983429f887efb0e8d82eb`.

Behavior changes are layered after that checkpoint and use candidate version:

`v16.7.0_CRM_PRO_PHASE3_9_5_10_RETURN_TIME_ATOMICITY_CANDIDATE`

This candidate is **not** the live Apps Script version.

## Defects confirmed in recovered 9_5_9

Recovered source previously:
- accepted `pickup_time` on booking create but wrote a blank return-time column;
- did not apply `payload.return_time` on update;
- did not expose `return_time` in snapshot booking objects;
- checked physical-asset collisions only by event date;
- therefore could not represent an explicit next-day return window in backend collision enforcement.

## Candidate behavior

### Booking time semantics

Business timezone is pinned for reservation windows to `Asia/Bangkok`.

- blank `pickup_time` -> reservation starts at 00:00 on event day;
- explicit `pickup_time` -> starts at that clock time;
- blank `return_time` -> reservation ends at 06:00 on the next day;
- explicit return later than pickup -> same-day return;
- explicit return earlier than or equal to pickup -> next-day return;
- `picked_up` with no return evidence -> open-ended until workflow status changes;
- adjacent windows where one ends exactly when the next begins do not overlap.

### Apps Script write contract

Within the existing DocumentLock:
- createBooking validates and persists both pickup and return time;
- updateBooking can update or clear return time;
- snapshot exposes persisted return time;
- manual physical Asset validation is window-aware;
- automatic Asset assignment excludes assets already used by overlapping booking windows;
- create/update collision assertion runs immediately before Sheet writes;
- update self-excludes its own physical row;
- Dashboard Quick Booking also runs through the window-aware physical Asset guard.

### Vercel guard

The booking guard now trusts request `return_time` only because the staged backend persists it.
It:
- uses return time in preflight windows;
- preserves current return time when update omits it;
- applies a submitted return time when update includes it;
- rejects non-empty invalid return-time formats before forwarding the write.

### Admin UI

Create and Edit Booking forms expose optional `return_time`.
Edit flow populates the persisted value from snapshot.
No historical booking time is invented.

## Explicit non-goals

This branch does not:
- deploy Apps Script;
- mutate production bookings/events/assets/pricing;
- repair historical blank return times;
- modify Scanner, Verifier, Canary or HF Production;
- change Event Tracker sharing;
- change Apps Script project timezone or triggers;
- claim Production Apps Script equivalence merely from CI.

## Deployment gate

Before any live Apps Script deployment require:
1. owner-authenticated exact project/deployment identity;
2. fresh Apps Script project timezone readback;
3. fresh installed-trigger inventory;
4. exact PR-head CI PASS;
5. review of recovered-baseline -> candidate diff;
6. controlled deployment with rollback path;
7. one legitimate authenticated Admin write acceptance;
8. exact booking + Admin audit readback proving one write only;
9. cross-day reservation collision acceptance;
10. no synthetic business row.

Until those gates pass, Production remains on live 9_5_9 and this branch stays review-only.
