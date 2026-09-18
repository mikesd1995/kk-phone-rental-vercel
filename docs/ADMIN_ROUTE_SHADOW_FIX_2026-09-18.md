# KK Phone Rental — Admin Route Shadow Fix

Date: 2026-09-18

## Incident

After the first upstream-resilience patch reached production, System Guard still showed:

- snapshot events/bookings/current_bookings/assets = null
- snapshot validation = FAIL
- Apps Script version = unknown
- snapshot latency still measurable

Fresh Vercel production logs at 08:54:39 UTC showed:

- POST /api/kk-admin returned HTTP 200 to the browser
- inside the function, Apps Script returned HTTP 404 with text/html
- log classifier: GENERIC_HTML_RESPONSE
- action: snapshotHealth

This proved two separate problems:

1. the configured Apps Script upstream is currently returning 404 HTML for snapshot requests;
2. the intended v6 Admin adapter was not owning /api/kk-admin at runtime.

## Root cause: physical function shadowed rewrite

vercel.json declares:

/api/kk-admin -> /api/kk-admin-snapshot-v6

but the repository also contained a physical serverless function:

api/kk-admin.js

The live request executed that physical function instead of the intended signed-session/v6 snapshot adapter. As a result, the legacy handler converted the upstream non-JSON failure into a synthetic snapshotHealth response with null counts and HTTP 200. System Guard therefore displayed five snapshot failures instead of one Apps Script upstream root cause.

## Fix

- moved the legacy upstream proxy implementation to server/admin-proxy.js
- changed api/kk-admin-guard.js to import ../server/admin-proxy.js
- deleted api/kk-admin.js so no physical function can shadow the /api/kk-admin rewrite
- removed api/kk-admin.js from vercel.json functions
- updated syntax/test references to server/admin-proxy.js
- added regression assertions that:
  - api/kk-admin.js must stay absent
  - /api/kk-admin must rewrite to api/kk-admin-snapshot-v6
  - legacy proxy must live under server/
  - guard must import server/admin-proxy.js

## Expected runtime after deployment

Browser /api/kk-admin
 -> Vercel rewrite
 -> api/kk-admin-snapshot-v6
 -> signed-session authorization
 -> api/kk-admin-snapshot-v5
 -> read-only snapshot validation
 -> guard/server admin proxy as required

When Apps Script returns HTML/404, snapshotHealth now propagates the upstream failure instead of manufacturing null-array health as a successful response. System Guard can therefore identify the Apps Script upstream as the root cause and mark snapshot rows as downstream WARN/blocked.

## Remaining upstream configuration issue

This route fix does not invent or replace KK_ADMIN_SCRIPT_URL.

The production log proves the URL currently called by Vercel returns HTTP 404 HTML for snapshotHealth. The exact live Apps Script Web App deployment URL must be verified in Apps Script Deploy > Manage deployments and then reflected in Vercel if it changed.

The repository Apps Script is 9_5_8 and must not be deployed over the observed live 9_5_9 backend.

## Safety

No Google Sheet business rows, bookings, events, assets, prices, Scanner, Verifier, Canary, Machine SOT, API key, PIN, or Apps Script source/deployment are modified by this patch.
