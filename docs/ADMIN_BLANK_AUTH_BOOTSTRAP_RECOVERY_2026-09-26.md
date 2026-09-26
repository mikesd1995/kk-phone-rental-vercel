# Admin blank authenticated workspace recovery — 2026-09-26

## Incident

An authenticated operator could enter `/admin/app` and see a blank workspace even though the Admin snapshot backend was healthy.

Production evidence around 08:21 ICT showed:

- `POST /api/kk-admin-auth` -> 200
- `GET /admin/app` -> 200
- protected Admin JS/CSS assets -> 200
- `POST /api/kk-admin` -> 200
- snapshot source -> `direct-sheet-gviz-readonly-fallback`
- 130 events / 31 bookings / 18 current bookings / 5 assets
- write health -> healthy

Therefore the incident was not missing Sheet data and not an Admin snapshot outage.

## Root cause

The protected server response intentionally hides the obsolete inline PIN form before first paint. The workspace itself remained `class="hidden"` until `admin.js` initialized.

The signed-session bridge tried to save the sentinel `__SESSION__` in `sessionStorage` inside a try/catch. However `admin.js` then performed an unguarded `sessionStorage.getItem(...)` during top-level initialization.

On browsers/privacy contexts where sessionStorage access is denied or unavailable, this can throw before Admin bootstrap runs:

- server-hidden login panel stays hidden;
- workspace panel stays hidden;
- valid signed session and healthy snapshot remain unusable;
- operator sees a blank page.

This failure mode is especially relevant to mobile Safari/privacy storage conditions.

## Repair

1. `admin/session-bridge.js`
   - marks the protected page in memory with `window.KK_ADMIN_SIGNED_SESSION=true`;
   - reveals the authenticated workspace immediately without relying on Web Storage;
   - keeps the sentinel write as a best-effort compatibility path;
   - exposes a visible recovery status if later client bootstrap throws.

2. `admin/admin.js`
   - wraps sessionStorage reads/writes;
   - uses the in-memory signed-session marker as the canonical fallback;
   - preserves the existing `__SESSION__` compatibility path;
   - keeps the authenticated shell visible while the snapshot loads.

3. `admin-login.html`
   - makes sessionStorage marker writes/removals best-effort;
   - successful cookie authentication always proceeds to `/admin/app` even if Web Storage is blocked.

## Safety boundary

No Booking, Event, Package, price, Asset, Stock, Google Sheet, Apps Script, scanner, Machine SOT, secret, or environment value is changed.

The signed HttpOnly cookie remains the actual authentication authority. The in-memory marker only lets the already-protected Admin page bootstrap its existing UI.
