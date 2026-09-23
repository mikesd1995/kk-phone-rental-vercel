# Admin Direct Writer control-plane reconciliation — 2026-09-23

## Purpose

Reconcile the live Supabase Admin write-control artifacts and the dedicated Google writer identity contract onto current GitHub main without activating Production business writes.

Base:
`47031e95fece2be38cc76078888401d689b57338`

Source archaeology:
- stale draft PR #166 contains the source corresponding to the already-live Supabase `kk-admin-write-control` function and lock/receipt schema;
- current main contains the later Direct Writer Phase-1 routing from #170/#173;
- therefore PR #166 must not be merged directly. Only still-missing control-plane source is fresh-ported.

## Changes in this branch

1. Restored source-of-record for:
   - `server/admin-write-control-oidc.js`
   - `supabase/functions/kk-admin-write-control/index.ts`
   - three already-applied Admin lock/receipt migrations.
2. Registered `kk-admin-write-control` in `supabase/config.toml` with gateway JWT verification disabled because the handler performs exact Vercel OIDC verification itself.
3. Restored the dedicated Google writer helper `api/lib/admin-google-sheets-writer.js`.
4. Hardened `server/admin-direct-writer.js` so writer readiness uses only:
   - `GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY`
   - or `GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_JSON`.
   Generic `GOOGLE_SERVICE_ACCOUNT_*` reader credentials no longer satisfy Direct Writer readiness.
5. Updated Direct Writer and Phase-1 regression fixtures to the dedicated writer namespace.
6. Added regression coverage for OIDC pinning, fail-closed token absence, service-role-only Supabase control tables/functions, and dedicated writer credential isolation.

## Why this is safer

Before this reconciliation, current main's Direct Writer foundation derived its credential from the generic private-reader namespace. That made privilege separation dependent on environment convention.

After this change:
- public/private read credentials remain read-side credentials;
- future Direct Writer activation requires a separate writer identity;
- merely enabling Direct Writer flags cannot elevate the existing read-only service-account identity;
- the already-live Supabase control plane is represented in source control again.

## Production activation state

Still disabled.

Activation still requires all of:
- dedicated Google writer identity;
- canonical Core Sheet Editor permission for that identity only;
- Production secret installation outside chat/source control;
- `KK_ADMIN_DIRECT_WRITER_ENABLED=1`;
- `KK_ADMIN_DIRECT_WRITER_ACCEPTED=1`;
- `KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED=1`;
- explicit Phase-1 action allowlist;
- controlled write/readback/audit acceptance.

Booking, Asset, createEvent, poster upload, new override creation and duplicate override cleanup remain outside Phase-1 routing.

## Safety boundaries

This reconciliation performs no:
- Vercel environment/secret change;
- Google Sheet business mutation;
- Apps Script deployment;
- Scanner/Verifier/Canary/HF/Make activation;
- Supabase live migration (the represented migrations were already present live);
- Production merge/deploy.

The branch is intended for regression/CI review first.
