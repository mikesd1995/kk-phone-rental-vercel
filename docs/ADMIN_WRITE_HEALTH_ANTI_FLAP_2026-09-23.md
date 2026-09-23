# Admin write-health anti-flapping remediation — 2026-09-23

## Incident

Production Admin remained readable but repeatedly switched into read-only mode because the lightweight Apps Script `phase1Health` probe was hard-capped at 4 seconds.

Fresh Production telemetry on deployment `dpl_E7U4UpBZpzh4XmzcNT5fHaVgatVT` showed the same writer identity alternating between:

- healthy response around 1.7–2.0 seconds;
- `WRITE_HEALTH_TIMEOUT` at ~4.0 seconds;
- healthy again minutes later.

This produced visible write availability flapping even while direct Google Sheet reads remained healthy.

## Root cause boundary

The proven immediate defect is the 4-second write-health cutoff combined with one-failure fail-closed behavior.

This change does not claim to repair the deeper Apps Script runtime/deployment instability. Deterministic failures such as deployment 404, Google auth HTML, or identity mismatch still fail closed immediately.

## Changes

### Longer bounded health probe

`api/kk-admin-snapshot-v5.js`:

- adapter version `v5.5 -> v5.6`;
- `WRITE_HEALTH_TIMEOUT_MS: 4000 -> 10000`;
- healthy warm-runtime cache `15s -> 30s`;
- failed health cache `5s -> 8s`.

The explicit legacy proxy already allows `phase1Health` up to 20 seconds, so the snapshot-side health probe remains bounded below the action proxy ceiling.

### Transient-only anti-flapping state

Added a warm-runtime stability state keyed by exact Apps Script URL + Core Sheet ID.

Rules:

1. a verified healthy identity resets transient strikes;
2. only `WRITE_HEALTH_TIMEOUT` and generic transport `WRITE_HEALTH_ERROR` are transient;
3. the first transient failure may reuse a healthy identity verified within the previous 60 seconds;
4. that grace result is cached for only 5 seconds so a second probe occurs quickly;
5. a second consecutive transient failure fails closed;
6. any deterministic/protocol/identity failure fails closed immediately and clears the recent-good latch;
7. no prior verified healthy identity means no grace.

This prevents one marginal timeout from disabling Admin writes while preserving fail-closed behavior for repeated or security-relevant failures.

### Telemetry

Production logs now expose:

- `write_health_probe_error_code`;
- `write_health_stability_state`;
- `write_health_transient_failures`;
- `write_health_grace_used`.

A snapshot warning is also emitted when transient grace is being used.

## Regression coverage

Added tests proving:

- write-health timeout is now 10 seconds;
- first transient timeout after a recent verified healthy identity is tolerated;
- second consecutive transient timeout fails closed;
- deterministic deployment/protocol failures are never masked;
- no recent healthy identity means no grace;
- transient-grace cache is intentionally short.

## Safety boundaries

No:

- Google Sheet business-row mutation;
- Booking/Event/Package/Asset/Pricing/Customer write;
- Apps Script deployment or source mutation;
- Vercel environment/secret mutation;
- Direct Writer activation;
- PR #177 merge;
- Scanner/Verifier/Canary/HF/Make activation.

This branch changes only Admin write-health admission behavior and tests/documentation.

## Follow-up

The permanent architecture remains:

1. reconcile Direct Writer control-plane source onto current main;
2. provision a dedicated writer service account with least-privilege Editor access to the canonical Core Sheet;
3. pass authenticated control/read/write/audit acceptance;
4. route safe Phase-1 update actions directly;
5. migrate Booking/Asset transactional writes so Apps Script is no longer the critical write dependency.
