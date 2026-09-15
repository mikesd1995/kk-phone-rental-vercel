# Admin Auth Gate — Change Log

Date: 2026-09-15

- Replaced the public legacy Admin workspace entry with a minimal PIN-only gate.
- Added signed server session using `__Host-kk_admin_session`.
- Removed the real Admin PIN from normal browser storage; only `__SESSION__` is retained as a compatibility marker.
- Added server-side session checks for Admin HTML, Admin assets, Admin API, and Rental Analytics.
- Reused existing v6 Vercel Functions instead of adding new API entry files.
- Added same-origin auth checks, timing-safe comparisons, temporary failed-attempt blocking, traversal protection, no-store/noindex/frame-denial hardening, and Admin CSP.
- Preserved existing trusted `X-Admin-Pin` integrations and existing CRM freshness/reconciliation logic.
- Removed five obsolete root-level deployment artifacts that duplicated Admin/internal source on the public static surface: `kk-admin.js`, `admin.js`, `index (1).html`, `download`, and `download (2)`.
- Added a regression guard that fails CI if any of those obsolete public source artifacts reappear.
- Upgraded signed sessions from deterministic expiry-only `v1` tokens to randomized `v2` tokens with a 128-bit per-session nonce.
- When `KK_ADMIN_SESSION_SECRET` is configured, session signing uses a domain-separated SHA-256 key derived from that secret. During backward-compatible rollout without that variable, the Admin PIN is passed through scrypt before it can be used as signing material; the raw human PIN is not used directly as an HMAC key.
- Kept the recommendation to provision an independent high-entropy `KK_ADMIN_SESSION_SECRET`; the scrypt fallback reduces risk but is not a substitute for a dedicated random secret.
- The authenticated Admin HTML now keeps the legacy inline login panel hidden from first paint while preserving its DOM for compatibility with the existing Admin bootstrap.
- Moved the public gate CSS out of inline HTML and added an exact SHA-256 CSP hash for the remaining deliberate inline login bootstrap; the gate no longer needs `script-src 'unsafe-inline'`.
- Added gate/Admin response hardening with `Referrer-Policy: no-referrer`, COOP `same-origin`, CORP `same-origin`, restrictive `Permissions-Policy`, and `object-src 'none'` on the authenticated Admin CSP.
- Tightened PIN-field browser hints by disabling autocomplete, autocapitalization, and spellcheck on the public PIN input.
- Changed secret comparison to fixed-length SHA-256 digest comparison followed by `timingSafeEqual`, removing the previous length-mismatch shortcut.
- Changed signing-key cache identification to retain only a SHA-256 fingerprint of signing material rather than the raw secret/PIN selector.
- Split failed-attempt state into independent `login` and `legacy-api` namespaces; anonymous API probes without a supplied legacy PIN no longer consume the human login failure budget.
- Applied the 4 KiB auth-body cap to runtime-preparsed bodies as well as streamed bodies.
- Extended same-origin validation to require Origin protocol consistency with `X-Forwarded-Proto` when present.
- Added canonical `realpath` verification for protected Admin assets to reject symlink escapes outside the Admin root.
- Made unknown internal `__kk_gate` modes terminate fail-closed with a hardened 404.
- Added a recursive regression guard requiring the JavaScript file count under `api/` to stay at or below the current 12-function deployment budget.
- Expanded the security-specific regression suite to 21 Admin-auth tests; GitHub Admin Regression run #88 completed with 104/104 total tests passing and Vercel reported SUCCESS for code head `9379d57010bf1242f837ebe5abea5dec58aa0521`.
- Added `docs/ADMIN_AUTH_GATE_DEEP_HARDENING_2026-09-15.md` as the detailed record for the final deep-hardening review.
- Added detailed implementation, validation, rollback, and acceptance records. Production remains intentionally unmerged until an authorized browser Preview smoke test is completed.
