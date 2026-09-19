# Admin degraded-mode latency mitigation — 2026-09-20

## Incident context

Production Apps Script upstream is currently unavailable and has repeatedly classified as `APPS_SCRIPT_DEPLOYMENT_NOT_FOUND` / HTTP 404 HTML. The Admin correctly falls back to the direct Google Sheet read-only snapshot, but recent production observations show total degraded snapshot latency of about 32.9s and 40.7s.

Sampled direct public GViz reads for the fallback complete around ~1.7–1.8s. This indicates the dominant delay is the dead Apps Script request before fallback rather than Google Sheet parsing.

## Change

The snapshot adapter now caps the Apps Script wait for `snapshot` / `snapshotHealth` at 12,000ms instead of 55,000ms.

This timeout applies only to the read snapshot adapter. It does not shorten or enable any booking/event/customer/pricing write action.

When Apps Script does not answer before the cap, the existing direct-Sheet fallback remains:
- read-only;
- identity-validated;
- fail-closed if fallback validation fails;
- `write_actions_enabled=false`.

The adapter also records separate safe timing fields:
- `proxy_upstream_ms`
- `fallback_ms`
- `proxy_round_trip_ms`

The runtime aggregate fallback log now includes `upstream_ms` and `fallback_ms` without row data, PII, URLs, deployment IDs, API keys, or PINs.

## Safety boundary

No Apps Script source or deployment is changed.
No Apps Script access setting is changed.
No Vercel environment variable or secret is changed.
No Google Sheet sharing setting is changed.
No business row is written.
No booking/event/customer/pricing/inventory mutation is introduced.

The 12s cap trades a long read wait for a safe degraded read-only response. If a healthy Apps Script snapshot later exceeds this cap, the Admin will temporarily enter read-only fallback rather than risk an ambiguous write state. Write actions remain governed by the existing write path and are not made more permissive.

## Permanent recovery still required

This is a latency mitigation, not the write-path root fix.

The authoritative container-bound Apps Script 9_5_9 source/deployment still must be recovered. A standalone Drive project named `KK Phone Rental` was exported read-only and confirmed to be an old Backend V10 lineage, so it is not a valid recovery source and must not be deployed.

Permanent recovery remains:
1. obtain the exact container-bound Apps Script editor/deployment identity;
2. recover and diff exact 9_5_9 source;
3. verify active Web App /exec and access;
4. run zero-write `phase1Health`;
5. update Vercel `KK_ADMIN_SCRIPT_URL` only if the verified active URL differs;
6. re-run authenticated Admin acceptance before writes are considered restored.
