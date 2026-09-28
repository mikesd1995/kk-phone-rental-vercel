# Apps Script 9_5_9 source recovery — 2026-09-28

## Objective
Recover the exact production Apps Script recovery source into Git without deploying or changing the live Apps Script project.

## Evidence
- Library source: `KK_Phone_Rental_Code_9_5_9_RECOVERY.gs`
- Materialized size: **118,157 bytes**
- SHA-256: `40fffe288d55c1991fda1bd133670b7b41f90822acd834ec887e00c1f0f1b87e`
- This matches the deployed-recovery fingerprint already recorded in `docs/GATE2_DATA_INTEGRITY_REPAIR_EXECUTION_2026-09-20.md` and `docs/APPS_SCRIPT_TIMING_RUNTIME_READBACK_2026-09-27.md`.
- Recovered runtime identity: `v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX`.
- Repository preimage was `v16.7.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX`.

## Validation
- The recovered source parses successfully with Node after copying the same bytes to a temporary `.js` filename. Direct `node --check` on the `.gs` extension is unsupported by Node and was not treated as a code failure.
- GitHub branch readback of `apps-script/Code.gs` is an exact text match to the recovered Library source.
- No live Apps Script deployment, trigger, Script Property, Google Sheet business row, booking, price, stock, or visibility state was changed by this recovery.

## Safety
This commit is source-provenance recovery only. Deployment of Apps Script remains a separate action and must never deploy an older 9_5_8 source over the current production 9_5_9 runtime.
