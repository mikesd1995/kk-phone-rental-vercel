# KK Phone Rental — Admin Login Gate Hardening

Date: 2026-09-15 (Asia/Bangkok)
Branch: `security/admin-login-gate-20260915`
Baseline: `main@4464e5400b8f554149f73db4aee12a5ef10d4099`

## Objective

Before authentication, `/admin` must expose only a minimal Admin PIN form. It must not render or disclose the Admin CRM navigation, version labels, Booking/Pricing/System Guard labels, environment-variable names, or the full admin HTML/JS/CSS. After a valid PIN is supplied, the normal Admin CRM should load without changing its business workflow.

## Previous behavior

The static `/admin/index.html` was served before authentication. Although `#appPanel` was hidden until a PIN-backed API refresh succeeded, the sidebar, top bar, admin product/version labels, navigation labels, and the login instructions were already present in the HTML. The browser also stored the real Admin PIN in `sessionStorage` and sent it as `X-Admin-Pin` on Admin API calls.

## New access flow

1. `/admin` and `/admin/` rewrite to `admin-login.html`.
2. The public gate contains only the KK mark, password input, submit button, and a generic status area.
3. `POST /api/kk-admin-auth` validates the PIN server-side.
4. On success the server issues `__Host-kk_admin_session`, an HMAC-SHA256 signed cookie with `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, and an 8-hour maximum age.
5. The browser stores only the compatibility sentinel `__SESSION__`; it no longer stores the submitted PIN.
6. `/admin/app` is available only with a valid signed cookie. Routing Middleware blocks unauthenticated `/admin/*` asset/document access and redirects it to `/admin`.
7. `/admin/app` is served by `api/kk-admin-app.js`, which validates the session again and injects `admin/session-bridge.js` before the existing Admin bootstrap.
8. The session bridge handles logout by clearing the server cookie and browser sentinel. It also sends an expired/unauthorized Admin API session back to the minimal login gate.
9. `/api/kk-admin` and `/api/kk-rental-dashboard` now route through signed-session proxy wrappers. A valid session is converted server-side into the existing `X-Admin-Pin` contract so the legacy Admin backend does not need a risky business-logic rewrite.
10. Existing trusted automation/API clients that already possess the correct `X-Admin-Pin` remain compatible.

## Files added

- `admin-login.html` — minimal public PIN-only gate.
- `middleware.ts` — protects `/admin/*` and normalizes direct legacy document access.
- `admin/session-bridge.js` — logout, browser sentinel, and auth-expiry fail-closed behavior.
- `api/lib/admin-session.js` — HMAC session, cookie parsing, timing-safe comparisons, and best-effort attempt throttling.
- `api/lib/admin-session-proxy.js` — session/legacy-PIN authorization wrapper for existing Admin APIs.
- `api/kk-admin-auth.js` — login/session-status/logout endpoint.
- `api/kk-admin-app.js` — session-validated Admin HTML delivery with security headers and session bridge injection.
- `api/kk-admin-session-proxy.js` — protected wrapper over the current Admin snapshot v6 handler.
- `api/kk-rental-dashboard-session-proxy.js` — protected wrapper over the current rental dashboard v6 handler.
- `tests/admin-auth-gate.test.js` — regression coverage for the gate, cookie, session validation, rate limit, API wrapper compatibility, routing, and headers.

## Files changed

- `vercel.json`
  - `/admin` -> minimal gate.
  - `/admin/app` -> session-validated Admin HTML endpoint.
  - `/api/kk-admin` and `/api/kk-rental-dashboard` -> session-aware wrappers.
  - no-store, noindex/noarchive, and frame-denial headers added to Admin surfaces.
- `package.json`
  - adds `@vercel/functions` for Vercel Routing Middleware `next()` support.
  - extends syntax checks to the new server/browser security modules.

## Security improvements

### Pre-auth disclosure reduced

The public `/admin` response no longer contains CRM navigation, Booking/Pricing/System Guard labels, app/version details, `KK_ADMIN_PIN`, or the full Admin workspace markup. Direct requests for `/admin/index.html`, `/admin/admin.js`, CSS, and other `/admin/*` resources are intercepted by Routing Middleware unless the signed session is valid.

### Real PIN removed from browser storage

The submitted PIN is sent once to the same-origin authentication endpoint. After login the browser stores only `__SESSION__`, while the server-side proxy supplies the real environment PIN to the legacy backend. This removes the previous long-lived real-PIN value from `sessionStorage`.

### Signed session cookie

The cookie is signed with `KK_ADMIN_SESSION_SECRET` when configured. For backward-compatible deployment it falls back to `KK_ADMIN_PIN` as the HMAC key if a separate session secret has not yet been provisioned. A separate high-entropy `KK_ADMIN_SESSION_SECRET` is the preferred production configuration because it separates PIN verification from session signing.

### Brute-force friction

The auth helper performs timing-safe PIN/token comparisons and adds a best-effort server-side attempt limiter: five failed attempts within the window cause a temporary 15-minute block for that observed client key.

### Cache/search/frame hardening

Admin responses are marked no-store. Admin routes/gate are marked `noindex, nofollow, noarchive`; frame embedding is denied. The signed-in Admin HTML also receives a restrictive Content Security Policy and `frame-ancestors 'none'`.

## Compatibility and non-goals

- Existing Admin business logic, Google Sheet write contracts, snapshot-v6 behavior, and rental-dashboard-v6 calculations are not rewritten by this change.
- Existing trusted clients using the correct `X-Admin-Pin` remain supported to avoid breaking integrations during this hardening slice.
- This change prevents anonymous users from receiving the protected Admin files through normal Vercel routing. It does **not** make client-side code impossible to copy after a user has legitimately authenticated; anything delivered to an authorized browser can ultimately be inspected by that authorized user.
- The current attempt limiter is process-memory based and therefore best-effort on a serverless platform; it is not a globally consistent distributed rate limiter. A durable edge/KV/firewall-backed limiter would be the next hardening step if abuse is observed.
- Local non-HTTPS development may not retain the `Secure` production cookie. Production/preview HTTPS is the acceptance target.

## Regression requirements

The security regression suite must prove at minimum:

- the public gate contains no Admin CRM navigation or environment-variable disclosure;
- only the `__SESSION__` sentinel is persisted in browser storage;
- signed tokens reject tampering/expiry and cookie flags remain hardened;
- five failed attempts produce temporary blocking;
- signed-cookie API calls are accepted and translated into the server PIN;
- anonymous API calls are rejected;
- correct legacy PIN clients remain compatible;
- `/admin`, `/admin/app`, and Admin API rewrites point to the intended gate/session handlers;
- Admin routes remain no-store, non-indexable, and non-frameable;
- the signed-in HTML injects the session bridge before the legacy Admin bootstrap.

## Rollback

If production acceptance fails, revert this hardening branch/merge. The rollback returns `/admin` and Admin API rewrites to the prior static/PIN-header path. No Sheet schema, Apps Script, booking data, pricing data, Make scenario, scanner/verifier policy, or customer data is migrated by this change, so rollback is code-routing only.

## Deployment note

Do not attempt to recover, print, or log `KK_ADMIN_PIN`. Authenticated production acceptance should be performed by the owner entering the PIN in the browser. If `KK_ADMIN_SESSION_SECRET` is later added, use a random high-entropy value independent from the Admin PIN and redeploy.
