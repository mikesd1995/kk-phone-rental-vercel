# Ultra Deep V21 — direct COMPLETE without per-run deployment

## Problem

Run `37046911003` completed discovery, verifier, competitor-universe search, commercial preparation and governed production execution. Every verified candidate was safely terminally skipped because the event date had an active booking or the event was already in storefront history.

Current `main` already contains Completion Gate V2, which correctly treats full terminal-disposition coverage as `COMPLETE / SAFE_NOOP_TERMINAL_DISPOSITIONS`. The deployed production executor still exposed Production Runtime V2 backed by an older Completion Gate V1, so the run was incorrectly reported as incomplete.

## V21

The production health contract now exposes `completion_gate_version`.

The direct workflow requires:
- `KK_ULTRA_DEEP_PRODUCTION_RUNTIME_V2`
- `KK_ULTRA_DEEP_FULL_LOOP_COMPLETION_GATE_V2`
- `KK_GITHUB_OIDC_VERIFIER_V1`

If the deployed executor already satisfies that contract, the run goes straight from commercial evidence to governed production execution.

If and only if the contract is stale, the same Full Loop run performs one local Vercel production build and `vercel deploy --prebuilt --prod`, then polls the production health endpoint until the V2 contract is live before continuing. This is a one-time runtime refresh path, not a deployment step for normal data scans.

## Desired owner behavior

A single owner command must:
1. start immediately;
2. show RUNNING;
3. discover and verify;
4. search the locked competitor universe;
5. reconcile against booking/history/storefront state;
6. create/update only safe candidates;
7. exact-readback any write;
8. return COMPLETE even when the correct result is zero writes because every verified candidate was safely skipped.

No PR/request marker is part of the normal scan path.
