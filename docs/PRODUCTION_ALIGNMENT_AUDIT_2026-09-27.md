# Production Alignment & Regression Audit — 2026-09-27

## Scope
Read-only production alignment and regression audit after Creative Production v1 and Full Discovery Worker v1. Scanner/Verifier/Make runtime activation remains on hold pending Make credit reset and separate acceptance.

## Source state
- GitHub main: `1131471f2a29c9248346536f4809e562e5e16f2c`
- Current production deployment: `dpl_55eNb7NneVfq6DgLuLuGmZdjdics`
- Current production Git commit: `1946b836a241e30f2209ed7265ba669769c9f198`
- Main is exactly 1 commit ahead of production: Full Discovery Worker v1.
- Active Marketing branch `marketing-agent-mandatory-20260927` is based on main `1131471f...`, ahead of main, and not behind. Its Vercel preview `dpl_2Xu6RrJYhyuKbgkpik4WFXEyWWFo` is READY.
- Decision: do not trigger a redundant production build while the newer Marketing branch is actively being validated. A later merge from that branch can carry the Scanner commit forward in one deployment.

## Production smoke checks
Checked against https://kk-phone-rental.vercel.app:
- Storefront: HTTP 200.
- Admin login page: HTTP 200.
- Admin auth GET: HTTP 200 with `authenticated:false` when unauthenticated.
- Admin snapshot v6: HTTP 401 when unauthenticated, expected.
- Rental dashboard v6: HTTP 401 when unauthenticated, expected.
- `/api/kk-data` invalid request: HTTP 400 fail-closed, expected.
- Public Web Ready read: HTTP 200, 108 RFC-CSV records, 11 columns; action states parse cleanly (58 show, 9 show_full, 41 hide).
- Event share route: HTTP 200 with event-specific title/description/OG/Twitter metadata and canonical redirect target.
- Storefront HTML references `style.css?v=ios-focus-zoom-fix-20260927`, confirming the iOS focus-zoom fix is live.

## Runtime health
Vercel production runtime:
- Last 24h grouped runtime errors: none.
- Last 1h production error/warning logs: none.
- Latest Marketing preview error/warning logs over 1h: none.

Historical 7d clusters:
1. DEP0169 `url.parse()`: 613 occurrences / 185 users, last seen 2026-09-26 03:35:31 UTC.
   Repository search shows the deprecated call is not in current application source; previous hardening notes attribute it to Vercel's request-query getter. Current code avoids direct deprecated query access and the warning has not reappeared in the last 24h.
2. `TypeError: ALLOWED[sheet].has is not a function`: 2 occurrences, last seen 2026-09-26 01:22:40 UTC.
   Current `api/kk-data.js` defines allowed ranges as `new Set(...)`; live public `08_Web_Ready / A4:K` read now returns 200. Treat this as stale deployment history unless it recurs.

## Preview/build evidence
- Latest Marketing preview is Vercel READY.
- The Marketing branch is based on the current Scanner main commit, so its successful build provides integration build evidence for the Scanner code plus the newer Marketing changes.
- Vercel build-log connector endpoint was unavailable during this audit; fallback evidence used deployment READY state plus live preview storefront fetch and runtime-log scan.
- Local git clone fallback was attempted but the execution environment could not resolve github.com, so local npm test could not be run from that environment.
- No claim is made that the full GitHub Actions suite ran; the commit has no returned PR workflow runs.

## Safety / changes intentionally not made
- No booking, pricing, inventory, customer, Google Sheet, Apps Script, Make, Scanner scheduler, Verifier writer, or Machine SOT mutation.
- No manual production deploy while a newer branch based on current main is actively being validated.
- No speculative patch for historical errors that are currently not reproducing.
- No Scanner/Verifier activation while Make is on hold.

## Current classification
- STOREFRONT_PRODUCTION_HEALTH = PASS
- ADMIN_PUBLIC_GATE_HEALTH = PASS
- PUBLIC_DATA_READ_HEALTH = PASS
- EVENT_SHARE_ROUTE_HEALTH = PASS
- IOS_FOCUS_ZOOM_FIX_LIVE = CONFIRMED
- PRODUCTION_RUNTIME_ERRORS_24H = ZERO_OBSERVED
- MAIN_PRODUCTION_ALIGNMENT = PENDING_ONE_COMMIT
- NEWER_MARKETING_PREVIEW = READY
- SCANNER_VERIFIER_MAKE_RUNTIME = HOLD_PENDING_MAKE_CREDIT_RESET
- PRODUCTION_BUSINESS_WRITES_FROM_THIS_AUDIT = 0

## Next safe sequence
1. Finish/merge the active Marketing branch only after its own regression gate passes.
2. Confirm Vercel creates a production deployment from the resulting main.
3. Read back production deployment commit and ensure it equals the merged main head.
4. Repeat storefront/admin/public-data/event-share smoke checks.
5. Keep Scanner/Verifier/Make runtime activation on hold until Make credit reset.
