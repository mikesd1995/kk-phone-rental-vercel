# Admin Auth Gate — Validation Status

Date: 2026-09-15 (Asia/Bangkok)
Branch: `security/admin-login-gate-final-20260915`
Pull request: #29 — `Harden Admin login with signed session gate`

## Current state

The hardened Admin authentication implementation is staged on PR #29. Production remains unchanged and the PR is intentionally unmerged pending the authorized browser smoke test.

The branch preserves the hourly-safe CRM freshness/reconciliation stack and does not introduce additional `/api` entry files. Admin auth/app/assets reuse the existing v6 function path.

A deeper repository audit after the first green validation found five obsolete root-level Admin/internal source artifacts outside the protected route tree. They were removed, session tokens were upgraded to randomized v2 format, the PIN-only signing fallback was strengthened with scrypt key derivation, and the authenticated Admin response now hides the obsolete inline login panel on first paint.

## Proven automated validation at hardened head

Validated security/code head before this status-only documentation commit: `9d11b6cf5bd780588f70edb73b574fd4f924da68`.

- GitHub Admin Regression run #81: **PASS**.
  - Syntax checks: **PASS**.
  - Regression tests: **PASS**.
  - Total: **98 passed, 0 failed, 0 cancelled, 0 skipped**.
  - The first 15 security-focused tests all passed, including:
    - minimal public gate / no CRM navigation disclosure;
    - obsolete root-level source files absent;
    - real PIN not persisted in browser storage;
    - randomized v2 session token format and tamper/expiry rejection;
    - PIN-only fallback derives 32-byte signing key material and does not directly reuse the raw PIN;
    - five-failure temporary blocking;
    - signed-session API authorization and server-side PIN injection;
    - anonymous API rejection and trusted legacy-PIN compatibility;
    - same-origin login validation;
    - Vercel rewrite-query mode handling;
    - session bridge injection and hidden obsolete inline login panel;
    - path traversal rejection;
    - consolidated existing-v6 routing;
    - no obsolete extra Vercel function entry files;
    - no-store/noindex/frame-denial headers.
- Existing operational/CRM regressions also passed in the same run, including Booking capacity guards, Admin UX/DOM contracts, CRM freshness, reconciliation, private-reader safety, event guards, reservation guards, snapshot validation, and proxy diagnostics.
- Vercel status for hardened head `9d11b6c...`: **SUCCESS — deployment completed**.
- PR #29 mergeability at the hardened-head check: **mergeable=true**.
- Previous iterative PR #27 remains **closed unmerged** and superseded by PR #29.

## Additional cleanup proven by the audit

Removed from the branch/deployment surface:

- `kk-admin.js` — obsolete full Admin HTML duplicate.
- `admin.js` — obsolete root Admin stylesheet duplicate.
- `index (1).html` — obsolete root Admin JavaScript artifact.
- `download` — obsolete Admin proxy source artifact.
- `download (2)` — obsolete CSV proxy source artifact.

CI now fails if any of those five root paths reappear.

## Runtime acceptance limitation

The connected Vercel credential used by this session still cannot open/fetch the team-scoped Preview URL and previously returned `403 Forbidden` while checking deployment access. Therefore an actual browser-level HTTP smoke test of the Preview authentication flow is **not claimed**.

This is distinct from deployment health: Vercel's GitHub status reports the hardened Preview deployment completed successfully. The unresolved item is permission to interact with that Preview as an authorized browser, not a build failure.

## Exact remaining acceptance sequence

1. Open the latest PR #29 Vercel Preview `/admin` in an authorized browser.
2. Confirm the anonymous page shows only the PIN gate and no CRM/Admin workspace navigation.
3. While logged out, verify `/admin/admin.js` and `/admin/index.html` do not return protected Admin source.
4. Verify `/kk-admin.js`, `/admin.js`, `/index%20(1).html`, `/download`, and `/download%20(2)` no longer expose their obsolete source.
5. Call/open the normal Admin API path without a valid Admin session and confirm it is rejected.
6. Enter the existing Admin PIN manually. Do not copy the PIN into GitHub, logs, chat, or source code.
7. Confirm `/admin/app` loads the existing Admin workspace without flashing the old inline login card.
8. Confirm Snapshot / Booking / Event / Rental Analytics still read/work normally.
9. Click logout and confirm the signed session is cleared and the browser returns to `/admin`.
10. Only after the above passes, merge PR #29 and repeat the minimal smoke test against Production.

## Security design status

- Minimal public PIN gate: **implemented + tested**.
- Real Admin PIN removed from normal browser storage: **implemented + tested**.
- Signed HttpOnly/Secure/SameSite=Strict session cookie: **implemented + tested**.
- Random per-session 128-bit nonce: **implemented + tested**.
- Dedicated `KK_ADMIN_SESSION_SECRET` support: **implemented**; provisioning remains recommended when Vercel environment access is available.
- Safer PIN-only fallback using scrypt-derived signing key material: **implemented + tested**.
- Protected Admin HTML/assets: **implemented + tested at unit/routing level**.
- Root-level obsolete source cleanup: **implemented + regression-guarded**.
- Path traversal protection: **implemented + tested**.
- Same-origin auth check: **implemented + tested**.
- Best-effort 5-failure / 15-minute throttling: **implemented + tested**.
- No-store/noindex/frame-denial/CSP: **implemented + tested**.
- Existing trusted `X-Admin-Pin` compatibility: **preserved + tested**.
- CRM freshness/reconciliation behavior, including the 75-minute hourly-safe default: **preserved + tested**.

## Merge decision

**AUTOMATED SECURITY / REGRESSION / VERCEL BUILD GATES GREEN — MANUAL AUTHORIZED PREVIEW SMOKE TEST STILL REQUIRED — NOT MERGED TO PRODUCTION.**

This documentation update records the proven results only. Because it is a documentation-only commit after the validated security head, CI/Vercel should still be allowed to run on the resulting PR head and must remain green before merge.