# Admin Auth Gate — Validation Status

Date: 2026-09-15 (Asia/Bangkok)
Branch: `security/admin-login-gate-final-20260915`
Pull request: #29 — `Harden Admin login with signed session gate`

## Current state

The hardening implementation is staged on a clean branch based on current production `main` history and preserves the hourly-safe CRM freshness/reconciliation stack. It does not introduce additional `/api` entry files; Admin auth/app/assets reuse the existing v6 function path.

## Proven validation results

- GitHub Admin Regression run #68: **PASS**.
  - Syntax checks: **PASS**.
  - Regression tests: **PASS**.
  - Test total at validated head: **96 passed, 0 failed, 0 skipped**.
  - Security-specific Admin gate tests all passed, including public-gate disclosure, browser PIN storage, signed-token/cookie flags, throttling, signed-session API authorization, anonymous rejection, legacy-PIN compatibility, same-origin checks, Vercel gate query handling, session-bridge injection, traversal rejection, consolidated routing, function-budget protection, and security headers.
- Vercel Preview for PR #29: **READY / SUCCESS**.
- PR #29 mergeability at validation time: **mergeable=true**.
- Previous iterative PR #27: **closed unmerged** and explicitly superseded by PR #29.

## Runtime acceptance limitation

The connected Vercel credential used by this session cannot open/fetch the team-scoped Preview URL and returns `403 Forbidden` while checking deployment access. Therefore an actual HTTP smoke test of the Preview routes from this environment is **not claimed**.

This does not indicate a Preview build failure: Vercel's GitHub integration reports the deployment Ready. It is an access-scope limitation of the connected Vercel credential.

Because this is an authentication/security change, Production merge is intentionally withheld until the Preview is manually smoke-tested from an authorized browser.

## Exact remaining smoke test

Before merging PR #29:

1. Open the PR #29 Vercel Preview `/admin` in an authorized browser.
2. Confirm the anonymous page shows only the PIN gate and no CRM/Admin workspace navigation.
3. Open `/admin/admin.js` and `/admin/index.html` while logged out; confirm protected Admin source is not returned directly and the request is gated/redirected.
4. Call/open the normal Admin API path without a valid Admin session; confirm it is rejected.
5. Enter the existing Admin PIN manually. Do not copy the PIN into GitHub, logs, chat, or source code.
6. Confirm `/admin/app` loads the existing Admin workspace and normal snapshot/Booking/Event/Rental Analytics reads still work.
7. Click logout and confirm the signed session is cleared and the browser returns to `/admin`.
8. After the above passes, merge PR #29 and repeat the same minimal smoke test against Production.

## Changes recorded

- Minimal public PIN gate.
- Signed HttpOnly session cookie.
- Real Admin PIN removed from normal browser storage.
- Existing v6 functions reused for auth/app/assets/APIs to avoid increasing Vercel Function count.
- Protected Admin assets served only after session validation.
- Path traversal rejection.
- Same-origin auth check.
- Best-effort failed-attempt throttling.
- No-store/noindex/frame-denial response hardening.
- Legacy trusted `X-Admin-Pin` compatibility retained.
- CRM freshness/reconciliation behavior preserved, including the current 75-minute hourly-safe freshness default.

## Merge decision

**READY FOR MANUAL PREVIEW SMOKE TEST — NOT YET MERGED TO PRODUCTION.**

Automated CI, Vercel build, and mergeability gates are green. The only deliberately outstanding acceptance gate is authorized browser-level Preview validation of the authentication flow and protected routes.