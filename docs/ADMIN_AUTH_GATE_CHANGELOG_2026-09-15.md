# Admin Auth Gate — Change Log

Date: 2026-09-15

- Replaced public legacy Admin workspace entry with a minimal PIN-only gate.
- Added signed server session using `__Host-kk_admin_session`.
- Removed the real Admin PIN from normal browser storage; only `__SESSION__` is retained as a compatibility marker.
- Added server-side session checks for Admin HTML, Admin assets, Admin API, and Rental Analytics.
- Reused existing v6 Vercel Functions instead of adding new API entry files.
- Added same-origin auth checks, timing-safe comparisons, temporary failed-attempt blocking, traversal protection, no-store/noindex/frame-denial hardening, and Admin CSP.
- Preserved existing trusted `X-Admin-Pin` integrations and existing CRM freshness/reconciliation logic.
- Added regression coverage and a detailed implementation/audit record.
