# Ultra Deep V22 — Deployment-Independent Safe No-Op Acceptance — 2026-10-03

V21 fixes safe no-op semantics inside the production runtime, but its Vercel Preview/Production deployment is temporarily blocked by the Hobby deployment quota.

V22 does not bypass production execution. It validates the signed V20 production result after the governed executor has already run.

A legacy V20 no-op may be accepted only when:
- top-level production response is OK;
- OIDC is verified and run_id/SHA equal the current workflow;
- runtime is exactly V2;
- production writes are zero;
- production blockers are empty;
- the old completion gate failed only with NO_VERIFIED_CANDIDATES;
- all production action counts are zero;
- commercial verifier count is positive;
- disposition count exactly equals verifier count;
- every disposition is a whitelisted terminal safe skip (booking date, event history, owner hidden).

Missing coverage, ambiguous disposition, non-zero writes, OIDC mismatch, or any other legacy acceptance shape remains fail-closed.

Once V21 reaches Production, native runtime COMPLETE is accepted normally and this compatibility path becomes unnecessary but harmless.
