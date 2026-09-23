# Phase 0: persistent control-plane foundation

This change adds an isolated local foundation for task/run persistence, scoped authorization, immutable audit history, bounded budgets and checkpoint recovery. It stages tool intents without executing tools. It does not provide an autonomous agent, scheduler, provider router or production executor.

The implementation is stacked on PR [#152](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/152) and tracks Issue [#153](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/153). See [baseline and reuse inventory](baseline-inventory.md). Final acceptance requires a separate report bound to the final commit; the design and example fixtures here are not CI or runtime proof.

## Modules and trust boundary

| Component | Responsibility |
| --- | --- |
| `platform/control-plane.js` | Trusted host service with a facade bound at construction to workspace, project, agent and certificate. Rechecks five persisted policy layers, certificate and fresh kill-switch state on each governed operation. |
| `platform/contracts.js` | States, versions, budget dimensions, retention labels, safe record and UTC validation. Reuses canonical hashing from the existing governance module. |
| `platform/sqlite-repository.js` | Vendor-specific local adapter behind scoped get/list/transaction operations. Parameterized SQL, optimistic versions and readback; no network database access. |
| `platform/sql/001-control-plane.up.sql` / `down.sql` | Local schema, integrity constraints and disposable-fixture rollback artifact. Never apply to shared or production databases. |
| `platform/tool-gateway.js` | Closed schemas, immutable tool/version metadata, typed proposal construction and untrusted output classification. It contains no executor. |
| `platform/security-boundaries.js` | Deterministic URL/address/path/command/query validation, hash-only trace redaction, sandbox-plan contract and deny-only credential broker. |
| `platform/project-pack.js` | Strict schema-1 local-only pack validation, all flags OFF, bounded metadata loading and contained reference paths. |
| `project-packs/kk-phone-rental/` | First reference pack; versions and existing source references without copied KK business logic or authority grants. |

Only the trusted host creates the repository and service facade. The host bootstraps policy records, certificates, approvals and kill-switch snapshots through its administration boundary. The agent-facing facade does not mint these records or expose a raw repository handle. Constructor parameters and host policy data must never be copied from untrusted model output.

SQLite is a trusted service database. The repository is not an agent-accessible SQL endpoint, a process sandbox, or an authentication system. Its constraints cannot defend against a host administrator who can replace the database file or change application code. Scope enforcement assumes the host binds the facade to an authenticated identity. A real host authentication/administration service remains a future integration.

## Persistent records

Records share `workspace_id`, `project_id`, an immutable ID and an optimistic record version. Schema 1 stores bounded JSON payloads in a scoped `platform_records` table; generated keys and composite foreign keys enforce relevant task/run relationships and idempotency scope. Application service validators enforce complete operation-specific shapes; DB guards add identity, state, scope, immutable-history and permission/risk ceilings.

| Collection | Important payload identity and state |
| --- | --- |
| tasks | Objective, role, policy/pack/workflow/agent/tool/certificate versions, status, timestamps, idempotency, granted/requested capabilities, P4-or-lower ceiling, step/tool/retry/cost budget, lineage, recovery/fence and compensation metadata. |
| runs | Task/agent/model attribution, skill versions, configuration versions, timestamps, status, budget use, token accounting, cost, checkpoint ID and result/error classification. |
| audit | Event/actor/target identity, UTC timestamp, policy version, before/after hashes, sequence and previous-event hash. Append-only; mutations and mandatory events commit together. |
| policies | Policy/version/scope/level, allow/deny capabilities, ceiling, content hash and activation history. Existing versions are immutable. |
| certificates | Agent, scope, local environment, capabilities, ceiling, trusted issuer, version/hash, expiry and revocation evidence. Only revocation can narrow an existing grant. |
| approvals | Proposal/scope/environment/target/capability/risk/hash/nonce, human attribution, timestamps, consumed state. Local staging consumes applicable approvals once in the same transaction. |
| evidence | Source identity, observed UTC time, content hash, classification/reliability label and creating run. Labels are recorded evidence metadata, not independent provider proof. |
| claims | Project-scoped fact/lesson candidates with evidence, verification/expiry, confidence and revalidation metadata. No stable/global promotion API. |
| skills | Candidate-only version/hash/creator/provenance/dependencies/eval-suite metadata. No self-promotion or skill execution. |
| checkpoints | Task/run identity, completed/pending work, safe payload, remaining budget, last successful call reference, all security-critical versions and integrity hash. |
| outbox | Local disabled intent, tool/version, payload hash, idempotency, audit/approval references, attempts, error/recovery/compensation metadata. No raw credentials or active dispatcher. |
| idempotency | Scoped operation/key identity, request hash and durable result; changed requests cannot reuse an accepted key. |
| kill_switches | Fresh control snapshot for AGENT_EXECUTION, EXTERNAL_WRITE, PRODUCTION_WRITE, DEPLOYMENT and SCHEDULES. Missing/stale evidence denies mutation. |

Costs use nonnegative integer micro-units, chosen by the trusted host and consistent within each budget tree. They are accounting units rather than fetched provider prices. Delegation reserves child allocations from parent remaining budgets and enforces a hard maximum depth of three. No budget auto-increase or higher-privilege fallback exists.

Canonical timestamps are UTC ISO strings with milliseconds and `Z`. Asia/Bangkok is a presentation/business timezone only. Existing KK natural-occurrence auditors retain their own +07:00 business-schedule assumptions.

## Explicit scope limits

- Tool requests produce proposals and `STAGED_DISABLED` outbox records. `TOOL_ALLOWED` means allowed local intent staging, never a provider call, send or production mutation.
- Recovery validates a durable checkpoint and acquires a fenced local recovery owner. It does not replay external tools or claim exactly-once remote effects.
- Claims and skills stay candidates. Recording evaluator identifiers does not execute an independent evaluator or certify the candidate.
- Provider/model identities are attribution fields only. No provider credentials are loaded and no model call is made.
- Sandbox validation produces a plan, not OS/container isolation. Credential references contain no credential; acquisition fails with `CREDENTIAL_BROKER_NOT_CONFIGURED`.
- The pack grants no execution capability. All runtime, scheduler, provider, gateway-write, self-improvement and production-executor flags are explicitly false.
- Production/API imports cannot reach the new platform or Project Pack. A transitive static-import regression barrier covers api, admin, cloudflare, existing server modules and storefront script.
- Existing Scanner, Verifier, Canary, Machine SOT, Apps Script, runtime ledger and production configuration remain outside the new runtime.

## Validation and future acceptance

The isolated platform test runtime is Node 24 with built-in `node:sqlite`; this does not require changing production Node configuration. No new npm dependency is needed. Tests under `tests/platform/` exercise store restart, migration compatibility, scope attacks, policy/certificate/approval denial, atomic failure boundaries, budgets, recovery, typed tool proposals, input security, pack validation and production import isolation.

Run the repository checks and both the original and platform suites using the scripts declared in package.json. Evidence must include the actual command result, final HEAD, CI bound to that HEAD, and any unverified runtime/provider facts. Local fixture success is not production acceptance.

See [version, failure and retention semantics](semantics.md) and ADR-001 through ADR-010. Remaining work belongs to later governed phases: authenticated host administration, real sandbox/credential broker, read-only executor, artifact signatures, evaluator service and remote storage adapters. None should be enabled by changing a local fixture.

## Rollback

Close/reject the Phase-0 draft or revert only Phase-0 commits through review. Existing production modules need no runtime rollback because this foundation is not imported by them. Keep populated audit/history databases for investigation. The SQL down migration is destructive and is reserved for explicitly disposable isolated test databases. Never point it at shared staging or production.
