# KK Phone Rental — Admin Operations Dashboard V4 candidate

**2026-11-07 (Asia/Bangkok)** · Status: **STAGED / RELEASE HOLD**. This is **not merged or deployed**.

## Intended integration

- Authenticated internal path: `/admin/operations-dashboard.html` served by the existing `middleware.ts` → `api/kk-admin-snapshot-v6` `__kk_gate=asset` → `server/admin-session.js` (`hasValidSession`) branch.
- The existing Admin app at `/admin/app` includes a small navigation link to the new path.
- Page first calls `GET /api/kk-admin-auth` and verifies `authenticated===true`, then reads `GET /api/kk-admin?action=snapshot` with `credentials: same-origin`, `cache: no-store`.
- No new unauthenticated API or new database/scheduler/billing integration is created. No client-side Core Sheet ID or public GViz fallback request is added.

## Main functionality

- Read-only event table, searchable/filterable date/month/venue/visibility/stock/bookings/price; calendar; 6 QA queues; poster/details and pricing.
- Uses `events`, `web_ready`, `web_packages`, `bookings` and `visibility_locks` datasets **only after schema completeness checks**.
- Phone package availability requires actual `phone_only` or `phone_lens_bundle` with available_count > 0 and package_status=available. Lens-only does not reopen phone availability.
- Aggregates booking status only. Customer name, phone, contact, payment info and asset IDs are **never projected into UI or stored**.
- Missing/aged snapshot, unknown booking status, missing lock evidence, conflicting owner locks, ambiguous package variants, hidden/full states and zero phone stock are HOLD. X Post Log is unavailable in existing Admin snapshot; all X plans are drafts requiring fresh manual verification. No publish endpoint or write action.
- Draft notes and near-term vs engagement ratio are local browser state, and are not authoritative or a business write.

## Tests (candidate only)

- `node --check admin/operations-dashboard.js`: PASS.
- `node --test tests/operations-dashboard-readonly.test.js`: 8/8 PASS (synthetic fixture, including lens-only stock, stale/public fallback, incomplete data, PII exclusion, duplicate IDs, locks, dates).
- `python tests/browser-check.py`: 11/11 PASS on Chromium mock auth/snapshot, no `pageerror`, 390px width no overflow. Browser test adapts CSP for local rendering because network to local server is blocked by the test environment; production CSP is left intact.
- Synthetic test evidence only; **no native repo `npm run code:context`, full regression, real Preview, hosted signed-session test, independent registered UX reviewer or Visual QA Gateway execution** were possible in this environment. The pre-implementation reviewer requirement in AGENTS.md is therefore not certified; remaining gate is blocking for merge/deploy.

## Source-of-truth & conflict safety

- Base `main` checked 2026-11-07: `d4bd11f6ff78f67f41b79a26448d036007737701`, not Production acceptance evidence.
- `#744` Admin PR open/Draft; `#813` phone/lens stock issue open/Draft. V4 does not modify `api/`, `server/`, `middleware.ts`, `admin/admin.js`, pricing/booking mechanics or direct writer pathways. It adds a separate UI only + navigation link.
- Existing signed-session asset route and existing authenticated snapshot API are relied on; actual runtime access checks still require hosted verification. V4 never downgrades auth.
- Required release sequence: run repo `npm run code:context -- "authenticated admin operations dashboard read only"`; registered `storefront_ux_review` before any material implementation continuation, independent reviewer, targeted/full regression and `storefront_visual_qa`, check PR head/concurrent changes, owner release approval, CI, signed-cookie negative tests, authenticated production-vs-preview UAT, and exact production readback.
- No merge/deploy/production or Sheet/Booking/Inventory/Price/Owner Lock/X/ACL/secret writes. Zero added SaaS cost.

## Rollback / handoff

- Candidate branch is isolated from existing PRs. If a PR is opened, it remains Draft until all gates pass.
- To rollback after approved deployment, revert the isolated candidate UI/HTML link commit; do not alter business sources or migrations.
- Previous V3 offline preview and handoff remain in ChatGPT Library `/kk phone rental/dashboard/`.
- Files for this candidate are staged in `/kk phone rental/dashboard/admin-v4/`, with checksums and screenshots; reload this document and branch ref in new chats.
