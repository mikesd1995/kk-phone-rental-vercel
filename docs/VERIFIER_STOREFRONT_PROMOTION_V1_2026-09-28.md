# Verifier Storefront Promotion V1 — 2026-09-28

## Finding
The storefront publication mechanism was not removed. The existing governed Admin path still supports `createEvent`, defaults new events to `active_on_web=true`, applies event price overrides, verifies Web Ready state, and is protected by the event duplicate/date preflight in `api/kk-admin-guard.js`.

The missing piece was the controlled handoff from the hardened discovery/verifier pipeline back to that existing Admin createEvent path.

## Added
`server/kk-verifier-storefront-promotion.js` prepares an exact Admin `createEvent` payload only when:
- commercial evidence status is READY_FOR_FINAL_VERIFIER;
- title/date/venue are complete;
- verified HTTPS poster evidence exists;
- competitor pricing evidence is complete (>=3 independent exact-event sources);
- explicit final KK package prices are supplied;
- final Verifier approval is true;
- owner publish policy allows publication.

The plan explicitly requires the existing duplicate guard and exact storefront readback.

A second callable stage verifies readback of event identity, visibility, poster and package prices.

## Important runtime boundary
This patch restores the governed handoff contract, but does not bypass Admin authentication or call the mutation endpoint from the Agent Gateway. The actual mutation must still use the existing authenticated `createEvent` route so its date/duplicate guards, Apps Script DocumentLock, audit log and Web Ready verification remain in force.

This is deliberate: adding a second raw Sheet writer would recreate the unsafe Scanner-to-Core path that hardening removed.

## Remaining activation work
Bind an authenticated executor to take only a `READY_FOR_GOVERNED_ADMIN_CREATE` plan, invoke the existing Admin createEvent endpoint once with an idempotency/correlation key, then feed fresh 08_Web_Ready/09_Web_Packages data to the readback verifier. Do not enable autonomous publication until this acceptance run passes.
