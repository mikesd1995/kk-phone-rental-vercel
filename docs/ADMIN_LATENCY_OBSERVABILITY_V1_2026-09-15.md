# Admin Latency Observability v1 — 2026-09-15

## Goal
Segment guarded Admin write latency without changing booking/event business semantics or Apps Script.

## Baseline from `15_Admin_Audit_Log`
Recent bounded audit sample (`A750:J1000`):
- `createEvent`: n=26, median 13.80s, p90 17.71s, max 24.66s.
- `createBooking`: n=17, median 8.13s, p90 9.77s, max 11.63s.

These audit durations are useful historical operation timings but do not separate Vercel preflight from delegated upstream/write time or total guarded request time.

## Change
For guarded `createEvent`, `createBooking`, and `updateBooking` responses, add non-sensitive timing headers immediately before the delegated response begins:
- `X-KK-Admin-Action`
- `X-KK-Admin-Preflight-MS`
- `X-KK-Admin-Upstream-MS`
- `X-KK-Admin-Total-MS`
- `Server-Timing` with `preflight`, `upstream`, and `total`.

Booking also gains `X-KK-Booking-Preflight-MS`. Existing Event preflight headers remain unchanged.

## Safety
- Timing only; no request/response business payload mutation.
- No customer/event/booking identifiers are emitted by the new headers.
- No Apps Script source/deploy.
- No Sheet business-row mutation.
- No Scanner/Verifier/Canary/Make change.
- Existing collision/event guards remain authoritative.

## Why this helps
A real authorized Admin write can now show whether latency is dominated by guard preflight, the delegated Legacy Admin/Apps Script path, or total proxy time. This gives evidence for the later 9_5_9 lock-critical-section fix instead of guessing from end-to-end symptoms.
