# CI / Witness / Deployment triage — 2026-09-28
## Scope and conclusion
Owner-authorized investigation of Admin Regression, KK External Witness Clock V2 and Vercel deployment limits. This change improves failure diagnostics only. It does not restore witness acceptance or deploy the public-text hotfix.

## Corrected evidence
- Admin run 36348089593 was event pull_request, branch hotfix/public-text-boundary-final-20260928, SHA ceb5eec33c3e986a7e7c9d5c18165883f9c50f31. It was not a main run.
- Its Regression tests step passed 801/802. Failure: machine-style customer text is blocked generically, not by one incident token; tests/storefront-detail-hardening.test.js:91; ERR_ASSERTION false !== true.
- PR #264 current head 94c0cb65d823befda8db26a0d7ac6dc4589182a6 has two successful admin-regression checks (108701574316, 108701498316). PR remains open.
- Main 749ea8ec4a640cd8eabfb0edbe54229e10e02a6b has successful Admin Regression run 36371044396. Main's current test file does not contain the old failing PR assertion. A green main suite is not proof the PR #264 sanitizer was released.
- Vercel deployment dpl_c3NVGBwKPRRd1wrQcKTFw79qbKfQ is READY, target production, exact main SHA 749ea8ec4a640cd8eabfb0edbe54229e10e02a6b, alias kk-phone-rental.vercel.app.
- PR #264 exact-head Vercel status still reports deployment rate limited. This status describes that attempt; it does not prove that account quota remains exhausted after the later production success.

## Witness root causes
1. Run 36362495108: dispatch_offset_minutes=30, HTTP 400 TRIGGER_SCHEDULE_STALE.
2. Run 36351032525: dispatch_offset_minutes=15, HTTP 503 WITNESS_KILL_SWITCH_DISABLED.
3. Run 36248129763: dispatch_offset_minutes=19, same disabled-gate rejection.
4. Read-only SQL confirms exactly one returned github_oidc_witness_v1 configuration row with enabled=false.
5. Live Edge function version 2 source equals main source byte for byte. MAX_RECEIVE_LAG_MS is 25 minutes; trigger time validation occurs before reading the kill switch.
6. Therefore the stale error masks the later disabled-gate check on late arrivals. Vercel is not in the witness request path.
7. docs/GITHUB_OIDC_WITNESS_V424_DUAL_ATTEMPT_2026-09-22.md explicitly requires the kill switch FALSE until acceptance and has a governed activation checklist. It is not safe to flip it merely to silence failures.

## Change
- Existing workflow now reports SCHEDULE_WINDOW_EXCEEDED only for HTTP 400/TRIGGER_SCHEDULE_STALE.
- It reports CONTROL_GATE_DISABLED only for HTTP 503/WITNESS_KILL_SWITCH_DISABLED.
- Other failed Edge responses report EDGE_REJECTION_UNCLASSIFIED.
- Static GitHub error annotations explain the two known cases.
- Original rejection throw, cron, OIDC claims, represented hour, retry behavior, Edge rules and authority checks are preserved.
- Five behavior tests execute the actual inline workflow with isolated HTTP responses: stale, disabled, unknown failure, accepted witness and authority violation.
- No secrets or response bodies are added to diagnostic output.

## Verification
- Red: new tests initially 2 passed / 3 failed because classification was absent.
- Green: new tests 5/5 passed.
- Combined targeted tests: 13/13 passed, including existing OIDC/witness contract tests.
- Local checkout is a bounded connector-materialized subset because authenticated git clone was unavailable. Full suite must be verified in GitHub CI on the resulting branch/commit; local targeted tests are not represented as full regression.
- Independent reviewer compared the original workflow blob and reran 13/13 tests: no BLOCKER or MATERIAL findings; diagnostics-only scope confirmed.
- Release readback is pending; diagnostics are not yet active on main.

## Safest next order
1. Keep Admin old-run failure closed as superseded PR evidence; assess main and PR by exact SHA.
2. Review and CI-test this diagnostics-only branch.
3. Recover exact-head Preview for #264 through the existing Vercel release path; verify intended source, environment, rollback target and public-boundary behavior before release.
4. Before witness activation, verify all current policy/runtime preconditions in the v4.9.24 contract, including exact1 active policy and OFF states.
5. Preserve the 25-minute ingress limit. Do not backfill, retime missed occurrences, manually rerun for acceptance credit or add another clock.
6. Witness acceptance requires six consecutive natural persisted hourly slots; this investigation earns zero acceptance credit.

## Sources
- https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/36348089593
- https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/36371044396
- https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/36362495108
- https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/36351032525
- https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/36248129763
- https://github.com/mikesd1995/kk-phone-rental-vercel/pull/264
