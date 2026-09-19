# Admin direct-Sheet read-only fallback — 2026-09-19

## Incident
Production Admin authentication and frontend are healthy, while the configured Apps Script Web App intermittently/consistently returns Google HTTP 404 HTML classified as `APPS_SCRIPT_DEPLOYMENT_NOT_FOUND`. The exact live 9_5_9 Apps Script deployment remains unrecovered because owner-authenticated Apps Script access is unavailable.

## Emergency recovery boundary
This change restores **read-only Admin snapshot visibility** from the canonical Google Sheet through GViz when the Apps Script snapshot upstream fails with an eligible transport/deployment class.

It does **not** repair Apps Script and does **not** claim source/deployment recovery.

### Fallback eligibility
- Apps Script deployment 404 / recognized Google non-JSON deployment/auth page
- upstream timeout / transport failure
- 408 / 429 / 5xx snapshot failures

Application-level JSON failures such as bad API key do not silently fall back.

### Data path
The fallback reads only:
01_Events, 00_Master_Booking, 02_Assets, 03_Packages, 04_Event_Overrides, 08_Web_Ready, 09_Web_Packages, 11_Customer_Stats, 10_Admin_Health_Check, Model_Master.

All were anonymously readable through the existing backend Sheet GViz surface during the incident verification.

### Write safety
Fallback payload sets:
- `degraded_read_only=true`
- `write_actions_enabled=false`
- `snapshot_source=direct-sheet-gviz-readonly-fallback`

The Admin frontend refuses every non-read action while that flag is active. Create/update/delete/upload actions continue to require Apps Script and are never reimplemented through GViz.

### Remaining root fix
Issue #9 remains open. Recover the exact active Apps Script 9_5_9 Web App deployment, verify it with the zero-write verifier, update Production `KK_ADMIN_SCRIPT_URL`, and re-run authenticated acceptance. The fallback is an availability mitigation, not the final architecture.
