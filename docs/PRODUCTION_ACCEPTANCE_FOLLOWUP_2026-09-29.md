# Production acceptance follow-up — 2026-09-29

## Accepted production baseline

- Production deployment: dpl_nPPsMyGBAeFDrLenUgwubyY8XTXx
- Git commit: a415811a397e49f8fd5351d936fa1718fca593a2
- State: READY
- Target: production
- Production aliases attached successfully.
- Prior full-stack baseline c8ffb163 deployed READY before the cache-policy follow-up.
- Runtime error scan for the preceding accepted production deployment found no runtime errors in the checked one-hour window.

## Production smoke evidence

- Storefront root returned HTTP 200.
- /admin returned HTTP 200 with the PIN gate, no-store policy, noindex, frame denial, restrictive CSP and permissions policy.
- /api/kk-data 08_Web_Ready returned HTTP 200 with the expected public event schema.
- /api/kk-data 09_Web_Packages returned HTTP 200 with the expected package schema.
- Package response after a415811a reports Cache-Control: no-store, max-age=0, must-revalidate and x-vercel-cache: MISS.
- Public feed continues to redact internal operational text.

## Fix completed during production acceptance

Production inspection found a cache-policy conflict:
- api/kk-data.js intentionally emitted no-store because inventory/pricing must be live after Admin changes.
- vercel.json overrode that with s-maxage=15, stale-while-revalidate=45.

PR #317 changed the Vercel route policy to no-store and added regression coverage. Admin Regression #1009 passed before merge.

## Residual risk / next hardening

The production public feed currently reports x-kk-sheet-source: public-gviz-fallback. This is the documented transitional public reader path, not a newly introduced failure. Do not force the workbook private until the private service-account reader has been accepted end-to-end.

Authenticated Admin mutation UX cannot be fully exercised by unauthenticated production smoke checks. The Cancel stale-refresh failure is covered by CI regression and the production artifact contains the fix; the next authenticated Admin session should verify one real mutation/readback without creating synthetic business data.

## Prevention contract

1. Live availability/pricing endpoints must remain no-store at both handler and platform route layers.
2. Mutation success requires authoritative fresh readback.
3. Canonical SOT values outrank emergency UI overrides.
4. Confirmed defects require regression tests before merge.
5. Deployment acceptance must verify the actual production commit, not infer production state from a PR preview.
6. Public/private reader cutovers remain fail-closed and require explicit acceptance evidence.
