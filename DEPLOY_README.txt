KK Phone Rental — DEPLOYMENT SAFETY NOTICE
Updated: 2026-09-28

CRITICAL — GOOGLE APPS SCRIPT IS FAIL-CLOSED

The repository file apps-script/Code.gs is NOT the authoritative production source at this time.

Verified state:
- Canonical repository apps-script/Code.gs remains the hardened v16.7.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX lineage.
- Production audit reports v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX.
- The exact deployed-recovery 9_5_9 artifact has now been recovered and archived at apps-script/recovered/Code_9_5_9_DEPLOYED_RECOVERY_2026-09-20.gs.
- Recovered artifact size is 118,157 bytes with SHA-256 40fffe288d55c1991fda1bd133670b7b41f90822acd834ec887e00c1f0f1b87e, matching the previously documented deployed-recovery fingerprint.
- Regression review proved the recovered 9_5_9 artifact does NOT contain the later owner-hidden re-open guard currently present in canonical repository Code.gs.
- GitHub issue #9 therefore remains the source-equivalence / hardening reconciliation gate, even though exact source provenance is now recovered.

DO NOT:
1. DO NOT replace the production Apps Script Code.gs with apps-script/Code.gs from this repository.
2. DO NOT deploy apps-script/recovered/Code_9_5_9_DEPLOYED_RECOVERY_2026-09-20.gs directly; it is archival evidence, not a deployment candidate.
3. DO NOT create a new Apps Script deployment while issue #9 hardening/equivalence acceptance remains unresolved.
4. DO NOT treat a matching API response, version label, or recovered fingerprint as proof that later repository safety guards are already present in production.
5. DO NOT modify production booking/event rows to test source recovery.

SAFE APPS SCRIPT ACTIONS WHILE ISSUE #9 IS OPEN:
1. Preserve the recovered artifact byte-for-byte as provenance evidence.
2. Diff recovered 9_5_9 against canonical repository Code.gs and classify every behavior delta.
3. Reconcile production fixes with later repository safety guards into a separate reviewed candidate; do not mutate the archived artifact.
4. Require regression tests and controlled acceptance before any future Apps Script deployment.
5. Keep production unchanged until that reconciled candidate has explicit acceptance.

VERCEL / FRONTEND
- Vercel changes must continue through pull request review and the current CI/Preview acceptance gates.
- Do not bypass a failed or rate-limited Preview by merging a runtime-impacting change directly to production.
- Apps Script source recovery is a separate gate; a successful Vercel deployment does not authorize Apps Script replacement.

LEGACY NOTICE
The previous Phase 3.9.5.4 instruction to "Replace Code.gs with apps-script/Code.gs from this package" is retired and unsafe for the current production state.

CURRENT SAFETY RULE
Production Apps Script 9_5_9 remains protected until exact source recovery or independently proven source equivalence is completed and documented. Exact source recovery is now complete as provenance, but deployment equivalence remains intentionally NOT accepted because the recovered artifact lacks at least one later owner-visibility safety guard.
