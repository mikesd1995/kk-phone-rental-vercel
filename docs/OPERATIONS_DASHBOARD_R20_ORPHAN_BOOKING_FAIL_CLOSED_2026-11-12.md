# KK Operations Dashboard R20 — active orphan Booking fail-closed integrity gate

Date: 2026-11-12 Asia/Bangkok. Draft PR #867 parent exact `027484ff15783ca0381a29285a5ff237b7b10e50`. RELEASE HOLD, not Production.

## Defect and actual code fix
When the authenticated private Snapshot contained a booking with a recognized active status but an absent event_id, or with an event_id absent from Core or Web Ready, `normalize()` previously skipped or could not associate it with any displayed event. Because the other booking counts remained plausible, a positive inventory event could still show as rentable. That is not safe evidence of zero booking conflict.

`admin/operations-dashboard.js` now detects active/unknown nonblank-status Booking records that cannot be linked to **both** Core and Web Ready. It sets a global Booking integrity HOLD for *all* readiness claims, hides verified booking counts rather than falsely asserting zero, and shows a fixed QA/gate reason. Original read-only aggregate stock is retained for investigation. Closed/cancelled unassigned rows and blank ancillary workbook rows do not revoke confirmed stock readiness. No booking IDs or customer information are logged, stored, or sent to new endpoints.

`tests/operations-dashboard-readonly.test.js` includes missing Event ID, unmatched Core/Web Ready Event ID, unexpected active-like status, and positive-control cancelled/completed/blank ancillary cases.

## Existing evidence / hard release gates
The R19 source audit (471 Events, 471 Web Ready, 84 Booking-range rows, 73 missing lock evidence, four placeholder posters, two SHOW with zero phones) and eight-width/browser CI are recorded in `docs/OPERATIONS_DASHBOARD_R19_PAGINATION_LIVE_PARITY_2026-11-12.md` and PR #867 conversation. The 4 blank-status/event-id ancillary booking rows observed there do **not** trigger this new HOLD. Those live numbers are point-in-time, not release approval.

Next: exact-new-HEAD full GitHub CI, Chromium, protected Preview readback. Still require independent engineering/security Reviewer, authenticated signed Admin UAT on approved private source, event-level lock/poster/status reconciliation, and explicit owner Production Release authorization. Never merge, deploy Production, change Sheets, secrets, Booking, prices, Owner Locks, stock, X, ACL, or weaken SSO to clear the gate.