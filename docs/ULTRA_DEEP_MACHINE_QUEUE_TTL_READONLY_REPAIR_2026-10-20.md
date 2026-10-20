# Ultra Deep machine queue: P0 fail-closed repair and cross-chat handoff
Checkpoint: 20 October 2026, Asia/Bangkok. Source-only Draft branch, absolutely no Production change.

## Authoritative status at checkpoint
- Main HEAD changed to 265203ce12a4093a46607fe3a365684794a5b382 via approved Storefront/Inbox PR #766, not an Ultra Deep deployment. Parent PR #769 now reports mergeable=false. Stack #769 -> #772 -> #774 -> #775 -> #776 -> this Draft must be re-reviewed against current main.
- Production read-only GET https://kk-phone-rental.vercel.app/api/kk-scanner-dispatch reports scanner disabled, mode unset, execution disabled, runtime-ledger disabled/unconfigured, HMAC secret absent, ready_for_execution=false and business_writes_capable=false.
- Linked Supabase kk-phone-rental-runtime-ledger project zehlsagzrpromtfqqflt is ACTIVE_HEALTHY; it is NOT connected to Vercel Production. SELECT-only aggregates show 2 October 2026 commands commit=false, status QUEUED since Oct 3, neither completed; Runtime Observations 0 at previous reading.
- Read-only pg_get_functiondef of deployed public.kk_ultra_deep_command_claim(uuid) shows RETURNS TABLE(command_id uuid,month text,commit boolean); it updates QUEUED->CLAIMED with NO expiry. Old repository migration used an incompatible JSONB signature. Do not guess deployed Supabase schema from historical migration.

## Confirmed software defects
1. API special machine GET/POST paths previously called commandClaim before checking readiness; stale queued commands could be claimed if later binding available.
2. Supabase Edge commandClaim previously expected a JSONB object but live RPC returns a one-row TABLE array. It could reject a successfully claimed command, stranding a claimed status.
3. Claim RPC had no 60-minute TTL, so old October 3 QUEUED rows were still eligible for replay on October 20.
4. Machine POST could pass executeWrites:true for a commit=true command, contrary to read-only acceptance boundary.

## Draft-only fixes, not deployed
- api/kk-scanner-dispatch.js: both GET and POST require server-owned readiness.ready_for_execution before any claim; commit=true explicitly blocked; always use executeWrites:false for machine run.
- supabase/functions/kk-admin-write-control/index.ts: accept exactly one TABLE row or legacy JSONB object, reject malformed/multiple rows, commit=true and invalid month.
- supabase/migrations/20261020233000_ultra_deep_claim_ttl_readonly.sql: DRAFT ONLY; DB-atomic QUEUED plus commit=false plus created_at within last 60 minutes; returns same TABLE signature as linked live project. This migration neither mutates old queued rows nor runs automatically. Requires owner-approved DB deployment and schema compatibility/rollback review.
- tests/kk-ultra-deep-machine-diagnostics.test.js: disabled machine GET/POST does not claim; true commit blocked before writer; mocked enabled tests still exercise diagnostic receipts.
- tests/kk-ultra-deep-machine-claim-ttl-contract.test.js: source regressions enforce exact TTL/read-only gate and RPC normalization. Exact-head CI needed; ancestor PR #776 CI does not prove this branch.

## Safe release sequence, still blocked
1. Independently review/rebase full PR stack onto newly changed main; preserve owner-approved Storefront/Inbox changes and zero business writes.
2. Obtain owner signoff and server-side authorization proof for any Vercel runtime secret, Supabase OIDC/ledger binding or migration. Never display credentials in chat.
3. Test DB migration on compatible isolated zero-cost staging, confirming OLD command cannot claim, FRESH commit=false can claim once, and commit=true never claims. Do not update/expire/replay old QUEUED records without explicit owner data-governance approval.
4. Once separately authorized, enable only read-only execution. Collect actual provider source/task/time receipts for unseeded October, November and December searches; verify zero paid provider calls and real missed-event recall.
5. Only after camera and detachable lens access, image rights, actual rental competitor evidence, Booking/hidden locks and pricing approval may any event be proposed for governed Admin production readback. No implicit Production write permission in this scan repair.

Explicit current result: code draft prepared; no production merge/deploy, database/Booking/price/rights/customer/Automation modifications, no paid provider, no command replay. Production acceptance remains BLOCKED.
Tracking: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/777