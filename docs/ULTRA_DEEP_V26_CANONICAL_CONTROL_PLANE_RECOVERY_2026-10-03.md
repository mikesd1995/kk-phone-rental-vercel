# Ultra Deep V26 canonical control-plane recovery — 2026-10-03

## Result

The canonical control-plane is **not lost** and must not be replaced.

Canonical Supabase project:
- name: `kk-phone-rental-runtime-ledger`
- ref: `zehlsagzrpromtfqqflt`
- region recorded by prior acceptance: `ap-southeast-1`

Historical repository evidence records the project as provisioned at USD 0/month and ACTIVE_HEALTHY, with exact project-ref binding enforced by the runtime ledger.

## Live reachability evidence

On 2026-10-03, unauthenticated read-only GET reachability checks were made to:
- `/functions/v1/kk-admin-write-control`
- `/functions/v1/kk-runtime-ledger-oidc-probe`

Both canonical endpoints returned HTTP `405 Method Not Allowed`.

This is positive reachability evidence: the canonical project/function routes resolve and reject the unsupported GET method. It is not authenticated OIDC acceptance and performs no business write.

## Decision

Do **not** migrate the control-plane to `kk-unified-inbox`.
Do **not** create replacement ledger tables/functions.
Do **not** change the pinned project ref.

Doing so would create split-brain risk across runtime ledger, project memory, scanner transition gates, and admin write control.

## Remaining production gate

V26 production activation still requires:
1. production deployment containing the corrected V26 scanner ingress;
2. Vercel production OIDC identity accepted by the canonical Edge Functions;
3. bounded authenticated OIDC health/probe;
4. scanner execute-readonly readiness with business writes disabled;
5. bounded read-only Full Loop + Verifier + exact readback;
6. only then governed commit-mode acceptance.

If the connected Supabase identity cannot administer `zehlsagzrpromtfqqflt`, that is an administration-visibility limitation, not evidence that the control-plane is absent.

## Safety

- production/business writes: 0
- no new Supabase project/table/function
- no credential rotation
- no control-plane migration
- no duplicate scheduler
