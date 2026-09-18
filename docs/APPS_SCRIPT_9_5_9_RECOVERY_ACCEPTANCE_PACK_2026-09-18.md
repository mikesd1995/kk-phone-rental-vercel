# Apps Script 9_5_9 Recovery & Atomic Reservation Acceptance Pack — 2026-09-18

## Status

**BLOCKED_SAFE / PREPARED FOR SOURCE RECOVERY**

This pack does not change or deploy Apps Script. It turns Issue #9's acceptance requirements into executable repository regression coverage while the exact live production source remains unavailable.

## Fresh evidence snapshot

Production evidence reports backend `v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX`.

Repository `apps-script/Code.gs` still reports `v16.7.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX`.

A fresh Google Drive search on 2026-09-18 found:
- no accessible file with MIME type `application/vnd.google-apps.script`;
- no exact 9_5_9 / `PRICE_INTEGRITY_FIX` source export;
- keyword hits only in operational Sheets / documentation, not an Apps Script source project.

Current `10_Admin_Health_Check` remains:
- Active bookings missing `return_time`: **6 / CHECK**;
- Active bookings missing `pickup_time`: **1 / CHECK**;
- Spreadsheet timezone: **Etc/GMT / CHECK** while business timezone is Asia/Bangkok;
- Atomic reservation timing readiness: **CHECK**.

## Current safety boundary

The Vercel reservation guard is a preflight mitigation, not the authoritative atomic writer.

Until exact live 9_5_9 source is recovered or independently reconstructed and proven equivalent:
- do not replace production Apps Script with repository 9_5_8;
- do not claim request `return_time` is persisted end-to-end;
- do not enable UI behavior that assumes a submitted `return_time` is authoritative;
- keep collision preflight fail-closed on snapshot uncertainty;
- do not mutate production bookings merely to exercise this contract.

The current proxy intentionally ignores a create-request `return_time` and preserves the snapshot value on update. This is conservative and must remain so until the backend write/snapshot path is proven.

## Executable contract added by this pack

`tests/apps-script-atomic-reservation-contract.test.js` covers the behavior the recovered backend implementation must preserve or exceed:

1. explicit return windows;
2. cross-midnight windows in Asia/Bangkok;
3. adjacent non-overlapping boundaries;
4. same-asset overlap rejection;
5. capacity overlap rejection even before auto-assignment;
6. update self-exclusion;
7. picked-up open-ended reservations without return evidence;
8. fail-closed proxy behavior while create/update `return_time` is not proven end-to-end.

These tests validate the reusable reservation semantics only. They are **not** proof that live Apps Script is atomic.

## Required implementation after source recovery

After obtaining the exact live source:

1. commit the unmodified recovered 9_5_9 source on a review branch;
2. diff it against repository 9_5_8 and preserve every live change;
3. inside the existing `DocumentLock` / write transaction, make `createBooking` and `updateBooking` resolve the final reservation window from persisted `pickup_time` + `return_time`;
4. run collision/capacity checks after acquiring the same lock and immediately before the write;
5. make snapshot expose the persisted `return_time`;
6. make update collision logic exclude the exact booking being updated;
7. keep `picked_up` without return evidence open-ended/fail-safe;
8. exact-read the written Sheet row and refreshed snapshot before claiming acceptance.

## Acceptance after implementation

Required before Issue #9 can close:
- exact live-source provenance established;
- no 9_5_9 behavior lost in the reconstruction diff;
- repository syntax + full tests PASS;
- atomic timing contract PASS;
- Preview/CI PASS;
- controlled Apps Script deployment only after review;
- authenticated Admin create/update acceptance;
- exact `00_Master_Booking` readback;
- exact snapshot readback;
- no collision/capacity regression;
- timezone dependency explicitly resolved or documented with deterministic conversion.

## Non-goals

This pack does not:
- deploy Apps Script;
- write production booking/event/customer rows;
- change Scanner/Verifier/Canary/Make;
- activate Hugging Face;
- send LINE/Telegram/provider notifications.
