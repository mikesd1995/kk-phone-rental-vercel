# Runtime Ledger Provisioning Gate — 2026-09-19

## Status

**PROVISIONING HARDENED / DEDICATED PROJECT NOT YET CREATED OR SELECTED**

This gate prepares the Supabase runtime-ledger layer used by the external Scanner witness. It does not activate the witness clock, Scanner business execution, HF, Make, or any ChatGPT recurring task.

## Current Supabase discovery

The connected account exposes one project:

- `supabase-cerulean-arrow`
- region: `ap-southeast-1`
- created: 2026-03-29
- current state: `INACTIVE`

The project predates the current runtime-ledger design and is not proven to be a dedicated KK Phone Rental control-plane database. A metadata/table read against the inactive project timed out. It was not restored and no schema was applied.

The connected organization is `mikesd1995's projects`. Project creation must remain an explicit provisioning action; do not repurpose an unrelated inactive project without provenance.

## Supabase platform compatibility

Supabase's 2026 Data API change requires explicit grants for newly created public tables as new-project defaults no longer auto-expose those tables. The staging schema therefore does not rely on default privileges.

## Fresh-project requirement

V1 is intentionally a one-time fresh-project provisioning script. If any KK runtime-ledger table already exists, the transaction aborts with `KK_RUNTIME_LEDGER_PROVISIONING_REQUIRES_FRESH_PROJECT`.

This prevents `CREATE ... IF NOT EXISTS` from silently accepting an older, drifted, or partially provisioned schema.

## V1 least-privilege contract

Before granting anything, the schema explicitly revokes table access from:

- `PUBLIC`
- `anon`
- `authenticated`
- `service_role`

It then grants only the server-side privileges required by the ledger contract.

`kk_runtime_expectations`:
- SELECT
- INSERT
- UPDATE only on `status`
- DELETE denied

Append ledgers:
- SELECT
- INSERT
- UPDATE/DELETE denied unless explicitly required by a later reviewed schema version

Identity sequences:
- only the three ledger-owned identity sequences receive `service_role` USAGE
- SELECT/UPDATE on those sequences remains denied
- no `ALL SEQUENCES IN public` grant is allowed

## Data-integrity contract

V1 expectations are restricted to:
- nonce matching the same format enforced by ingress;
- unique nonce;
- valid SHA-256 payload hash;
- `mode = WITNESS_ONLY` at database level;
- unique role + scheduled occurrence.

Production Scanner execution requires a separately reviewed schema/runtime version. It must not be smuggled into V1 by changing a mode string.

## Provisioning verification

After applying the staging schema to an explicitly selected dedicated KK project, execute:

`supabase/staging/kk-runtime-ledger-v1.verify.sql`

It fails closed if:
- any required table/sequence is missing;
- RLS is disabled;
- anon/authenticated can access ledger tables/sequences;
- service_role has DELETE;
- service_role has broader expectations UPDATE privileges than `status`;
- append ledgers have unexpected UPDATE;
- required targeted sequence grants are missing;
- nonce uniqueness or WITNESS_ONLY enforcement is missing.

Only after this SQL returns `KK_RUNTIME_LEDGER_VERIFY: PASS` should Security/Performance Advisors and bounded Data API runtime probes be run.

## Activation boundary

Even after provisioning PASS:
- `KK_RUNTIME_LEDGER_ENABLED` remains OFF until explicitly configured;
- `KK_EXTERNAL_SCANNER_ENABLED` remains OFF;
- Cloudflare witness remains undeployed;
- Scanner runtime acceptance remains false;
- production cutover remains unauthorized.

Provisioning readiness is not runtime acceptance.
