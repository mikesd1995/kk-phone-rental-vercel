# Zero-Cost Witness Configuration Apply/Rollback Acceptance — 2026-09-21

## Status

**STAGING ONLY / WITNESS NOT ENABLED / WITNESS STREAK 0/6**

This acceptance closes the control-plane capability gap identified after v4.9.20 activation: the project needs one audited, owner-authorized, zero-cost path that can apply the server-side witness bindings and a Cloudflare Worker clock, prove the configuration, and fully roll it back before any real witness activation is considered.

It is not the witness activation workflow.

## Authorization

The GitHub-native path is owner-only and accepts exactly this command on Issue #47:

```text
/accept-witness-config-zero-cost
```

No schedule, push trigger, browser automation, TinyFish, paid plan, Scanner task enablement, or HF activation is part of this workflow.

## Mandatory entry gates

The workflow must fail before mutation unless all of these are true:

1. checkout SHA equals fresh `refs/heads/main`;
2. an exact-current-main READY Production deployment exists;
3. a successful `Bounded OIDC Production Acceptance` run exists on that exact same SHA;
4. its downloaded evidence says `PASS_AND_ROLLED_BACK`, `business_writes=0`, rollback OIDC flag=false, and final main SHA matches;
5. required GitHub Actions secrets are present without printing their values:
   - `VERCEL_TOKEN`
   - `SUPABASE_SECRET_KEY`
   - `KK_EXTERNAL_SCANNER_SECRET`
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
6. all witness/runtime-ledger Production env keys targeted by this acceptance are absent, so no pre-existing owner configuration can be overwritten;
7. the unique acceptance Worker name does not already exist.

## Temporary Vercel configuration

The acceptance may create only these Production-target env keys:

- `KK_RUNTIME_LEDGER_ENABLED=true`
- `KK_RUNTIME_LEDGER_PROJECT_REF=zehlsagzrpromtfqqflt`
- `SUPABASE_URL=https://zehlsagzrpromtfqqflt.supabase.co`
- `SUPABASE_SECRET_KEY=<GitHub Actions secret>`
- `KK_EXTERNAL_SCANNER_MODE=witness`
- `KK_EXTERNAL_SCANNER_SECRET=<GitHub Actions secret>`
- `KK_EXTERNAL_SCANNER_ENABLED=false`

The last value is a hard invariant. This acceptance never changes it to true.

After one exact-source redeploy, readiness must prove:

- external Scanner=false;
- mode=witness;
- HMAC secret configured;
- runtime ledger enabled/configured;
- canonical Supabase project binding matches;
- `ready_for_witness=false`;
- Scanner execution=false;
- business writes=false.

A bounded `?probe=ledger` must be read-only, use limit 1, report business writes 0, and see zero witness expectation rows.

## Cloudflare acceptance Worker

The workflow deploys a unique temporary Worker using the already-versioned `cloudflare/kk-scanner-clock.mjs` and top-of-hour cron configuration. It uses a unique name derived from the GitHub run ID and current main SHA, so it cannot replace a canonical Worker.

The shared HMAC secret is injected through Wrangler secret storage and is never written to the repository or evidence artifact.

Because the Vercel external Scanner flag remains false, the acceptance Worker cannot create witness expectations even if a cron boundary occurs during the test.

## Rollback

Rollback is mandatory and independently re-run by the workflow even if the main acceptance step fails.

The rollback order is safety-first:

1. promote the exact pre-acceptance Production deployment back to Production without rebuilding it;
2. delete the unique acceptance Cloudflare Worker;
3. delete only Vercel env records created by this acceptance, identified by recorded IDs and an acceptance-specific comment tag;
4. require the public dispatcher to return to the fail-closed baseline;
5. require the temporary Worker and tagged env records to be absent.

The pre-existing Production deployment is used as the rollback artifact so rollback does not depend on obtaining a second Vercel build slot.

## Terminal result

Only this marker counts:

```text
WITNESS_CONFIG_APPLY_AND_ROLLED_BACK_PASS
```

Even that marker proves only apply/readback/rollback capability. It grants:

- witness streak credit: **0/6**
- Scanner runtime acceptance: **false**
- business-write authority: **false**
- HF production authority: **false**
- production cutover authority: **false**

A later explicit command and policy-compliant activation sequence is still required to set `KK_EXTERNAL_SCANNER_ENABLED=true` and begin natural witness certification.

## Zero-cost boundary

If GitHub Actions included capacity, Vercel free build capacity, Cloudflare free capacity, or required credentials are unavailable, the workflow fails closed. It must not buy capacity, upgrade a plan, use paid browser automation, or weaken exact-main/OIDC requirements.
