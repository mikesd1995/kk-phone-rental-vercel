# Admin Auth Gate — Validation Status

Date: 2026-09-15 (Asia/Bangkok)
Branch: `security/admin-login-gate-final-20260915`
Pull request: #29 — `Harden Admin login with signed session gate`

## Current state

The hardened Admin authentication implementation remains staged on PR #29. Production is intentionally unchanged pending an authorized browser smoke test of the latest Vercel Preview.

The architecture continues to reuse the existing v6 Admin/Rental functions, preserving the project’s current API-function budget and the hourly-safe CRM freshness/reconciliation stack.

A final deep-hardening review was completed after the earlier green validation. The detailed record is `docs/ADMIN_AUTH_GATE_DEEP_HARDENING_2026-09-15.md`.

## Latest code-head validation

Validated security/code head: `9379d57010bf1242f837ebe5abea5dec58aa0521`.

GitHub Admin Regression run #88 completed successfully on the PR merge ref against then-current `main` (`43c72cb1246b03d33fe8f1d74fc9afe4a0e18576`).

- Syntax checks: **PASS**.
- Regression tests: **104 passed, 0 failed, 0 cancelled, 0 skipped**.
- The first **21** tests are Admin-auth/security-specific regressions.
- Vercel deployment status for the exact code head: **SUCCESS**.
- PR mergeability at the latest code-head check: **true**.

The expanded security suite proves:

- anonymous `/admin` source contains only the minimal PIN gate and no CRM navigation/internal environment wording;
- obsolete root-level Admin/internal source artifacts remain absent;
- real PIN is not persisted in normal browser storage;
- session v2 uses a fresh 128-bit nonce, validates correctly, and rejects tampering/expiry;
- PIN-only compatibility signing passes through scrypt and does not use the raw PIN directly as the HMAC key;
- public gate CSP pins the exact inline bootstrap SHA-256 and does not allow arbitrary inline script;
- secret comparison uses fixed-length digest inputs for `timingSafeEqual`;
- five failed human login attempts trigger the temporary login block;
- anonymous API probes without a legacy PIN do not consume the human login failure budget;
- wrong legacy API PIN attempts are isolated in their own throttling namespace;
- signed-session Admin API requests are accepted and the real server PIN is injected only inside the server request path;
- correct trusted legacy `X-Admin-Pin` compatibility remains supported;
- same-origin auth validation rejects foreign Origin and forwarded-protocol mismatch;
- already-parsed and streamed auth request bodies are bounded;
- unknown internal gate modes terminate fail-closed with 404;
- authenticated Admin HTML injects the session bridge and keeps the obsolete inline login panel hidden;
- lexical traversal and canonical symlink escape outside the Admin root are rejected;
- auth/app/assets and protected APIs continue to reuse existing v6 functions;
- the recursive `api/` JavaScript count remains within the current 12-function deployment budget;
- no-store/noindex/frame-denial plus the additional referrer/cross-origin/permissions headers remain configured.

Existing non-auth regressions also passed in the same run, including Booking capacity/double-booking guards, Admin UX/DOM contracts, CRM freshness (75-minute hourly-safe default), reconciliation, private-reader safety, event guards, reservation guards, snapshot validation, and proxy diagnostics.

## Final deep-hardening additions

The last review added the following safeguards after the earlier 98-test state:

1. externalized public gate CSS and exact-hash gate CSP;
2. no-referrer + COOP/CORP + restrictive Permissions-Policy on sensitive Admin surfaces;
3. tighter browser handling hints for the PIN field;
4. constant-size secret comparison inputs;
5. non-secret signing-key cache fingerprinting;
6. separate human-login and legacy-API rate-limit scopes;
7. prevention of anonymous API traffic consuming login failure budget;
8. 4 KiB cap for both preparsed and streamed auth bodies;
9. forwarded-protocol validation for same-origin auth;
10. `realpath`/symlink containment for protected Admin assets;
11. fail-closed handling for unknown internal gate modes;
12. explicit recursive Vercel API-function-budget regression protection.

## Runtime acceptance limitation

The connected Vercel identity available to this session is not authorized for workspace scope `mikesd1995s-projects`. Vercel team discovery returns no accessible teams and team-scoped Preview access attempts return `403 Forbidden`.

Therefore a browser-level HTTP/authenticated Preview smoke test is **not claimed**. This is a management/authorization limitation of the connected Vercel identity, not a deployment-build failure: GitHub’s Vercel status for the validated code head is green.

No Vercel token, Admin PIN, service-account private key, or other secret should be pasted into chat to bypass this limitation.

## Exact remaining acceptance sequence

1. Open the latest PR #29 Preview `/admin` from a browser authorized for the Vercel workspace.
2. Confirm the logged-out page exposes only the minimal PIN gate.
3. Confirm logged-out requests to `/admin/admin.js`, `/admin/index.html`, and other `/admin/*` assets do not return protected source.
4. Confirm `/kk-admin.js`, `/admin.js`, `/index%20(1).html`, `/download`, and `/download%20(2)` do not expose their former obsolete source.
5. Confirm anonymous `/api/kk-admin` and `/api/kk-rental-dashboard` are rejected without exhausting the login budget.
6. Enter the existing Admin PIN manually; do not copy the PIN into source, GitHub, logs, or chat.
7. Confirm `/admin/app` loads the existing Admin workspace without showing the obsolete inline login panel.
8. Confirm Snapshot, Booking, Event, and Rental Analytics reads/actions required for normal operation still work.
9. Click logout and confirm the signed session is cleared and the browser returns to `/admin`.
10. Only after Preview acceptance passes, merge PR #29 and repeat the minimal smoke test against Production.

## Safety boundaries

No Apps Script deployment, Google Sheet schema/business-row mutation, Booking/Event/Asset/Package/Pricing rule change, Make change, Scanner change, Verifier change, or Canary change was performed by this Admin hardening work. CRM freshness/reconciliation and Core fallback behavior remain preserved.

## Merge decision

**CODE SECURITY / REGRESSION / VERCEL BUILD GATES GREEN — AUTHORIZED BROWSER PREVIEW SMOKE TEST STILL REQUIRED — PRODUCTION REMAINS UNMERGED.**

This status document is itself a documentation-only commit after the validated code head. The resulting exact PR head must also remain green in GitHub Actions and Vercel before any merge decision; the final exact-head result is recorded in the PR conversation after those checks complete.
