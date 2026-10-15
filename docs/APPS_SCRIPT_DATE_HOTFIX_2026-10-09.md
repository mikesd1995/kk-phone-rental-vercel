# KK Apps Script date hotfix — candidate and handoff, 2026-10-09

## Current outcome

LOCAL_CANDIDATE_ONLY. No editor HEAD save, deployment, trigger change, protected merge or business mutation was performed by this repair agent. Production cleanup is NOT fixed yet.

Live payment readback on October 9 already matches owner-supplied amounts: Master row46 BK-20261008-001 and row47 BK-20261008-002 each received450, final price450, balance0, completed/paid; row51 BK-20261007-001 received690, final price690, balance0, completed/paid. These corrections existed when read; do not attribute them to this agent. No payment-provider/bank confirmation was performed. Earlier October8 pending-payment conclusions are superseded for these three rows only.

## Runtime evidence and root cause

Canonical bound Apps Script project: 1dSxVSGm8GJvAxdCqacY7-lzT6IhbGC5cqcq0Wh9j1d3z4Hsz_Fhw4vL9, opened from the backend spreadsheet Extensions menu.
Backend spreadsheet: 12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU.
Editor source on October8 matched the recovered9.5.9 file exactly after CRLF-to-LF normalization: SHA256 40fffe288d55c1991fda1bd133670b7b41f90822acd834ec887e00c1f0f1b87e. This proves editor equivalence at that observation, not immutable version52 source equivalence or a future HEAD.
Deployment management showed active version52 dated2026-09-20 22:48; execution records on October9 still identify doPost version52.
Project timezone Asia/Bangkok. One observed installed time trigger: kkCleanupOldData30DaysAuto, executing HEAD. Saving HEAD is therefore production-affecting even without publishing a web-app version.

Observed failure October9 03:29:50 (6.717 seconds), log03:29:57:

    Error: Invalid date: 14/11/2026
      kkDateObj_ (รหัส:325:33)
      cleanup event iteration (รหัส:2505:29)
      kkCleanupOldData30Days_ (รหัส:2503:27)
      kkCleanupOldData30DaysAuto (รหัส:2567:3)

October6/7/8 cleanup executions also showed failed status; October4/5 showed completed. Completion status alone is not exact business acceptance.
The original helper uses native new Date(value), which misinterprets or rejects dd/MM/yyyy strings.

## Minimal implementation

scripts/build-apps-script-date-hotfix.js builds from the pinned recovery source, rejects hash drift, changes only kkDateObj_, and writes a new local output with exclusive-create semantics. It has no Google API or deployment calls.
The helper explicitly parses padded dd/MM/yyyy, rejects invalid calendar rollover, preserves valid Date identity and existing ISO/numeric fallback behavior. It deliberately does not promise strict validation of all other formats or Buddhist-year conversion.
Canonical apps-script/Code.gs and the recovered evidence file remain unchanged. Do not replace production with all9.5.13 changes.
Generated candidate LF SHA256: bd30c81e9d449cf44e5eef6d65b1db141e6e28c1b7376151f1be09fd9d9a49cf.

    node scripts/build-apps-script-date-hotfix.js <new-output.gs>

## Validation and independent review

Red stage reproduced the original failure before patching. Sixteen behavioral tests execute the actual generated candidate, including leap days, ambiguous dates, invalid Date, base drift, complete-source syntax, helper-only diff, Bangkok date key and actual cleanup retaining a future event with no sheet mutation and lock release. Test worker timezone is explicitly Asia/Bangkok.
Targeted:16 hotfix +20 selected existing regressions =36 passed,0 failed. Syntax checks and git diff --check succeeded (existing CRLF warning only).
Full offline-guarded candidate suite:1445 tests,1400 passed,45 failed.
Clean detached baseline at231ae1b133bd1046afcb5c9e8db74fc42ffe8f6a under the same environment:1429 tests,1384 passed,45 failed.
The normalized unique failure-name sets are identical (45 each). This is evidence of no additional observed test failures, NOT a green full suite. Windows checkout/environment and pre-existing source/test mismatches remain to be resolved; no assertion was weakened.
Planner: booking_upgrade_planner. Independent reviewer: date_hotfix_review. Reviewer independently ran36/36, found no blocker/material defect in this narrow candidate; noted timezone portability, now fixed with explicit test-worker TZ. Review is source-scoped, not production acceptance.

## Partial cleanup reconciliation and risk

Cleanup updates customer stats and writes booking archive/clears Master before the event loop that failed. A failed execution does NOT imply zero writes.
Live October9 bounded readback found61 booking archive rows (previous October8 snapshot60). New Archive row62 has source_row10, booking_id BK-20260908-001, event Mr.Kill Final EP. FAN MEETING, event date8September, archived_at9October. Master A10:T10 now contains only the A-column booking ID. Customer Stats E:J has a matching event with rental_count2, first1August, last8September, updated9October.
These are observations consistent with partial cleanup, not proof of exact actor/time causality or absence of all historical duplication. The remaining A-only ID also aligns with the blank task seen in Admin; do not delete it blindly or call identity repair complete.
No manual cleanup rerun was performed. Do not restore cleared rows, decrement statistics or repeat archive writes without exact keyed reconciliation.

## Release gates and next safe action

Engineering execution gate remains BLOCKED: full risk regression is not green and RELEASE_READBACK is false. Candidate source completion is distinct from deployment acceptance.
Before any release: resolve the45 baseline failures in an isolated verification context; refresh exact live HEAD/hash, deployment and current highest-compatible Active policy; reconcile Master/Archive/Customer Stats for previous partial runs; establish rollback source and an exact expected-change packet; obtain explicit owner approval for the concrete HEAD/save/deployment action under repository production rules. Do not introduce or change schedules, activate Make, bypass locks, or run destructive cleanup as a test.
After any authorized release require source readback and real task-specific runtime/readback; version strings or completed execution alone are insufficient.

## Cross-chat continuation

Workspace: C:/Users/s6232/Documents/Codex/2026-10-08/new-chat/work/kk-reconciliation.
Branch: fix/apps-script-date-parser-20261008. Base231ae1b133bd1046afcb5c9e8db74fc42ffe8f6a, freshly fetched October9 without drift.
User-facing evidence is in ../../outputs: KK_PAYMENT_READBACK_2026-10-09.json; Code_9_5_9_DATE_HOTFIX_CANDIDATE.gs; date-hotfix-targeted.txt; date-hotfix-full-regression.txt; date-hotfix-baseline-regression.txt. Earlier reconciliation artifacts remain historical snapshots.
Remaining separate work: missing Mega contact, historical duplicate booking IDs, mixed booked-price/received-amount semantics, immutable booking allocator/readback hardening, A-only cleanup ghosts. Do not mark them repaired by this date helper.
