# Post-deploy Runtime Self-Audit — 2026-09-30

## Objective

Extend the existing hourly/push Production watcher instead of creating another scheduled workflow. The watcher now performs bounded deployment acceptance and read-only runtime checks against the exact commit on `main`.

## Problem fixed

The previous watcher could resolve an older READY Production deployment while a newer `main` deployment was still BUILDING. That was safe for the historical Rental Analytics route check, but insufficient as a general post-deploy acceptance signal.

The watcher now:

1. resolves the current `main` SHA;
2. polls Vercel for up to 120 seconds on push;
3. requires the serving READY Production SHA to equal current `main` before runtime acceptance;
4. treats a failed/cancelled current-main Production attempt as an error;
5. treats a still-building/not-visible current-main deployment as a waiting state;
6. runs runtime self-audit only against the accepted current-main Production artifact.

## Runtime checks

The read-only audit checks:

- storefront root returns HTTP 200;
- `08_Web_Ready!A4:K` returns HTTP 200 with the expected public event schema;
- event feed is `no-store` and contains no known operational tokens;
- event feed reports a recognized reader source;
- `09_Web_Packages!A4:N` returns HTTP 200 with the expected public package schema;
- package feed is `no-store` and contains no known operational tokens;
- package feed reports a recognized reader source;
- `/admin` returns HTTP 200;
- Admin gate remains no-store;
- Admin gate retains `X-Frame-Options: DENY`;
- Admin gate remains noindex;
- Admin CSP retains `frame-ancestors 'none'` and `form-action 'self'`.

A private-reader failure that safely falls back to GViz is reported as a warning. Any failed runtime invariant blocks Production acceptance.

## Existing route acceptance retained

The historical Rental Analytics v6 route-shape checks remain active:
- dashboard unauthenticated HEAD must resolve to the v6 auth boundary;
- Admin auth health endpoint must remain healthy.

## Workflow behavior

No new scheduled workflow was created.

`.github/workflows/rental-analytics-production-watch.yml` remains the single watcher and still runs:
- on pushes to `main`;
- hourly;
- on manual dispatch.

The push path performs bounded polling for the current-main deployment before probing runtime behavior.

New blocking states:
- `CURRENT_MAIN_DEPLOYMENT_FAILED`
- `PRODUCTION_RUNTIME_AUDIT_FAILED`

New non-error waiting state:
- `CURRENT_MAIN_DEPLOYMENT_PENDING`

New warning state:
- `PRODUCTION_RUNTIME_AUDIT_WARNING`

## Safety

The audit:
- uses Vercel API GET only;
- uses public HTTP GET/HEAD probes only;
- never attempts Admin login;
- never uses Admin PIN/session secrets;
- never mutates Production;
- never writes business data.

## Benefit

Production acceptance is now tied to the actual deployed `main` artifact rather than merely the existence of some READY Production deployment. This reduces false-positive acceptance during deployments and catches regressions that compile and pass CI but break runtime cache policy, public feed schema/boundary, or Admin security headers.
