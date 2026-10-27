# Independent canonical OFF staging compiler — 2026-10-27

Status: `SOURCE_ONLY_OFF_GRAPH_NOT_RUNTIME_VERIFIED`. This change supplies a pure source compiler and synthetic unit fixtures. It installs no modules, looks up no connection, runs no scenario and sends no request. No live credential, module ID or settings evidence is supplied by its fixtures.

## Scope and preservation contract

`server/make-owner-canonical-off-stage.js` exports `prepareAdapterOff(snapshot, binding)` separately from the existing future cutover compiler. The existing `prepare` and fourteen-module `prepareAdapter` implementation and tests remain unchanged.

The first boundary is the full fresh normalized snapshot. Before constructing mappings, the compiler requires same scenario `6176241`, `active:false`, exactly zero incomplete executions, a nonempty parseable `lastEdit` matching `binding.expectedLastEdit`, and exactly fifteen distinct modules. There are five original legacy modules and ten independently assigned canonical roles. IDs are supplied in metadata; the compiler never creates IDs or fills missing module objects.

The complete original path remains `5 → 6 → 8 → 9 → 10`. The compiler verifies its module types, versions, main root and exact edges, refuses unreviewed routes, and requires native module 8 already disabled on connection `10356915`. It deep-clones all five original objects verbatim, including mapper bodies, headers, filters and metadata. It does not repurpose HTTP6 or remove any legacy module.

The required actual-shaped trigger is exactly:

```json
{"moduleId":5,"module":"scenario-service:StartSubscenario","kind":"on-demand","scheduling":{"type":"on-demand"}}
```

`snapshot.interface` must explicitly contain input and output arrays. The trigger, interface and settings are deep-cloned unchanged. `snapshot.settings.sequential` must already be `true` and `snapshot.settings.dlq` must already be `false`; absent or conflicting values fail rather than being invented or repaired. Other settings remain intact. An optional separately normalized `snapshot.schedule` must exactly equal the observed trigger scheduling and is preserved only when supplied. No top-level empty input/output arrays or interval900 are generated. Current scenario metadata that omits settings is insufficient for this compiler until supported settings readback exists.

## Required binding metadata

`binding.assignedIds` has exactly these keys, each a distinct positive safe integer disjoint from `5/6/8/9/10`:

`poll, iterator, admit, prepare, provider, report, reject, project, projectReject, commit`.

Every assigned module must be present with its actual type and version, explicitly `disabled:true`, `root:'orphan'`, and no `follows`, parent, onError, errorHandler or routes fields. The compiler accepts only the initial inert graph; recompilation of an already wired graph is deliberately unsupported.

`binding.adapterBinding` uses the existing strict adapter binding contract. `provider` equals its module ID. Provider/reporter modules require the `app#` namespace plus the validated raw app name, exact version 1 and matching existing `__IMTCONN__`. The raw app binding, source manifest hash and provider binding digest are retained unchanged.

`binding.gatewayConnection` must contain exactly `{id, type, allowedUrl}`. The type is `account:http-v4-apikey`; ID is a supplied positive safe integer distinct from native and adapter connection IDs; URL is exactly `https://kk-phone-rental.vercel.app/api/kk-make-owner-notify`. Missing, unknown or conflicting metadata fails with `MAKE_CANONICAL_CONNECTION_UNBOUND`. Optional legacy `gatewayConnectionId` and `connectionAllowedUrl` fields must agree. Existing HTTP helper connection parameters, when present, must agree and cannot use noAuth or an adapter connection. No raw credential metadata or value is emitted.

This is validation of supplied metadata, not independent proof that a live account exists, has matching ACLs or will authenticate. No live compile can be claimed while the actual secure HTTP connection or required settings readback is unavailable.

## Resulting inert topology

All ten canonical modules remain disabled. The canonical poll is an orphan, unreachable from legacy main module 5:

```text
poll (orphan) → iterator → admit → prepareNew → provider → report → project
                                                  └ errorHandler → reject → projectReject → Commit
```

The assigned independent prepare role is necessary because HTTP6 retains its complete legacy behavior. Provider readiness and all adapter receipt references use the assigned prepare ID. JSON-safe `envelope_json` comes from admit. The rejection reporter transports the adapter's original `provider.error.message` frame. The filter retains the original envelope expiry strictly greater than `now + 15 seconds`. It adds no retry, sleep, Break, Resume, fallback sender or altered expiry policy.

Canonical HTTP modules use fixed POST, JSON-string bodies, secure API-key connection references and the fixed gateway URL. They contain no credential-valued headers or dynamic URL. The compiler returns `removeModuleIds:[]`, `active:false`, `activation_allowed:false` and `send_allowed:false`.

## Verification and remaining gates

The separate OFF staging tests cover rich legacy equality, input/binding immutability, exact scenario contract, all ten disabled flags, canonical isolation, independent prepare receipt references, raw adapter hash preservation, JSON-safe envelopes, and fail-closed malformed snapshots, roles, types, versions, routes and connections. Existing future cutover tests must continue passing unchanged. Parent workflow supplies independent review, syntax/workflow checks, full regression and engineering-gate evaluation after the source stops changing.

Source test success cannot close release, live HTTP credential/readback, native database/ACL/transaction, private GAS version/OAuth, HTTP and Make engine semantics/internal retry, provider receipt, durable ACK, Sheet projection or natural runtime evidence. Installation additionally requires current Machine SOT/highest compatible Active policy, supported current Make schemas for disabled orphan modules, actual assigned IDs and fresh exact readback. No activation, protected merge, deployment, provider execution, old fixture replay or Scanner/Verifier change follows from this compiler returning successfully.
