# Project memory schema recovery — 7 October 2026 evening

Main baseline: 783ed7e85493ab932e3cc1fefb3171fc003cd6a0. Current main contains newer storefront work; it is preserved.

## Confirmed root cause

The checked-in October reconciliation record used kind RUN_RESULT, outside the closed memory schema. buildBootstrap validates the complete corpus before domain filtering, so this single invalid discovery record blocked unrelated content/reliability/X agent routes with BLOCKED_PROJECT_MEMORY_UNAVAILABLE / PROJECT_MEMORY_BOOTSTRAP_BLOCKED.

## Repair

Change only that record's kind to existing ACCEPTANCE. The historical summary, evidence, owner intent and suppression semantics are unchanged. This classification does not independently certify the historical claims. PR #665 owns the newer owner-suppression correction; do not treat this historical record as authority to reopen any event.

Add regression validating the entire checked-in corpus and another proving RUN_RESULT still fails closed. Do not broaden valid kinds or bypass memory validation.

## Evidence

- Before fix: project-memory tests 5/8 pass, including new corpus test FAIL with KIND_INVALID.
- After fix: independent reviewer 8/8 PASS under offline network guard; approved narrow fresh PR.
- Integrated current-main text snapshot plus reviewed PR #661: full suite 1430/1445 pass, 15 failures. This is NOT a green full suite or production acceptance.
- Remaining failures: legacy workflow/UI/Inbox source assertions, Code Intelligence Inbox routing, monthly-tier expectations, and three content/X bridge fixtures. Investigate separately without weakening gates.
- Business writes, customer messages and publishes: 0.

## Release and cross-chat

PR #661 remains a separate unmerged acceptance patch. Local integration includes it for testing, but this new PR contains only memory classification, its tests and this record. No frontend changes are included. Read current PR body for hosted CI/deployment identity after publication. Production acceptance still requires actual source deployment and readback; local tests do not establish that.
