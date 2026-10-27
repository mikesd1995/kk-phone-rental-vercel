# Canonical owner readiness — OFF source preparation, 27 October 2026

This source candidate adds a configuration-only authenticated diagnostic while every execution flag remains OFF. It does not install or release anything. Make, gateway, GAS, native database, provider, ACK, Sheet projection and natural runtime evidence remain separate requirements.

## Bounded authentication while OFF

`POST /api/kk-make-owner-notify` selects this diagnostic only for the exact header `X-KK-Canonical-Probe: readiness-v1`, before the existing disabled transport gate. Requests without that exact marker retain their existing behavior, including OFF HTTP 503. Non-POST requests retain HTTP 405.

The request must contain exactly five own data fields: `stage: canonical-readiness`, `version: v1`, a UUID `nonce`, the public string `bot_id`, and a lowercase SHA256 `provider_binding_sha256`. Raw strings/streams are bounded at 4096 UTF-8 bytes. If the platform supplies an already parsed object, the helper bounds its serialized size; that does not prove the original wire size. Strict ingress/parser behavior remains a release-readback requirement. Extra properties, symbols, accessors, invalid types and an operational stage under the probe marker fail with generic HTTP 400; they cannot fall through to dispatch.

The stored canonical consumer secret must be at least 32 characters and distinct from the signing, canonical and producer secrets. The helper hashes expected and provided bearer values with SHA256 and compares equal-length digests with `timingSafeEqual`. It returns generic HTTP 401 before configuration metadata when authentication fails. It never returns or logs a credential, request header or key digest. Every response has `send_allowed: false` and no-store headers.

Authenticated diagnostics return HTTP 409 if transport, canonical or producer execution is ON. Otherwise the exact response whitelist contains fixed mode/version, authentication, nonce/time, execution flags, explicitly named configuration-presence booleans, validated adapter binding presence/match, and `off_configuration_ready`. A missing dependency, invalid binding, wrong public bot or wrong binding digest keeps that final boolean false. There is no `ready_to_send` field.

`durable_store_configured` is configuration presence/project binding only. GAS project/deployment/OAuth booleans likewise describe configured values only. None of these fields proves native tables, ACLs, a reachable database, GAS deployment/version/functions, OAuth acceptance, installed runtime variables, provider delivery or permission to activate.

The helper and gateway diagnostic perform no fetch, canonical handler, database/RPC, GAS, provider or business operation. Tests exercise the real gateway and helper, with spies on those boundaries.

## Separate diagnostic export and capture hash boundary

`server/make-owner-canonical-readiness.js` exports `READINESS_MODULE` and its independent `READINESS_MODULE_SHA256`. The exact JSON component is `make/telegram-response-adapter/readiness.v1.json`.

Diagnostic semantic SHA256: `6fa20da6df8e9b27f3bf2dba41e3682fb8a2dcb9f9eb9dac22d568f6d7ea8996`.

This component has one absolute fixed gateway POST, request-specific `Authorization: Bearer {{connection.consumerBearer}}`, the probe marker, public bot from `{{toString(connection.botId)}}`, and nonce/binding-digest mapper strings. It contains no Telegram URL, provider operation, grant/envelope/receipt stage, dynamic host, dispatcher or second request. Redirects are disabled and sensitive logs are sanitized.

The existing capture `MANIFEST`, `manifest.v1.json` and capture semantic SHA256 `35f3a0e0909b29e1dd796b9a0ec3fecabc13ed1498e943a891ecdbbe12a8d1ce` remain unchanged. That hash covers the existing Base, connection, capture and reporter subset. It does not attest arbitrary additions to the app. The separate diagnostic hash requires its own source/export and installed-definition readback; adding this component does not alter the capture binding digest.

## Remaining evidence boundary

Source tests authenticate synthetic fixture configuration only. A released exact gateway head, actual Make definition/connection readback, one supported finite diagnostic invocation and preserved nonce/response/zero-send evidence are required to prove real credential equality. Do not enable senders to test it, run a full scenario, replay an old envelope, seed a new fixture, re-age source rows or infer provider/ACK/Sheet/natural-runtime success from readiness.

Independent review of the readiness source completed with no BLOCKER/MATERIAL finding and 158/158 focused tests. Exact-head hosted CI and protected release approval/readback remain separate requirements. Keep the engineering execution gate `BLOCKED` while required evidence is missing.

## Installed definition readback — 27 October 2026, 01:41 Bangkok

The existing private app `kk-telegram-response-adapter-h5mj68` v1 now contains `checkCanonicalReadiness`. Its communication and mappable parameters were read back exactly against the separately hashed diagnostic export. The logical connection label `ownerTelegramAdapter` resolves to the actual SDK connection name `kk-telegram-response-adapter-h5mj68`; no credential was read or copied. Existing Base/connection/capture/reporter definitions matched source in twelve independent comparison assertions before the addition.

This installed-definition observation is not a diagnostic execution. No scenario instance was added, no function was run and no gateway key equality was established. After the definition write, scenario6176241 remained inactive/on-demand with the original eight modules, unchanged lastEdit `2026-10-26T13:52:58.100Z`, zero incomplete executions, and modules8/11/12/13 disabled. Current Production is still the earlier64cec7 gateway without the readiness route. The separate HTTP-v4 credential request remains owner-operated and pending; custom-app connection11956776 is not that HTTP credential.
