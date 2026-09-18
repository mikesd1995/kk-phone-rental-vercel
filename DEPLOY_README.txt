KK Phone Rental — DEPLOYMENT SAFETY NOTICE
Updated: 2026-09-15

CRITICAL — GOOGLE APPS SCRIPT IS FAIL-CLOSED

The repository file apps-script/Code.gs is NOT the authoritative production source at this time.

Verified state:
- Repository apps-script/Code.gs reports v16.7.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX.
- Production audit reports v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX.
- Exact live 9_5_9 source has not yet been recovered into this repository.
- GitHub issue #9 tracks source recovery and equivalence acceptance.

DO NOT:
1. DO NOT replace the production Apps Script Code.gs with apps-script/Code.gs from this repository.
2. DO NOT create a new Apps Script deployment from repository Code.gs while issue #9 remains unresolved.
3. DO NOT treat a matching API response or version label as source equivalence.
4. DO NOT modify production booking/event rows to test source recovery.

SAFE APPS SCRIPT ACTIONS WHILE ISSUE #9 IS OPEN:
1. Inspect the currently bound production Apps Script project using the authorized Google account.
2. Export/copy the exact live project source without modifying or deploying it.
3. Commit the recovered source to a review branch with no behavior changes.
4. Diff recovered 9_5_9 against repository 9_5_8 and preserve every production change.
5. Require regression tests and controlled acceptance before any future Apps Script deployment.

VERCEL / FRONTEND
- Vercel changes must continue through pull request review and the current CI/Preview acceptance gates.
- Do not bypass a failed or rate-limited Preview by merging directly to production.
- Apps Script source recovery is a separate gate; a successful Vercel deployment does not authorize Apps Script replacement.

LEGACY NOTICE
The previous Phase 3.9.5.4 instruction to "Replace Code.gs with apps-script/Code.gs from this package" is retired and unsafe for the current production state.

CURRENT SAFETY RULE
Production Apps Script 9_5_9 remains protected until exact source recovery or independently proven source equivalence is completed and documented.
