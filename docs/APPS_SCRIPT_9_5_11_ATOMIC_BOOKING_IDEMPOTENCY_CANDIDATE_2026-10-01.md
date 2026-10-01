# Apps Script 9_5_11 Atomic Booking Idempotency Candidate — 2026-10-01

## Purpose
Close the highest-value backend gap without deploying or mutating Production data: make `createBooking` exactly-once for a stable `request_id` inside the existing Apps Script `DocumentLock`.

## Provenance
The new candidate is derived from the reconciled 9_5_10 candidate, which already preserves recovered deployed 9_5_9 price-integrity/runtime hotfixes plus the owner-hidden guard. The 9_5_10 artifact and canonical `apps-script/Code.gs` remain unchanged.

Candidate:
`apps-script/candidates/Code_9_5_11_ATOMIC_BOOKING_IDEMPOTENCY_CANDIDATE_2026-10-01.gs`

## Contract
- Validate optional `request_id` as 8–128 characters from the existing safe character set.
- Acquire the existing document lock before uniqueness lookup.
- Persist an exact `[KK_REQ:<request_id>]` marker in Booking column T / booking note.
- Under the same lock, return the existing canonical row on redelivery instead of allocating assets or appending another Booking.
- First commit writes only the existing Booking B:T payload, flushes, then reads A:T.
- Success requires the canonical generated `booking_id` in column A for both first commit and replay.
- No automatic retry is introduced.
- Requests without `request_id` retain legacy behavior for backward compatibility.

## Safety / activation
This is a repository candidate only. It is NOT deployed to Apps Script and is NOT wired to the public LINE webhook. Production/business writes from this change: 0.

Deployment remains gated on exact-head Admin Regression, candidate provenance checks, and a controlled Apps Script deployment/acceptance step. Do not overwrite deployed 9_5_9 with canonical repository 9_5_8.
