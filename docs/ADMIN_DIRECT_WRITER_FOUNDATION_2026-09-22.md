# Admin direct-writer foundation — 2026-09-22

## Objective

Remove Apps Script from the Admin write critical path without replacing one intermittent failure mode with unsafe concurrent Google Sheet writes.

The read critical path was already cut over in PR #163 to direct Google Sheet primary reads. This checkpoint builds the transaction-control and dedicated-writer foundation only. Direct business writes remain disabled.

## Live Supabase control-plane changes

Canonical project:
- `zehlsagzrpromtfqqflt` — `kk-phone-rental-runtime-ledger`
- state observed before change: `ACTIVE_HEALTHY`

Applied migrations:
1. `20260922130544_admin_write_lock_idempotency_v1`
2. `20260922130806_admin_write_lock_acquire_qualified_v1`
3. `20260922130931_admin_write_lock_single_row_return_v1`

Created private control tables:
- `public.kk_admin_write_locks`
- `public.kk_admin_write_receipts`

Both tables:
- have RLS enabled;
- revoke table rights from `anon` and `authenticated`;
- grant access only to `service_role`.

Created service-role-only RPCs:
- `kk_admin_lock_acquire`
- `kk_admin_lock_release`
- `kk_admin_receipt_prepare`
- `kk_admin_receipt_commit`
- `kk_admin_receipt_fail`

The lock returns a monotonic fencing token. Receipts protect a request ID against reuse with a different action or payload hash.

### Acceptance findings

The first synthetic control-plane acceptance found an ambiguous PL/pgSQL `lease_until` reference. No business data was touched and the failed statement did not leave a lock. The function was replaced with qualified table aliases.

The second acceptance found that the successful branch returned a second fall-through row. A final `return;` was added after the successful `return query`.

Final lock acceptance:
- first request: acquired=true, fencing token advanced to 2;
- competing request while the first lease was active: acquired=false;
- wrong request/token release: false;
- owning request/token release: true;
- final lock holder: null; lease free.

Receipt acceptance:
- first prepare: PREPARED / created=true / conflict=false;
- same request + same payload: created=false / conflict=false;
- same request + different payload hash: conflict=true;
- commit: true;
- state readback: COMMITTED;
- synthetic receipt deleted after the acceptance.

No Booking/Event/Package/Asset/Pricing/Customer row was used or modified by these tests.

## OIDC write-control function

Deployed live Supabase Edge Function:
- name: `kk-admin-write-control`
- version: 1
- state: `ACTIVE`
- source SHA-256: `a7c655c024ddcf66fc92f013e8344accc5df203375fccd54ab0b9e6c7f736181`
- Supabase gateway JWT verification: disabled intentionally because the handler verifies Vercel OIDC itself.

The handler accepts only an exact Vercel Production identity:
- team slug `mikesd1995s-projects`
- team id `team_uaeOdVIjXMSW690ZM2wPuJyt`
- project `kk-phone-rental-vercel`
- project id `prj_snbAmpya7YGmOuMbv1o8T16ouxl6`
- environment `production`
- exact Vercel issuer/JWKS/audience/subject verification.

The Supabase internal service credential remains inside the Supabase Edge Function environment. It is not copied to Vercel or returned to callers.

Control actions:
- health
- acquire
- release
- receiptGet
- receiptPrepare
- receiptCommit
- receiptFail

These actions mutate only control-plane lock/receipt state. They do not write Google Sheets business data.

## Vercel control bridge

Added `server/admin-write-control-oidc.js`.

It:
- obtains the short-lived Vercel OIDC token only through `@vercel/functions/oidc`;
- never reads a raw OIDC token from an environment variable or request header;
- calls only the pinned canonical Supabase project/function;
- has a five-second remote timeout;
- returns sanitized control metadata;
- never returns the OIDC token.

An authenticated Admin diagnostic action `GET /api/kk-admin?action=writeControlHealth` reports:
- OIDC control health;
- dedicated Google writer readiness;
- whether direct writer cutover is actually eligible.

The health action performs zero business writes.

## Dedicated Google writer

Added `api/lib/admin-google-sheets-writer.js`.

Privilege separation is intentional. It accepts only:
- `GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY`
- or `GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_JSON`.

It does **not** inherit:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

The dedicated writer uses scope:
`https://www.googleapis.com/auth/spreadsheets`

Feature gate:
`KK_ADMIN_DIRECT_WRITER_ENABLED`

Default: disabled.

Even with a credential present, mutation helpers refuse to write unless the explicit direct-writer gate is enabled.

The writer module contains:
- read-only health probe;
- bounded token exchange;
- bounded Google API timeout;
- update and append primitives for the later action planner.

No credential was created or installed in this checkpoint.

## Remaining activation gates

Direct business writes must remain disabled until all are true:

1. a dedicated Google service-account writer exists;
2. only the canonical Core Sheet is shared to that identity with the minimum required edit permission;
3. the credential is installed directly into Vercel secret storage, never pasted into chat or committed;
4. authenticated Production `writeControlHealth` passes Vercel OIDC -> Supabase;
5. writer health can read the canonical Sheet by Google Sheets API;
6. action-specific planners reproduce existing Apps Script validation and exact row semantics;
7. Booking writes acquire the distributed lock before fresh collision evaluation and complete inside a bounded lease;
8. every write has request-id idempotency, before/after hashing, exact readback and an audit record;
9. regression + Preview pass;
10. one legitimate real Admin mutation passes exact Sheet/audit readback.

## Concurrency limitation

A Supabase lease plus fencing token does not magically give Google Sheets a native compare-and-swap primitive. The writer must therefore keep a conservative lease longer than the maximum bounded Google write transaction, verify the lock before write, and fail closed on uncertain completion.

If production concurrency grows beyond what this bounded external transaction can safely support, the durable architecture is to make a transactional database the authoritative write store and treat Google Sheets as a mirror rather than the transaction coordinator.

## Safety boundaries maintained

No:
- Production Booking/Event/Package/Asset/Pricing/Customer mutation;
- Apps Script deploy or URL guess;
- Sheet timezone change;
- Apps Script trigger change;
- Vercel secret mutation;
- Scanner/Verifier/Canary/HF activation;
- Make reactivation;
- synthetic business record.

Backup before repository foundation work:
`backup-main-pre-admin-direct-writer-foundation-20260922`
