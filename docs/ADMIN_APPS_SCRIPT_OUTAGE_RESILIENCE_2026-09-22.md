# Admin Apps Script outage resilience — 2026-09-22

## Incident

Production Admin remained reachable, but the Apps Script write backend failed from Vercel with two observed failure modes:

- deterministic HTTP 404 HTML from `script.google.com`, classified as `APPS_SCRIPT_DEPLOYMENT_NOT_FOUND`;
- later snapshot/write-health timeouts.

Observed production fallback telemetry on 2026-09-22 showed roughly:

- Apps Script snapshot wait: ~12s;
- direct-Sheet fallback: ~4s;
- write-health probe: ~4s;
- total degraded Admin snapshot latency: ~14–16s;
- fallback reader: `public-gviz`;
- write health: failed during the incident.

The direct-Sheet fallback correctly preserved read visibility, but repeated requests could re-pay the full dead-upstream wait and concurrent fallback requests could duplicate the same Google Sheet reads.

## Root cause boundary

This patch does **not** claim to repair the missing/invalid Apps Script Web App deployment.

The authoritative root repair still requires owner-authenticated Apps Script access to prove:

1. the bound Apps Script project identity;
2. active Web App deployment and canonical `/exec` URL;
3. project timezone;
4. installed cleanup trigger configuration;
5. backend/Sheet identity before Production URL cutover.

No Apps Script URL was guessed. No Apps Script deployment was performed.

## Changes

### Snapshot upstream circuit

`api/kk-admin-snapshot-v5.js`

- adapter version: `admin-snapshot-upstream-error-v5.4`;
- adds an in-memory, URL-scoped 30s circuit for recent snapshot `UPSTREAM_TIMEOUT` and deterministic deployment/auth failures;
- while the circuit is open, read requests enter the existing safe direct-Sheet fallback immediately instead of repeating the 12s snapshot wait;
- a different Apps Script URL does not inherit the old circuit;
- a healthy primary Apps Script response clears the circuit.

This is intentionally process-local. It reduces repeated waits on warm Vercel instances without creating persistent state or changing business authority.

### Deterministic write-health probe suppression

When the already-observed root cause proves that the configured Apps Script deployment is unavailable:

- `APPS_SCRIPT_DEPLOYMENT_NOT_FOUND`;
- `GOOGLE_AUTH_HTML`;
- `GOOGLE_DRIVE_DOCS_HTML`;

the fallback no longer sends a redundant `phase1Health` request to the same unusable URL.

Writes remain fail-closed and `write_actions_enabled=false`.

Timeout-triggered fallback still performs the lightweight write-health probe because snapshot reads can be slow while the write path remains healthy.

### Direct-Sheet fallback request coalescing

`server/admin-sheet-fallback.js`

- fallback version: `admin-direct-sheet-readonly-fallback-v3.1`;
- concurrent requests for the same Sheet/reader/fetch identity share one in-flight snapshot build;
- completed fallback snapshots are reused for up to 2 seconds;
- cache is in-process only and retains the existing authenticated Admin boundary;
- no persistent cache or external data store was added;
- cache can be cleared/disabled for tests.

The short TTL is deliberately small to avoid masking legitimate changes if snapshot fallback is active while lightweight write health still allows writes.

## Safety invariants preserved

- no Production business-data writes;
- no Booking/Event/Asset/Pricing mutation;
- no Apps Script deployment;
- no Apps Script/Spreadsheet timezone mutation;
- no trigger mutation;
- no Vercel secret/environment mutation;
- no Scanner/Verifier/Canary/HF Production activation;
- direct-Sheet fallback remains read-only;
- fallback validation remains fail-closed;
- write actions still require verified Apps Script write-path identity.

## Regression coverage

Added coverage for:

- deterministic deployment failure skips redundant write-health probe;
- URL-scoped circuit activation and expiry;
- concurrent direct-Sheet fallback calls coalesce;
- immediate duplicate fallback reads use the short cache;
- degraded fallback remains read-only.

## Operational expectation

This patch changes outage behavior from:

`dead Apps Script wait -> fallback + redundant health wait`

toward:

`first failure detection -> safe fallback -> short circuit for repeated reads`

It reduces blast radius and latency during an Apps Script incident. It does not replace the required owner-authenticated recovery of the canonical Apps Script deployment.


## Production activation retry checkpoint — 2026-09-22 17:11 ICT

Post-merge Production remained pinned to old deployment `dpl_8Uksu863a6TspwVmHXmKxo9nBQ8j` / commit `9588391d8caa7e40eb1381dc98e86b6873f155ae` after the original main deployment attempt was blocked by Vercel daily deployment quota.

Fresh runtime evidence demonstrates the upstream is genuinely intermittent:
- 2026-09-22 16:48 ICT: `phase1Health` received Google HTTP 404 HTML classified `APPS_SCRIPT_DEPLOYMENT_NOT_FOUND`;
- 2026-09-22 17:09 ICT: snapshot upstream still timed out after ~12s and write-health timed out after ~4s;
- 2026-09-22 17:11 ICT: snapshot still timed out after ~12s, but lightweight write-health succeeded in ~1.24s (`write_health_ok=true`), reducing fallback round trip to ~13.27s on the old runtime.

This alternating 404 / timeout / healthy lightweight write probe proves the observed "works sometimes, fails sometimes" behavior is upstream/deployment-path instability, not an Admin UI crash.

A fresh Preview deployment was observed READY after the earlier daily-quota block, so this documentation-only main checkpoint intentionally retriggers Vercel's normal Production build from current `main`. No runtime/API/server source is changed by this checkpoint. The purpose is to deploy the already-validated resilience runtime from PR #162 with Production environment configuration rather than promoting a Preview artifact whose Admin environment was not proven equivalent.

Safety:
- no Apps Script deployment or URL guess;
- no Vercel secret/environment mutation;
- no Google Sheet business-row mutation;
- no Sheet timezone or Apps Script trigger mutation;
- no Scanner/Verifier/Canary/HF activation.
