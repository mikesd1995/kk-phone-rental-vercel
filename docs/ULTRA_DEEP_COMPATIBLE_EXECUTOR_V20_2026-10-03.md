# Ultra Deep V20 — deployment-independent data Full Loop

## Problem

The direct Full Loop was still coupled to Vercel deployment state:
- after verifier/commercial passed, the workflow required the production executor commit SHA to equal current `main`;
- any code-only Ultra Deep change could therefore force a production deployment before event data could be written;
- Vercel Hobby deployment quota could block an otherwise compatible event-data Full Loop.

This coupling is unnecessary for ordinary event-data runs.

## V20 contract gate

The direct workflow now probes the deployed production executor contract instead of requiring an exact code SHA.

A deployed executor is compatible when all of the following are true:
- health response is `ok=true`;
- service is exactly `kk-ultra-deep-full-loop`;
- runtime is an explicitly supported production runtime version (`V1` or `V2`);
- OIDC verifier is `KK_GITHUB_OIDC_VERIFIER_V1`.

When the contract is compatible, the workflow proceeds directly to:
Verifier/commercial handoff → GitHub OIDC → governed production Full Loop → exact storefront readback.

No Vercel build or deployment is requested.

## Security

This does not weaken authentication:
- OIDC still requires the exact repository, owner, `main` ref, workflow path, run ID, run SHA, actor and event name;
- the production executor still hydrates fresh production SOT;
- the existing governed Admin writer remains the only business mutation surface;
- duplicate/history/booking/tombstone guards remain unchanged;
- production COMPLETE still requires exact storefront readback.

If the deployed executor contract is not explicitly compatible, the run fails closed instead of silently using an unknown runtime.
