# KK Phone Rental — Operations Dashboard V4 integrated current-main Release Candidate (2026-11-10 ICT)

**Status: DRAFT / SECURITY RELEASE HOLD / NOT LIVE / NO PRODUCTION ALIAS.** This is NOT owner sign-off or independent review.

## Why this branch exists
The original Admin Dashboard [#851](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/851) was 2 commits behind current main. The owner requested actual Admin Production availability, but current policy forbids unattended merge/deploy without independent Reviewer, real signed-session private-source UAT, exact-head CI, readback and rollback. To avoid touching Codex's branch, this isolated Release Candidate was created directly from exact main `eec14200cb087173ca555fa0c21b99e54c1c3961`.

## Integration source and boundaries
- Parent [#851](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/851) exact `884cd1123ad67f74adf9c0243ee9da8590c2511f`: authenticated read-only Admin UI, signed-session Operations API V6, server PII allowlist, scoped tests.
- Child [#857](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/857) exact `886140fdcf34303f469db4011935ba32f433cae7`: fail closed on absent/inconsistent/unconfirmed Core and Web Ready venues.
- Child [#858](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/858) exact `9ecdf2725bbbba04b6a76383be390c25821783b0`: fail closed on stale/public-GViz fallback and absent independent Web Ready date; real Chromium 8-viewport evidence capture on synthetic local server.
- **Excluded:** synthetic test-only fixture, test PIN and Preview-only configuration and route changes from [#854](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/854). No Production fixture endpoint introduced.
- Main changes from common base were inspected: `api/kk-admin-guard.js`, 3 Ultra Deep runtime code paths, one test and one doc; no overlap with selected Dashboard files.
- Admin index navigation and public `/admin/operations-dashboard.html` asset path stay under existing signed-session middleware; no unauthenticated data or new business writes.
- Includes tests for real local signed-cookie V6/V5 read-only route with synthetic test Sheet, PII scrubbing, owner locks and source-date/venue constraints. Customer PII never in screenshots/CI fixtures.
- New zero-secret `.github/workflows/admin-ops-release-candidate.yml` runs exact branch full regression and Playwright Chromium screenshot/registered UX on 8 sizes, with synthetic-only fixtures. It is NOT hosted signed-session/private Sheet acceptance.

## Acceptance gates (must all pass before merger)
1. Exact full CI and registered UX QA on this *integrated candidate* branch HEAD. No inherited child CI only.
2. Independent Reviewer (not author or same implementation identity), exact HEAD after remediation, plus security and privacy assessment.
3. Hosted signed Admin real **private read-only** Sheet source, parity against Event/WebReady/Web Packages/Booking/Owner Locks with source completeness, freshness, raw HTTP PII allowlist, negative auth and Vercel SSO intact. Synthetic Preview tests do not satisfy this.
4. Reconcile ongoing Codex work, no branch overwrite or conflicting Admin PR #744.
5. Go/no-go and final owner-controlled merge from reviewed HEAD to current `main`; Vercel Production deployment with signed Admin smoke, new route/API readback, rollback to prior READY prod if a gate fails.
6. Do not modify customer data, Bookings, inventory, prices, Owner Locks, public storefront event listing, X schedule/posting, Google Sheets/Drive ACL, credentials or Production env settings as part of this candidate.

## Cross-chat recovery
Use this branch, parent #851 and children #857/#858, latest GitHub Actions run on the branch, and master issue #49. A GitHub Actions success or READY Preview status MUST NOT be reported as live deployment.
