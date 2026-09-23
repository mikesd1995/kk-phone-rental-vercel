# Admin Direct Writer fresh-port + activation checkpoint — 2026-09-23

## Purpose

Fresh-port the still-missing Direct Writer control-plane source from stale draft PR #177 onto exact current main after Admin anti-flapping PR #179, without enabling Production business writes.

Fresh-port base:
`f6e7b1249b1ae2e2eea40e2b42f2ab33b368fffc`

Stale source PR:
`#177 / 2db1590104cd38609c1b65030a32d0d483c2e15e`

## What was reconciled

1. Restored source-of-record for the live Supabase Admin write-control plane:
   - `server/admin-write-control-oidc.js`
   - `supabase/functions/kk-admin-write-control/index.ts`
   - three already-applied Admin lock / receipt migrations.
2. Registered `kk-admin-write-control` in `supabase/config.toml` with gateway JWT verification disabled because the handler verifies exact Vercel OIDC itself.
3. Restored the dedicated Google writer helper:
   - `api/lib/admin-google-sheets-writer.js`
4. Hardened `server/admin-direct-writer.js` so generic reader credentials can never satisfy Direct Writer readiness.
5. Added the authenticated zero-write `writeControlHealth` diagnostic in `api/kk-admin-snapshot-v6.js`.
6. Updated Direct Writer / Phase-1 tests to use only the dedicated writer credential namespace.
7. Added regression coverage for OIDC pinning, service-role-only control tables, dedicated credential isolation, and zero-write health behavior.
8. Preserved PR #179 Admin write-health anti-flapping changes because the fresh-port starts from exact current main instead of merging stale #177.

## Live Supabase reconciliation evidence

Project:
`zehlsagzrpromtfqqflt / kk-phone-rental-runtime-ledger`

Verified on 2026-09-23:
- `kk-admin-write-control` Edge Function is ACTIVE, version 1.
- `verify_jwt=false` at the Supabase gateway; exact Vercel OIDC verification remains in the function handler.
- Fresh-ported `supabase/functions/kk-admin-write-control/index.ts` is an exact text match to the live Edge Function source.
- Live function SHA-256: `a7c655c024ddcf66fc92f013e8344accc5df203375fccd54ab0b9e6c7f736181`.
- Required migrations are already present live:
  - `20260922130544 admin_write_lock_idempotency_v1`
  - `20260922130806 admin_write_lock_acquire_qualified_v1`
  - `20260922130931 admin_write_lock_single_row_return_v1`
- Control lock table currently has the canonical `core-admin` row.
- No Production business writer is activated by this source reconciliation.

## Credential isolation

Direct Writer readiness now accepts only:

- `GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY`

or:

- `GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_JSON`

It deliberately does not inherit:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

This prevents a read identity from becoming a write identity merely by toggling feature flags.

## Activation state

Still SAFE_DISABLED.

Production activation still requires all of:

1. create or identify a dedicated Google service account for Admin writes;
2. grant that identity Editor access to the canonical Core Sheet only;
3. install its secret in Vercel Production outside source control;
4. verify authenticated `writeControlHealth`;
5. run a controlled write probe against a dedicated acceptance target;
6. exact readback verification;
7. audit / receipt verification;
8. enable the Direct Writer acceptance gates;
9. explicitly allowlist Phase-1 actions.

## Current external blocker

The connected toolset can inspect Google Drive/Sheet permissions and can grant access to a known email, but it cannot create a Google Cloud IAM service account or mint its private key. The connected Vercel tooling also does not expose Production environment-secret mutation.

Therefore this checkpoint deliberately stops before credential provisioning rather than substituting a weaker identity or storing credentials in source/chat.

## Safety boundaries

This fresh-port performs no:

- Booking/Event/Package/Asset/Pricing/Customer mutation;
- Google Sheet business-row write;
- Apps Script deployment;
- Vercel environment/secret change;
- Direct Writer activation;
- Phase-1 allowlist activation;
- Scanner/Verifier/Canary/HF/Make activation.

## Next acceptance sequence after dedicated identity exists

1. share only the canonical Core Sheet to the writer service-account email as Editor;
2. install dedicated writer secret in Vercel Production;
3. call authenticated `writeControlHealth`;
4. require control authenticated + writer configured + writer health OK;
5. run one controlled write/readback/audit transaction;
6. verify retry/idempotency and fencing;
7. enable one Phase-1 action at a time;
8. only then begin Booking/Asset migration away from Apps Script.
