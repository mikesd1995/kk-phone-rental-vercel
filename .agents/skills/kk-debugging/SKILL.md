---
name: kk-debugging
description: Use when KK Phone Rental is broken, flaky, returning errors, deploying incorrectly, or showing a recurring regression. Prioritizes runtime evidence and first-failing-boundary isolation before code edits.
---

# KK Debugging

## Evidence order

1. Current user-visible symptom.
2. Runtime/deployment/workflow logs.
3. Exact current production/source SHA and environment binding.
4. Relevant context pack from npm run code:context.
5. Existing incident fingerprint in Reliability Learning.
6. Only then inspect or patch source.

## Boundary isolation

Classify the first failing boundary before editing:

    browser/UI
      -> public API
      -> admin/auth gate
      -> upstream/Apps Script/Google
      -> control plane
      -> database/runtime ledger
      -> deployment/environment

Do not patch downstream symptoms if an upstream boundary is already proven broken.

## Required closeout

- Add a regression test for reproduced defects when feasible.
- Require exact readback after repair.
- Root cause remains UNKNOWN or PROBABLE until proven.
- Record a reusable incident pattern for repeated failures.
- Never create a replacement runner/watchdog for scheduler symptoms.
