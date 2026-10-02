# Apps Script Authority Readback V1 — 2026-10-03

## Purpose
Prepare canonical 9.5.13 for controlled Gate 2 acceptance without adding any mutation authority.

## New read-only evidence
`phase1Health` now exposes:
- exact `Session.getScriptTimeZone()`;
- installed project-trigger count;
- trigger handler/event/source summaries without trigger IDs;
- presence/count of `kkCleanupOldData30DaysAuto`.

The Vercel timing/readback endpoint maps this into secret-safe fields.

## Important limitation
Apps Script's installed Trigger object does not expose the original time-based schedule (for example, the exact `atHour(3)` configuration). Therefore a present cleanup trigger is reported as `VERIFIED_PRESENT_SCHEDULE_UNVERIFIED`, never as schedule-complete.

## Safety
- no Apps Script deployment;
- no trigger creation/deletion;
- no timezone mutation;
- no Script Property mutation;
- no Sheet/business writes;
- `source_equivalence` remains `UNVERIFIED` until the controlled production acceptance required by DEPLOY_README / Issue #9.
