# Apps Script health evidence repair — 2026-10-07

## Scope and result
Follow-up to PR #661, base head 486b236e0d9a928496390e73acedec97e82690d5.
Fixed two numeric-coercion defects in api/kk-intelligence-health.js. Missing/invalid counts such as null, empty strings, numeric strings, booleans, arrays, negative/fractional or unsafe numbers must not become verified count evidence. Both installed and cleanup counts now require nonnegative safe integer numbers. Explicit numeric zero remains accepted.

## Verification
- Before fix: 19 tests, 11 pass / 8 fail; regression failures demonstrate coercion bug.
- After fix: scoped Apps Script suite 29/29 pass.
- Independent reviewer: 19/19 pass, approved narrow two-file fix, no blockers.
- Full isolated suite: 1454/1454 pass, zero skips/failures, offline guard enabled.
- Initial shared-workspace full test failed due to an unrelated truncated tests/admin-direct-writer-control-source.test.js (SyntaxError at line 69). This file was not modified or published by this repair. Verification used an isolated worktree at fa2a50a plus only the two repair files.

## Fresh runtime evidence
Production health response at 2026-10-07T12:38:28Z (19:38 Bangkok): HTTP 200, READBACK_COMPLETE, cache MISS. Effective UTC+07 and backend sheet identity verified. Runtime reports v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX; expected v16.7.0_CRM_PRO_PHASE3_9_5_13_FULL_BACKEND_AUDIT. Version mismatch persists. Source equivalence, named project timezone, installed triggers and cleanup remain UNVERIFIED. Earlier timeout did not reproduce on this request; its root cause remains unknown, no timeout increase applied.
Recovered 9_5_9 diagnostics source omits project authority fields, consistent with missing evidence; this is not proof of deployed source equivalence.

## CI and release blockers
Run 37614665338 / job 112769997513: failure, steps=[], runner_id=0. Checks annotation endpoint is unsupported by connected GitHub API. No billing/runner administrative capability available. Billing/quota root cause is NOT established. Do not rerun repeatedly or bypass required gates.
This repair is source-ready only; production acceptance requires required CI, exact release source/environment and post-release readback. No production deployment, trigger mutation, Google Sheet business write, customer send, or paid operation was performed.

## Cross-chat continuation
1. Read current #661 head before editing: parallel work may advance main or PR.
2. Restore actual CI execution through an authorized GitHub account administration path; do not replace required checks with local pass claims.
3. Obtain authorized Apps Script project/deployment access, compare active source and deployment version; upgrade through existing release process, then read back version/timezone/triggers. Never blindly deploy repository Code.gs over recovered runtime.
4. Complete governed end-to-end discovery/storefront/LINE/booking/stock/revenue acceptance only after release prerequisites pass; preserve owner suppression per event/date.
5. Preserve unrelated shared workspace changes. Published delta in this continuation is exactly two code/test files and this document.
