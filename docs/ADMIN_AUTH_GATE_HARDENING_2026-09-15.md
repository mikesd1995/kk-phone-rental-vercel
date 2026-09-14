# KK Phone Rental — Admin Login Gate Hardening

Date: 2026-09-15 (Asia/Bangkok)
Final branch: `security/admin-login-gate-final-20260915`
Baseline: latest `main` at branch creation (`62b479126c3f63956b033a98004c0b267b96c61d`)
Supersedes iterative branch/PR: `security/admin-login-gate-20260915` / PR #27

## Objective

Before authentication, `/admin` must expose only a minimal Admin PIN form. Anonymous visitors must not receive the Admin CRM workspace, navigation labels, operational/version details, the real Admin PIN, or protected Admin JavaScript/CSS/HTML. After a valid PIN is entered, the existing Admin workflow should continue with the smallest possible business-logic change.

## Previous behavior

The legacy `/admin` route rewrote directly to `/admin/index.html`. The page hid the main app until PIN-backed API initialization completed, but the complete Admin HTML and associated static assets were still publicly addressable before authentication. The legacy browser flow also persisted the real Admin PIN in `sessionStorage` and reused it as `X-Admin-Pin` for Admin API requests.

## Final architecture

1. `/admin` and `/admin/` rewrite to the new static `admin-login.html` gate.
2. The public gate contains only the KK mark, Admin PIN input, submit button, and generic status text.
3. `/api/kk-admin-auth` rewrites internally to the existing `api/kk-admin-snapshot-v6.js` function with `__kk_gate=auth`.
4. The auth handler validates the PIN server-side using a timing-safe comparison.
5. On success the server issues `__Host-kk_admin_session`, an HMAC-SHA256 signed cookie with `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, and an 8-hour maximum age.
6. The browser stores only the compatibility sentinel `__SESSION__`; it does not persist the submitted PIN.
7. `/admin/app` rewrites to the same existing v6 function with `__kk_gate=app`. The function validates the signed session before reading and returning the Admin HTML.
8. Other `/admin/:path*` requests rewrite to the same existing v6 function with `__kk_gate=asset`. The function validates the signed session before reading Admin CSS/JS/HTML/font/image files and rejects traversal attempts.
9. The returned Admin HTML injects `admin/session-bridge.js` before the existing Admin bootstrap. The bridge keeps only the sentinel, clears the server cookie on logout, and returns the browser to `/admin` when a protected Admin API reports an expired/invalid session.
10. `/api/kk-admin` remains routed to `api/kk-admin-snapshot-v6.js`, but v6 now requires either a valid signed session or the existing correct legacy `X-Admin-Pin` before continuing into the unchanged v5/guard/business stack.
11. `/api/kk-rental-dashboard` remains routed to `api/kk-rental-dashboard-v6.js`, which now applies the same authorization layer before its existing freshness/reconciliation/private-read logic.
12. `server/admin-session.js` is intentionally outside `/api` so the hardening does not create additional Vercel Function entry points.

## Files added

- `admin-login.html` — minimal public PIN-only gate.
- `admin/session-bridge.js` — compatibility sentinel, logout, and auth-expiry fail-closed behavior.
- `server/admin-session.js` — signed session, auth endpoint mode, protected Admin HTML/static serving, same-origin check, timing-safe comparison, best-effort throttling, legacy-PIN compatibility, and traversal protection.
- `tests/admin-auth-gate.test.js` — security and routing regression coverage.
- `docs/ADMIN_AUTH_GATE_HARDENING_2026-09-15.md` — this implementation/audit record.

## Files changed

- `api/kk-admin-snapshot-v6.js`
  - dispatches internal Admin gate modes;
  - authorizes normal Admin API access before the existing v5 chain;
  - preserves the existing snapshot contract classifier.
- `api/kk-rental-dashboard-v6.js`
  - authorizes access before the existing CRM freshness/reconciliation logic;
  - preserves Core fallback, strict-private mode, and current datasets.
- `vercel.json`
  - `/admin` -> minimal gate;
  - `/api/kk-admin-auth`, `/admin/app`, and `/admin/:path*` reuse the existing snapshot-v6 function;
  - Admin routes gain no-store/noindex/frame-denial headers;
  - `admin/**` is included in the snapshot-v6 function bundle for protected server-side delivery;
  - no new API function entry is added.
- `package.json`
  - syntax checks now include `admin/session-bridge.js`, `server/admin-session.js`, and the existing v5/v6 Admin snapshot modules.
- `tests/crm-freshness.test.js`
  - preserves the latest hourly-safe 75-minute default and verified sync-state regressions from `main`;
  - additionally proves the v6 analytics route is protected by the Admin security layer.
- `tests/crm-reconciliation.test.js`
  - preserves reconciliation coverage while proving the v6 route is protected by the Admin security layer.

## Security improvements

### Anonymous disclosure reduced

Anonymous `/admin` receives only the minimal login gate. The protected Admin workspace and `/admin/*` assets are read server-side only after a signed session is validated.

### Real PIN removed from normal browser storage

The real PIN is submitted to the auth endpoint for validation but is not saved into `sessionStorage`. The browser keeps only `__SESSION__`. When the legacy Admin backend still requires `X-Admin-Pin`, the server injects the configured PIN after validating the signed session.

### Signed, hardened session cookie

Session tokens are signed with `KK_ADMIN_SESSION_SECRET` when configured. For backward-compatible rollout, signing falls back to `KK_ADMIN_PIN` until a separate session secret is provisioned. Cookie flags are `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, with an 8-hour TTL.

### Brute-force friction

The session module tracks failed attempts by observed client IP key. Five failures within the window result in a temporary 15-minute block. This is best-effort process-memory throttling on serverless infrastructure, not a globally consistent distributed rate limiter.

### Direct asset and traversal protection

Protected static delivery decodes and normalizes the requested path, rejects parent traversal (`..`), encoded traversal, backslashes, NUL bytes, absolute paths, missing files, and directories, and verifies the resolved file remains under the Admin asset root.

### Browser and cache hardening

Admin/gate responses are no-store and non-indexable. Frame embedding is denied. Signed-in Admin HTML adds a restrictive Content Security Policy including `frame-ancestors 'none'`.

## Compatibility boundaries

- No Apps Script deployment change.
- No Google Sheet schema or business-row mutation.
- No Booking/Event/Asset/Package/Pricing rule change.
- No Make/Scanner/Verifier/Canary change.
- No CRM freshness/reconciliation algorithm removal or downgrade.
- Correct existing trusted `X-Admin-Pin` clients remain supported during this hardening slice.
- Core remains the production SOT/fallback behavior already established by the v6 analytics stack.

## Validation incident and corrective action

The first implementation on PR #27 created several new files under `/api` and briefly used Vercel Routing Middleware. GitHub unit/regression tests could pass, but Vercel Preview failed. The project was already operating at the practical API-function budget for its current plan/layout, so adding several new API entry files was unsafe.

Corrective action:

- removed the extra auth/app/static/session-proxy API entry files;
- removed Routing Middleware and its extra dependency;
- moved shared session/security code to `server/admin-session.js` outside `/api`;
- multiplexed auth/app/asset modes through the existing snapshot-v6 function;
- kept Rental Analytics on the existing rental-dashboard-v6 function;
- created the final branch fresh from latest `main` so the hourly-safe CRM freshness changes merged in PR #28 are preserved without conflict;
- retained the iterative PR #27 only as implementation history and superseded it with the clean final branch.

## Regression requirements

The final branch must prove all of the following before merge:

- public login gate does not contain CRM navigation or environment-variable disclosure;
- real PIN is not persisted in browser storage;
- signed tokens reject tampering and expiry;
- cookie flags remain hardened;
- five failed attempts trigger temporary blocking;
- signed-session Admin API requests are accepted and receive the server PIN only inside the server request path;
- anonymous Admin API requests are rejected;
- existing correct legacy PIN clients remain compatible;
- auth/app/asset rewrite modes use the existing v6 function;
- Admin asset traversal attempts are rejected;
- Admin workspace injects the session bridge before legacy bootstrap;
- Rental Analytics preserves v6 freshness and reconciliation behavior;
- latest `main` CRM freshness default remains 75 minutes and does not regress;
- GitHub Admin Regression workflow passes;
- Vercel Preview build succeeds.

## Production acceptance checklist

After CI/Preview succeeds and the PR is merged:

1. Anonymous `/admin` shows only the PIN gate.
2. Anonymous direct `/admin/admin.js`, `/admin/index.html`, and other Admin assets do not return protected source.
3. Anonymous `/api/kk-admin` and `/api/kk-rental-dashboard` are rejected.
4. Owner enters the existing Admin PIN manually; the PIN must never be printed or recovered from environment configuration.
5. Valid login opens the existing Admin workspace.
6. Snapshot/Event/Booking/Admin Analytics flows remain functional.
7. Logout clears the signed session and returns to `/admin`.
8. Expired/invalid sessions fail closed back to the login gate.
9. Production Vercel deployment and regression status remain green.

## Rollback

Rollback is code-routing only: revert the hardening merge to restore the prior `/admin -> /admin/index.html` and PIN-header behavior. This hardening does not migrate Sheet schema/data or mutate operational records, so rollback does not require a data migration.

## Remaining optional hardening after acceptance

- provision a separate high-entropy `KK_ADMIN_SESSION_SECRET` so session signing is cryptographically separated from the human-entered Admin PIN;
- replace process-memory throttling with a durable/distributed limiter or platform firewall rule if abusive traffic is observed;
- later retire direct legacy `X-Admin-Pin` compatibility after all trusted integrations are migrated to a service-to-service credential model.
