---
name: kk-reliability-learning
description: Project-local incident-learning and recurrence-prevention contract for KK Phone Rental.
---

# KK Reliability Learning

## Purpose

Use this skill when diagnosing a repeated KK Phone Rental engineering/runtime problem or reviewing a proposed repair.

The objective is not autonomous self-modification. The objective is to **remember proven incident patterns, reuse known repair recipes, require regression guards, and stop solving the same failure from scratch**.

## Authority

This skill is advisory only.

It must never directly:

- write Machine SOT business truth;
- change active policy;
- enable/disable/clone/reschedule Scanner or Verifier;
- change final pricing, booking, inventory, Core event state, provider state, Make scenarios, Apps Script or Vercel production;
- merge or deploy code;
- upgrade root-cause certainty beyond the evidence.

## Required incident workflow

1. Preserve the failing evidence before repair.
2. Normalize the symptom into a failure fingerprint.
3. Check `config/kk-reliability-memory.json`.
4. If fingerprint is known, reuse the known repair and its regression guards before proposing a new component.
5. If unknown, isolate the first failing boundary and keep root cause `UNKNOWN` or `PROBABLE` until proven.
6. A durable repair is not learned until there is a regression guard/test or an explicit reason that automated regression coverage is impossible.
7. Use `proposeMemoryUpdate` to create an advisory memory patch. Human review is mandatory.
8. After repair, record evidence/readback and remaining risk.

## No-repeat rules

- Timer/task metadata is never runtime proof.
- API/scenario success is never exact readback/provider-delivery proof.
- Physical row position is never stable identity.
- Do not backfill a missed runtime as PASS.
- Do not create a replacement runner/watchdog for a scheduler symptom.
- Do not create a bypass transport to hide Make credit exhaustion.
- Do not revive stale competitor prices.
- Do not mark notification SENT without provider evidence.
- Do not retry non-idempotent mutations blindly.
- Do not inflate recurring launcher prompts; current detailed rules belong in Machine SOT.

## Reuse path

The existing `scripts/kk-system-audit.js` is the integration point. When a snapshot includes `reliability_observations` or `incidents`, it should run the read-only Reliability Learning Agent.

No new recurring task is required. If continuous observation is later justified, fold a read-only reliability summary into an already-authorized closure/audit path instead of adding another competing runner.
