# Rental Analytics signed-session route fix

Date: 2026-09-22 (Asia/Bangkok)
Branch: `fix/rental-analytics-session-route-20260922`
Baseline: `65bf8c95a59638b47a8f6680f785edea834fb98f`

## Incident evidence

Production deployment `dpl_8wEFecSLHHjEeVMg6NJV6XVcLPnU` showed this sequence around the reported failure:

- 20:00:28 ICT — `POST /api/kk-admin` -> 200
- 20:00:38 ICT — `POST /api/kk-rental-dashboard` -> 401
- 20:00:39 ICT — `GET /api/kk-admin-auth` -> 200
- 20:01:11 ICT — `POST /api/kk-rental-dashboard` -> 401
- 20:01:11 ICT — `GET /api/kk-admin-auth` -> 200

This proves the signed Admin session was still valid while only Rental Analytics failed.

## Root cause

The signed-session hardening intentionally stores only the browser sentinel `__SESSION__`, never the real PIN. The public Rental Analytics route is intended to rewrite:

`/api/kk-rental-dashboard -> /api/kk-rental-dashboard-v6`

However, the repository also contained a physical file-based Vercel Function at:

`api/kk-rental-dashboard.js`

That function occupied the same public route and could handle the request before the intended v6 signed-session wrapper. It therefore received `X-Admin-Pin: __SESSION__`, compared it directly with `KK_ADMIN_PIN`, and returned the exact observed error: `Invalid admin PIN`.

The Admin snapshot route did not have the same collision because `api/kk-admin.js` had already been removed and protected by a regression assertion.

## Changes

1. Moved the legacy/core Rental Analytics implementation from `api/kk-rental-dashboard.js` to `server/rental-dashboard-core.js`.
2. Updated v5 and v6 Rental Analytics internal fallbacks to require the internal server module.
3. Deleted the physical `api/kk-rental-dashboard.js` function so the public route can no longer shadow the v6 rewrite.
4. Added regression coverage requiring the shadowing file to remain absent and the internal core module to remain present.
5. Added syntax checking for `server/rental-dashboard-core.js`.

## Safety boundaries

- No Admin PIN or secret changed.
- No environment variable value changed.
- No Google Sheet data or schema changed.
- No Booking, Event, Asset, Package, or Pricing business rule changed.
- No Apps Script deployment changed.
- Existing legacy `X-Admin-Pin` compatibility remains inside the authorized v5/v6 chain.

## Expected improvement

Authenticated Admin sessions should reach the v6 authorization layer first. The server can validate the signed cookie and mark/inject authorization internally before any legacy analytics fallback runs. The browser sentinel is no longer evaluated as though it were the real PIN at the public route boundary.

## Rollback

Revert this branch/PR. No data migration or secret rollback is required because the change is routing/module placement only.
