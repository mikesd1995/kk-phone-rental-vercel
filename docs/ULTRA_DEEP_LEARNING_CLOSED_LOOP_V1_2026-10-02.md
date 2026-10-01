# Ultra Deep Learning Closed Loop V1 — 2026-10-02

## Problem
A partial discovery result was previously described as a completed Ultra Deep Scan. PR #431 prevents that completion claim. This change makes the incident durable learning evidence and adds a bounded path for verified future misses to become regression proposals.

## Changes
- Added reliability fingerprint `ULTRA_DEEP_PREMATURE_COMPLETION` with the full-loop repair and regression guards.
- Added `kk-ultra-deep-learning-loop.js`.
- A missed event may become a known-miss proposal only when the event is verified, the prior miss is explicit, the date is canonical, and a verified HTTPS source plus search signature exist.
- Learning acceptance requires preserved original failure evidence, known-miss regression PASS, live discovery acceptance PASS, and no increase in missed-event count.
- Registered `learn_ultra_deep_miss` and `accept_ultra_deep_learning` through Agent Registry/Gateway routing.
- Scanner remains staging-only. Learning has zero business writes and cannot auto-apply, auto-merge, auto-deploy, alter pricing, or publish storefront data.

## Expected improvement
Repeated misses can be converted into deterministic regression pressure rather than remaining chat-only lessons. The system cannot claim that a learned repair worked until both deterministic regression and a live discovery rerun prove it.

## Remaining boundary
This does not auto-edit the static known-miss corpus. The proposal remains review-gated by design so an unverified rumor cannot poison durable learning memory. Production storefront writes remain exclusively behind the existing governed Admin executor and exact readback.
