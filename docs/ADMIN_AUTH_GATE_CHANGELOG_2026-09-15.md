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
- When `KK_ADMIN_SESSION_SECRET` is configured, session signing uses a domain-separated SHA-256 key derived from that secret. During backward-compatible rollout without that variable, the Admin PIN is passed through scrypt before it can be used as a signing key; the raw human PIN is no longer used directly as an HMAC key.
- Kept the recommendation to provision an independent high-entropy `KK_ADMIN_SESSION_SECRET`; the scrypt fallback reduces risk but is not a substitute for a dedicated random secret.
- The authenticated Admin HTML now keeps the legacy inline login panel hidden from first paint while preserving its DOM for compatibility with the existing Admin bootstrap.
- Expanded regression coverage for randomized tokens, PIN-derived signing-key fallback, hidden legacy login panel, and root-level public source cleanup.
- Added detailed implementation, validation, and rollback records.
