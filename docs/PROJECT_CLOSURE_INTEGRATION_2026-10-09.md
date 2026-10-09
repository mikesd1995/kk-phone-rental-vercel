# Project closure integration — 2026-10-09

## Scope and baseline

This is a source integration and read-only reconciliation checkpoint, not production acceptance.
Base current main:231ae1b133bd1046afcb5c9e8db74fc42ffe8f6a.
Integrated existing PR661 changes using the exact diff783ed7e85493ab932e3cc1fefb3171fc003cd6a0..96c1f8652998841d6bd249022ad998cb867621e2 with three-way application onto current main. Do not replace current main with the older PR tree: that would remove newer discovery fixes.
Included PR675 date-hotfix builder and its16 tests; canonical Apps Script and recovery evidence remain unchanged.
Isolated workspace: C:/Users/s6232/Documents/Codex/2026-10-08/new-chat/work/kk-closure-integration.
Branch: fix/project-closure-20261009.

## What improved

- Project memory item with unsupported RUN_RESULT kind is classified as supported ACCEPTANCE, restoring schema-valid bootstrap without relaxing schema or granting historical text runtime authority.
- Completion evidence rejects missing/non-numeric/negative counts, pending candidates and incomplete mutation evidence. Health diagnostics no longer coerce null/empty/bool/string trigger counts into authoritative numeric evidence.
- Context retrieval preserves curated route order when scores tie, restoring intended Inbox code retrieval within the existing budget.
- Reused existing behavioral auth/Inbox/modal tests and proper offline ledger boundaries from PR661 rather than restoring obsolete implementations.
- Preserved current18 audit tiers,16 operational tiers,24 historical discovery cases,5 reference-query groups and next-month campaign lead-time window. Exact fixture expectations cover newer source behavior; none of these discovery implementations were reverted.
- A full-capacity safe-noop fixture now uses a genuinely new event; an existing event remains eligible for metadata reconciliation under newer production logic.
- Windows containment test creates a unique directory junction and proves its target resolves outside Admin before asserting rejection. Linux retains file-symlink coverage. No skip or privilege/security bypass was introduced.
- Date hotfix only builds a local candidate from verified pinned9.5.9 recovery; it does not save editor HEAD, deploy or alter triggers.

## Verification evidence

The old checkout's45 failures were not45 distinct production bugs. Four were caused by CRLF changes to exact Git source bytes; one Windows symlink fixture failed before exercising containment; others were schema/retrieval defects and stale/unsafe test fixtures addressed above.
A genuine LF checkout produced a baseline with41 failures (1443 tests), confirming the first boundary. Integrated red run had7 failures; fixture corrections yielded1477/1477 pass,0fail, offline guarded.
Full syntax command npm run check passed. Context benchmark and invariant audit passed; invariant output reported no failed checks and zero production/business mutations.
The previous attempt named date-hotfix-baseline-lf-regression.txt still had CRLF content and did not establish LF validation. Do not use its filename as evidence. Current isolated checkout source hashes and passing unchanged CSP/recovery-byte tests establish source-byte correctness.
Frontend script.js/assets/Admin implementation and canonical/recovered Apps Script have zero diff from current main. This work does not claim a new UI design or visual acceptance.
Outputs retained outside repository in ../../outputs: closure-lf-baseline.tap, closure-integrated-red.tap, closure-integrated-green.tap, closure-syntax.txt, closure-context-benchmark.txt, closure-invariants.txt.

## Cleanup partial-write reconciliation

Live source reads: backend12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU; MasterA5:Y100, ArchiveA2:Z100, StatsA2:J100.
For BK-20260908-001: exactly1 Archive match (row62),0live Master matches,1A-only Master match (row10), and B:T empty. Archive amount690, statuscompleted/paid; archived_at numeric46304.145789849536, consistent with October9 03:29:56 local spreadsheet time.
Same customer key has exactly2 archive records: BK-20260801-002 (date46235,amount1290,completed) and BK-20260908-001 (date46273,amount690,completed). Stats row33 rental_count2,first46235,last46273,updated46304.14579293982. Current count/date evidence agrees with those two records; no restore, rearchive or decrement was justified or performed.
This reconciles the identified partial booking/stat write only. It does not prove all historical fields or all prior cleanup attempts correct. The A-only ghost remains and must not be blindly deleted. Source mutation/immutable-ID hardening remains a separate required task.
PII-minimized evidence: ../../outputs/KK_CLEANUP_RECONCILIATION_2026-10-09.json. No customer phone/contact values are in this report.

## Production and acceptance boundaries

Independent source review completed: no BLOCKER or MATERIAL finding in integration scope. Reviewer independently ran 158/158 focused tests, 1477/1477 full regression (zero skips), and syntax check. Logs are retained in ../closure-independent-review-tests.log, ../closure-independent-full-tests.log and ../closure-independent-check.log. Linux symlink execution and hosted CI are not established by this Windows review. Final packaging also normalizes the runtime-runner test to LF; repository-wide diff whitespace checks must pass against the baseline, not only against an already committed HEAD.

No production merge/deploy, bound editor save, task/Make activation, provider/customer send or business data mutation was performed in this integration.
Production cleanup failure on October9 and payment450/450/690 readback remain documented in prior handoff. A corrected local parser does not establish deployed cleanup success.
Before production promotion: independent review, exact-head hosted checks under existing approved execution capacity, fresh runtime/source/policy inspection, concrete owner-approved release, rollback source and exact post-release readback are required. Do not generate repeated CI reruns or commits merely to bypass a quota/account failure.
Project is NOT CLOSED: booking immutable identity/exact-readback hardening, cleanup A-only ghosts, Mega contact, historical duplicate IDs, booked-price/receipt semantics, runtime end-to-end acceptance and owner handoff remain separate open items. Correct450/450/690 payment rows must not be rewritten.
