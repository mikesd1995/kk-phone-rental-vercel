# Owner-hidden event reactivation incident — 2026-09-27

## Incident

Two events that had previously been intentionally hidden from the KK Phone Rental storefront reappeared:

- EVT-20261003-MANUTSAWEE-SAD-SONGS-CONCERT
- EVT-20261010-YOUNG-K-YOUNGEST-BANGKOK

The storefront itself was behaving correctly. The source visibility field in `01_Events` had been changed back to TRUE.

## Evidence

`15_Admin_Audit_Log` shows both events were hidden on 26 Sep 2026:

- row 1276 — manutsawee updateEvent finished with `web_ready_action=hide`
- row 1278 — Young K updateEvent finished with `web_ready_action=hide`

Later ultra-deep sync activity explicitly reactivated the same Core rows:

- row 1299 — `syncNextWeekStorefrontEvents` recorded `reactivated_event_id=EVT-20261003-MANUTSAWEE-SAD-SONGS-CONCERT`
- row 1301 — `syncNextWeekStorefrontEvents` recorded `reactivated_event_id=EVT-20261010-YOUNG-K-YOUNGEST-BANGKOK`

This was an authority bug: scan/sync logic treated an existing hidden event as something to republish instead of preserving owner storefront intent.

## Immediate repair

Restored `01_Events.active_on_web=FALSE` for both affected rows.

Readback:

- `08_Web_Ready` reports `ซ่อนจากเว็บ`
- `action_for_web=hide`
- public live feed reports both events as hidden

Package price/visibility overrides were not changed by this repair.

## Permanent guard

Added `server/event-visibility-owner-guard.js`.

Rule:

- visible → hidden: allowed
- hidden → hidden: allowed
- hidden → visible: blocked unless the request contains explicit owner reopen intent
- explicit owner/Admin reopen: allowed

Defense in depth:

1. Admin API checks current event visibility before allowing an implicit re-open.
2. Direct Google Sheets writer enforces the same transition guard.
3. Admin UI adds the explicit reopen intent only for deliberate owner visibility actions.
4. Scanner skill forbids auto-reactivating owner-hidden Core events.
5. Verifier skill treats owner-hidden Core events as present-but-hidden, not missing promotion debt.
6. Regression tests lock the contract.

## Authority rule

Discovery or weekly sync may discover, verify, reconcile, or report an existing event, but it must never convert `active_on_web=false` to TRUE.

Only an explicit owner/Admin storefront visibility action may reopen a hidden event card.
