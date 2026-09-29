# Continuous Invariant Gate + Private Reader Readiness — 2026-09-30

## Goal

Move KK Phone Rental from bug-by-bug regression recovery toward deterministic prevention. This change adds a read-only, fail-closed repository invariant gate that runs on every pull request and push to main.

## New gate

Command:

`npm run audit:invariants`

Implementation:

`scripts/kk-continuous-invariant-gate.js`

The gate emits a machine-readable report and exits non-zero if any protected invariant is broken. It performs zero production writes and zero business-data mutations.

## Protected invariants

1. **Admin mutation fresh readback**
   - Booking updates must force a fresh snapshot after any older in-flight refresh.
   - Prevents successful writes from leaving stale Admin state visible.

2. **Canonical poster SOT precedence**
   - `poster_image_url` from canonical data must win.
   - Emergency storefront override remains fallback-only.

3. **Live public feed is no-store in both layers**
   - `api/kk-data.js` must emit no-store for live inventory/pricing.
   - `vercel.json` must not restore `s-maxage` or `stale-while-revalidate` for `/api/kk-data`.

4. **Public feed allowlist only**
   - Public unauthenticated data remains limited to `08_Web_Ready` and `09_Web_Packages`.
   - Internal booking/package/override tables are forbidden.

5. **Public internal-text redaction**
   - Operational/machine annotations must pass through public sanitization.
   - Redaction observability must remain present.

6. **Owner-hidden tombstone end-to-end**
   - Persistent tombstones must stay enforced in visibility guard, Admin guard, verifier promotion, and Apps Script.
   - Prevents silent recreation through a different write path.

7. **Private reader strict mode fails closed**
   - `KK_PUBLIC_SHEET_REQUIRE_PRIVATE` must retain explicit `private-not-configured` and `private-read-failed` outcomes.
   - A private-reader cutover must never silently fall back public after strict mode is enabled.

8. **CI gate wiring**
   - The invariant audit itself must remain present in the Admin Regression workflow.

## CI integration

`.github/workflows/admin-regression.yml` now runs:

- syntax checks;
- full regression tests;
- **Continuous invariant gate**;
- code-intelligence benchmark;
- HF fail-closed safety/readiness checks.

This means a future edit can be syntactically correct and still be blocked if it violates one of the protected cross-layer contracts.

## Private reader production evidence

Production acceptance before this change returned:

`X-KK-Sheet-Source: public-gviz-fallback`

By current `api/kk-data.js` semantics:

- `private-service-account` = credentials exist and private read succeeded;
- `public-gviz-fallback-after-private-error` = credentials exist but private read failed while fallback is permitted;
- `public-gviz-fallback` = no usable private-reader credentials were detected;
- `private-not-configured` / `private-read-failed` = strict private mode fails closed.

Therefore the current production evidence shows the private reader is **not ready for strict cutover**. Do not set `KK_PUBLIC_SHEET_REQUIRE_PRIVATE=1` and do not make the workbook private yet.

## Safe private-reader cutover sequence

1. Configure supported read-only service-account credentials in Production.
2. Keep public fallback enabled initially.
3. Read both `08_Web_Ready!A4:K` and `09_Web_Packages!A4:N` through production.
4. Require `X-KK-Sheet-Source: private-service-account` on both.
5. Compare schema and representative row counts against the current public feed.
6. Only after successful readback, enable `KK_PUBLIC_SHEET_REQUIRE_PRIVATE=1`.
7. Re-run production smoke checks.
8. Only then consider removing public workbook access.

No credential or workbook-visibility mutation is part of this change.

## Prevention rule

A production deployment is not accepted merely because CI passes. Acceptance requires the deployed commit plus runtime readback. Conversely, a runtime fix is not considered durable until its contract is represented in regression/invariant coverage.
