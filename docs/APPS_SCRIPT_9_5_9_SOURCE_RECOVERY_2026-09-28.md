# Apps Script 9_5_9 source recovery — 2026-09-28

## Objective
Recover the exact deployed-recovery Apps Script source into Git without deploying or changing the live Apps Script project, then determine whether it is safe to replace the canonical repository source.

## Provenance evidence
- Library source: `KK_Phone_Rental_Code_9_5_9_RECOVERY.gs`
- Materialized size: **118,157 bytes**
- SHA-256: `40fffe288d55c1991fda1bd133670b7b41f90822acd834ec887e00c1f0f1b87e`
- This matches the deployed-recovery fingerprint already recorded in `docs/GATE2_DATA_INTEGRITY_REPAIR_EXECUTION_2026-09-20.md` and `docs/APPS_SCRIPT_TIMING_RUNTIME_READBACK_2026-09-27.md`.
- Recovered runtime identity: `v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX`.

The exact artifact is stored byte-for-byte in:

`apps-script/recovered/Code_9_5_9_DEPLOYED_RECOVERY_2026-09-20.gs`

## Validation
- The recovered source parses successfully with Node after copying the same bytes to a temporary `.js` filename. Direct `node --check` on the `.gs` extension is unsupported by Node and was not treated as a code failure.
- Branch readback of the archived source is an exact text match to the recovered Library source.
- No live Apps Script deployment, trigger, Script Property, Google Sheet business row, booking, price, stock, or visibility state was changed.

## Regression finding and safe fallback
The first attempt replaced canonical `apps-script/Code.gs` with the recovered artifact. Admin Regression correctly failed two tests:

1. the deployment safety guard intentionally required review when the repository Apps Script version changed;
2. more importantly, `event-visibility-reactivation-regression.test.js` proved the recovered artifact lacks the later `ownerReopenIntent` / `EVENT_VISIBILITY_OWNER_LOCKED` protection present in canonical repository source.

Therefore the first replacement attempt was rolled back on the branch. Canonical `apps-script/Code.gs` remains unchanged from main and the exact recovered artifact is archived separately.

## Safety conclusion
**SOURCE PROVENANCE = RECOVERED. DEPLOYMENT EQUIVALENCE = NOT ACCEPTED.**

Do not deploy either source merely because the production version label is 9_5_9. The next Apps Script deployment candidate must reconcile the production 9_5_9 fixes with later repository safety guards and pass regression + controlled acceptance. The archived recovered artifact must remain immutable evidence.
