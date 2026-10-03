# Ultra Deep V27 Unified Control-Plane Migration — 2026-10-03

## Goal
Move the Ultra Deep machine control-plane dependency to the already connected zero-cost Supabase project `kk-unified-inbox` (`mxjnjujqjybqughsnqbz`) without enabling business writes during migration.

## Changes
- Added isolated public control tables for admin locks/receipts and Ultra Deep commands.
- RLS enabled; public/anon/authenticated access revoked; service-role-only control access.
- Added atomic `kk_ultra_deep_command_claim` and `kk_ultra_deep_command_complete` RPCs.
- Deployed `kk-admin-write-control` V27 source to the unified project with `verify_jwt=false`; the handler itself verifies exact Vercel Production OIDC claims.
- Added `commandClaim` and `commandComplete` actions required by V26 machine ingress.
- Rebound the server bridge to `mxjnjujqjybqughsnqbz`.
- Preserved remote `command` and `completed` fields in the sanitized bridge response.

## Live validation
A bounded read-only acceptance command for month `2026-10` was inserted with `commit=false`, claimed atomically, and completed. Exact readback:
- state: `COMPLETE`
- production_writes: `0`
- error_code: `null`

Supabase security advisor returned no WARN/ERROR for these tables. The RLS-without-policy INFO is intentional: no client role receives table access; only `service_role` is granted control-plane access.

## Safety
- No storefront/business row was written.
- No production write capability was enabled.
- No new Supabase project or paid resource was created.
- The previous canonical project was not deleted or mutated.
- Production Vercel cutover remains gated on source CI and authenticated OIDC acceptance.
