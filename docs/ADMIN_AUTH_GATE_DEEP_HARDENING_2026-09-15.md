# KK Phone Rental — Admin Auth Deep Hardening Audit

Date: 2026-09-15 (Asia/Bangkok)
Branch: `security/admin-login-gate-final-20260915`
PR: #29
Validated code head: `9379d57010bf1242f837ebe5abea5dec58aa0521`

## Purpose

This record covers the additional security review performed after the earlier Admin login-gate implementation was already green. The objective was to identify less obvious failure modes that could still weaken the gate or create avoidable denial-of-service / source-disclosure risk before Production merge.

## Changes made in this deep-hardening round

### 1. Public gate CSP tightened

The public gate stylesheet was moved from an inline `<style>` block into `admin-login.css`. The remaining deliberate inline login bootstrap is pinned to its exact SHA-256 CSP hash. The public gate CSP no longer needs `script-src 'unsafe-inline'` and uses `default-src 'none'` with only the minimum required `script-src`, `style-src`, `connect-src`, `img-src`, `frame-ancestors`, `base-uri`, and `form-action` permissions.

Additional response hardening was added for the gate/Admin surfaces: `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, and a restrictive `Permissions-Policy` disabling camera, microphone, geolocation, payment, and USB capabilities.

### 2. PIN field privacy tightened

The public PIN field now requests `autocomplete="off"`, disables autocapitalization and spellcheck, and the PIN continues to be cleared before entering the Admin application. The real PIN is still never stored in normal browser storage; only `__SESSION__` is retained as the compatibility marker.

### 3. Secret comparison no longer has a length shortcut

`safeEqual()` now hashes both values to fixed 32-byte SHA-256 digests and then uses `crypto.timingSafeEqual`. This removes the previous immediate length-mismatch return path while preserving constant-size comparison inputs.

### 4. Signing-key cache no longer retains the raw cache selector

The signing-key cache selector now stores only a SHA-256 fingerprint of the configured signing material plus its source type (`secret` or `pin`), instead of retaining the raw PIN/secret string in the cache selector.

### 5. Rate-limit scopes separated

Login PIN failures and legacy `X-Admin-Pin` API failures now use separate namespaces (`login:<ip>` and `legacy-api:<ip>`). Anonymous API requests that do not provide a legacy PIN are rejected with 401 without consuming the login failure budget.

This prevents unrelated anonymous API probes from exhausting the same in-memory counter used by the human login form, reducing a self-inflicted denial-of-service path while retaining brute-force friction for actual supplied credentials.

### 6. Auth request-size enforcement expanded

The 4 KiB auth-body limit now applies not only to streamed request bodies but also to already-parsed object/string bodies supplied by the runtime. Oversized auth payloads fail closed.

### 7. Same-origin check validates forwarded protocol

When `X-Forwarded-Proto` is present, the auth handler now requires the Origin protocol to match it in addition to matching the host. This prevents an `http` Origin from being accepted on a request that Vercel reports as externally `https`.

### 8. Protected asset resolver canonicalized with real paths

Admin asset delivery now resolves the requested file with `fs.realpathSync` and verifies the canonical real path remains inside the canonical Admin root before serving it. This closes symlink-escape cases in addition to the existing lexical traversal checks for `..`, encoded traversal, backslashes, NUL bytes, absolute paths, missing files, and directories.

### 9. Unknown internal gate modes fail closed

An unexpected `__kk_gate` mode now returns a hardened 404 response instead of returning `false` from the gate dispatcher. This ensures malformed/internal routing states terminate deterministically rather than leaving the function without a response.

### 10. Explicit Vercel Function-budget regression guard

The security regression suite now recursively counts JavaScript files under `api/` and requires the count to remain at or below the current 12-function budget. This directly protects against a recurrence of the earlier Preview failure caused by adding new API entry files.

## Automated validation of the code head

GitHub Admin Regression run #88 validated code head `9379d57010bf1242f837ebe5abea5dec58aa0521` merged against the then-current `main` (`43c72cb1246b03d33fe8f1d74fc9afe4a0e18576`). The workflow completed successfully:

- Syntax checks: PASS.
- Regression tests: 104 passed, 0 failed, 0 cancelled, 0 skipped.
- The first 21 tests are Admin-auth/security-specific checks covering CSP pinning, source cleanup, browser PIN storage, randomized sessions, scrypt fallback, fixed-length comparison, isolated throttling, signed-session API authorization, legacy compatibility, forwarded-protocol same-origin validation, body-size limits, fail-closed gate routing, protected HTML bootstrap, lexical traversal, symlink escape, v6 routing, Function-budget protection, and security headers.
- Existing Booking, Admin UX/DOM, CRM freshness, reconciliation, private-reader, event/reservation, snapshot, and proxy regressions also remained green.
- Vercel deployment status for the exact code head: SUCCESS.
- PR mergeability was true against current `main` at the validation check.

## Runtime acceptance boundary

The connected Vercel identity available to this ChatGPT session is not authorized for workspace scope `mikesd1995s-projects`. Team discovery returns no authorized teams and attempts to access the team-scoped Preview return 403. Therefore this audit does **not** claim a browser-level authenticated Preview smoke test.

The deployment plane is green; the remaining acceptance blocker is Vercel management/Preview authorization for this connector or a manual authorized browser test. No Vercel token, Admin PIN, service-account key, or other secret should be pasted into chat.

## Safety boundaries maintained

No Apps Script deployment, Google Sheet schema/business-row mutation, Booking/Event/Asset/Package/Pricing business-rule change, Make change, Scanner change, Verifier change, or Canary change was made in this round. CRM freshness (including the 75-minute default), reconciliation, Core fallback, and existing trusted legacy `X-Admin-Pin` compatibility remain preserved.

## Production decision

PR #29 remains intentionally unmerged. Production merge is allowed only after the latest Preview passes an authorized browser smoke test covering anonymous `/admin`, direct protected assets, removed root artifacts, anonymous Admin APIs, manual PIN login, normal Admin reads, and logout/session clearing.
