# Admin Auth Gate — Validation Status

Date: 2026-09-15 (Asia/Bangkok)
Branch: `security/admin-login-gate-final-20260915`
Pull request: #29 — `Harden Admin login with signed session gate`

## Current state

The hardening implementation remains staged on PR #29 and Production is unchanged. The branch preserves the hourly-safe CRM freshness/reconciliation stack and does not introduce additional `/api` entry files; Admin auth/app/assets reuse the existing v6 function path.

A deeper repository audit performed after the earlier green validation discovered five obsolete root-level source artifacts that sat outside the protected `/admin` route tree. They have now been deleted and CI contains a regression guard to prevent their return. Session tokens were also upgraded to randomized v2 format and the PIN-only signing fallback now derives key material with scrypt instead of using the raw PIN directly. The authenticated Admin response now hides the obsolete inline login panel on first paint.

Because those are security-relevant changes made after the previously proven run #69, **the previous green result is historical evidence only; the final head must pass CI and Vercel Preview again before merge**.

## Previously proven validation results

Before the final source-surface/token hardening pass:

- GitHub Admin Regression run #68: **PASS**, including 96 passed / 0 failed / 0 skipped.
- GitHub Admin Regression run #69 on the then-current documentation head: **PASS**.
- Vercel Preview: **READY / SUCCESS**.
- PR #29 mergeability at that time: **mergeable=true**.
- Previous iterative PR #27: **closed unmerged** and superseded by PR #29.

These results demonstrate the architecture was deployable, but they do not substitute for validation of the newest security commits.

## New security changes awaiting final-head proof

- Removed obsolete public root artifacts: `kk-admin.js`, `admin.js`, `index (1).html`, `download`, `download (2)`.
- Added CI regression coverage requiring those paths to remain absent.
- Changed session tokens from deterministic expiry-based `v1` format to randomized `v2.<expiry>.<128-bit nonce>.<signature>` format.
- Added scrypt derivation when a dedicated `KK_ADMIN_SESSION_SECRET` is not configured, so the human PIN is not used directly as an HMAC key.
- Kept the preferred production recommendation to provision a separate high-entropy `KK_ADMIN_SESSION_SECRET`.
- Hid the legacy inline Admin login panel in authenticated HTML before first paint while preserving the DOM for compatibility.
- Added tests for randomized same-second sessions, PIN-derived fallback key material, hidden legacy login panel, and obsolete-root-source absence.

## Runtime acceptance limitation

The connected Vercel credential used by this session has previously returned `403 Forbidden` when attempting to open/fetch the team-scoped Preview URL. Therefore a real HTTP/browser smoke test of the Preview routes from this environment is not claimed unless that access condition changes.

A successful Vercel build means the Preview deployed; it does not by itself prove the browser-level auth flow. Because this is an authentication/security change, Production merge remains withheld until the authorized Preview smoke test is completed.

## Exact remaining acceptance sequence

1. Require GitHub Admin Regression to pass at the latest PR #29 head.
2. Require Vercel Preview to report deployment success at the same/latest head.
3. Confirm PR #29 remains mergeable against current `main`.
4. Open the latest PR #29 Preview `/admin` in an authorized browser.
5. Confirm the anonymous page shows only the PIN gate and no CRM/Admin workspace navigation.
6. While logged out, verify `/admin/admin.js` and `/admin/index.html` do not return protected Admin source.
7. Verify `/kk-admin.js`, `/admin.js`, `/index%20(1).html`, `/download`, and `/download%20(2)` do not expose the deleted obsolete source.
8. Call/open the normal Admin API path without a valid Admin session and confirm it is rejected.
9. Enter the existing Admin PIN manually. Do not copy the PIN into GitHub, logs, chat, or source code.
10. Confirm `/admin/app` loads the existing Admin workspace without flashing the old inline login card and normal Snapshot/Booking/Event/Rental Analytics reads still work.
11. Click logout and confirm the signed session is cleared and the browser returns to `/admin`.
12. Only after the above passes, merge PR #29 and repeat the minimal smoke test against Production.

## Merge decision

**FINAL AUTOMATED REVALIDATION IN PROGRESS — NOT MERGED TO PRODUCTION.**

Do not change this record to READY until the newest GitHub Regression and Vercel Preview statuses are proven green.