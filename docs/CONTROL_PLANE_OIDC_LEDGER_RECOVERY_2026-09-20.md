# Control Plane OIDC Ledger Recovery — 2026-09-20

## Purpose

Continue Issue #47 without violating the active v4.9.19 fail-closed rule.

Fresh Machine-SOT and task-registry readback shows the canonical native Scanner and Verifier are OFF after the already-consumed v4.9.19 one-time re-enable. Current policy does not authorize another same-ID re-enable, clone, reschedule, identity rotation, or watchdog.

Therefore this stage does **not** mutate native recurring tasks. It ports the reviewed zero-static-secret runtime-ledger connectivity bridge onto current main so the external witness control plane can be validated independently and safely.

## Baseline

Fresh branch base:

`932c008e0701a5273d6f936baa8d9e8e5a964662`

This base already includes:
- Discovery Mesh foundation and manual Crawl4AI UAT;
- current Admin read-only fallback hardening;
- guarded Make Admin write transport foundation.

Stale PR #82 is 1 commit ahead / 8 behind current main and must not be merged directly.

## Active control-plane evidence

Current highest Active Machine-SOT POLICY_VERSION:

`v4.9.19 CANONICAL MINIMAL LAUNCHER`

Canonical native tasks:
- Scanner `6aacec5fa7f48191b439dbe2308b69cf` = OFF
- Verifier `6aacec85e5508191b26894565fbc3787` = OFF

Current acceptance:
- Scanner persistence = 0/6
- Verifier persistence = 0/6
- exact disable actor/mechanism = UNKNOWN

The v4.9.19 OFF→ON remediation was already consumed on 2026-09-18. Later OFF recurrence is fail-closed and earns zero acceptance. This branch does not re-enable either task.

## Ported OIDC bridge

### Vercel side

`server/runtime-ledger-oidc-bridge.js`

- uses short-lived `VERCEL_OIDC_TOKEN`;
- calls only canonical Supabase project `zehlsagzrpromtfqqflt`;
- invokes only `kk-runtime-ledger-oidc-probe`;
- POST body is fixed to `{"probe":"runtime-ledger","version":"v1"}`;
- remote wait is bounded to 4 seconds;
- response contains aggregate status/count only;
- no insert/update/delete capability exists.

### Existing dispatcher integration

`api/kk-scanner-dispatch.js`

Adds a separate diagnostic:

`GET /api/kk-scanner-dispatch?probe=ledger-oidc`

It is disabled unless:

`KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED=true`

Default/unset behavior:
- returns `OIDC_PROBE_DISABLED`;
- does not read/forward the Vercel OIDC token;
- performs zero bridge network calls;
- business writes remain zero.

The existing direct `?probe=ledger` path and witness POST path remain otherwise unchanged.

### Supabase side

`supabase/functions/kk-runtime-ledger-oidc-probe/index.ts`

Exact production workload binding:
- Vercel team slug: `mikesd1995s-projects`
- Vercel team id: `team_uaeOdVIjXMSW690ZM2wPuJyt`
- Vercel project: `kk-phone-rental-vercel`
- Vercel project id: `prj_snbAmpya7YGmOuMbv1o8T16ouxl6`
- environment: `production`

The handler:
1. requires POST;
2. requires bearer Vercel OIDC;
3. validates issuer before remote JWKS verification;
4. verifies signature, audience and exact subject;
5. verifies exact owner/team/project/environment claims;
6. validates the exact JSON probe contract;
7. reads `SUPABASE_SECRET_KEYS.default` only inside the hosted Edge Function;
8. performs one bounded GET of `kk_runtime_expectations` for `SCANNER / WITNESS_ONLY`, limit 1;
9. returns aggregate row count only.

No runtime ledger mutation is implemented in this Edge Function.

### Function gateway

`supabase/config.toml` sets function-scoped `verify_jwt=false` because the caller token is Vercel OIDC, not Supabase Auth. Authentication remains enforced in handler code with Vercel JWKS and exact claims.

## Current provider state

Canonical Supabase runtime ledger:
- project ref: `zehlsagzrpromtfqqflt`
- state previously verified ACTIVE_HEALTHY
- required four ledger tables provisioned
- persistent counts at prior acceptance: 0/0/0/0

Duplicate project `unxangvmhjtlqmiiuurw` was previously verified zero-row and paused INACTIVE.

This branch does not restore, replace, or rebind either project.

## Regression boundaries

`tests/runtime-ledger-oidc-bridge.test.js` enforces:
- canonical endpoint pinning;
- missing OIDC token => zero network call;
- token is forwarded only in Authorization header;
- timeout => bounded fail-closed error;
- remote auth failure => zero-write + token-safe output;
- dispatcher OIDC diagnostic disabled by default;
- enabled diagnostic does not enable Scanner/business writes;
- Edge Function exact production identity contract;
- GET-only Data API access;
- limit=1;
- no insert/update/delete;
- function-scoped `verify_jwt=false`.

`package.json` includes the new Node bridge in syntax checks while preserving current-main Admin/Discovery checks.

## Rollout gates

Repository merge is not runtime activation.

Before any live OIDC probe:
1. exact-head Admin Regression PASS;
2. exact-head Vercel Preview READY;
3. no secret/token committed;
4. Supabase current docs/changelog still compatible;
5. deploy only exact-reviewed Edge Function to canonical project;
6. persistent ledger counts remain unchanged;
7. production deployment exact merge SHA READY;
8. enable the non-secret OIDC probe gate only for bounded acceptance;
9. run one bounded read-only probe;
10. confirm counts remain unchanged;
11. disable the probe gate after acceptance unless a later policy explicitly authorizes keeping it available.

Even a successful connectivity probe:
- earns zero Scanner/Verifier persistence credit;
- earns zero external witness streak credit;
- does not authorize recurring clock deployment;
- does not authorize external Scanner business execution;
- does not authorize HF production.

## Explicit zero-change surfaces

```text
Native Scanner task mutation = 0
Native Verifier task mutation = 0
Canary task mutation = 0
Machine-SOT policy mutation = 0
Candidate/AI business writes = 0
Booking/pricing/inventory/customer writes = 0
Provider/customer sends = 0
HF production activation = 0
Cloudflare scheduler deployment = 0
Supabase Edge Function deployment = 0 (until separate acceptance gate)
Vercel OIDC probe flag mutation = 0 (until separate acceptance gate)
```

## Classification

`CONTROL_PLANE_OIDC_CURRENT_MAIN_PORT = STAGED / FAIL_CLOSED / RUNTIME_OFF`

This reduces the remaining credential dependency without pretending the native task persistence defect is fixed.
