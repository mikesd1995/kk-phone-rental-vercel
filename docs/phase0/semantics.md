# Version, recovery, retention and data semantics

## Compatibility and migrations

Schema 1 uses an explicit migration hash and local SQLite schema version. An empty isolated database may be initialized; unknown preexisting objects, an unsupported schema version or changed migration content fail closed. Do not edit an applied migration in place. A future schema change needs a new numbered migration, compatibility/readback tests and a reviewed rollback or forward-repair plan.

The service records policy, Project Pack, workflow, agent, tool contract and capability certificate versions on tasks/runs/checkpoints. Resuming requires exact version identity and a valid checkpoint hash. Missing version identity fails closed. A changed security-critical identity yields `CHECKPOINT_VERSION_DRIFT` or `CONFIGURATION_VERSION_DRIFT`; no automatic upgrade or tool replay occurs.

The reference Project Pack supports schema 1, explicit semantic versions, phase0 and local environment only. Unknown fields and enabled flags are rejected. Its reference revision pins identify the inspected baseline; metadata loading does not verify a Git blob or authorize artifact execution. Future executable skills require verified content hashes/signatures and governed promotion.

## Transaction and failure boundaries

| Boundary | Deterministic result |
| --- | --- |
| Task/state prepared; mandatory audit insert fails | Transaction rolls back task/state, audit and idempotency together; report `AUDIT_WRITE_FAILED`. |
| Policy/certificate/scope/kill-switch check fails | No governed mutation is accepted. Missing/stale control state is denial, never inherited permission. |
| Outbox intent staged; process exits | Restart sees committed `STAGED_DISABLED` metadata; no executor/send was started. Retry with the same scoped key returns the stored result. |
| Checkpoint committed; worker exits | Checkpoint and run reference remain durable. Resume validates content/version/scope and claims one recovery owner with a new fence. |
| Recovery lease acquired; later operation fails | Already committed lease remains bounded by expiry. Local transaction failure changes nothing within that failed operation. A replacement owner must reread, obey expiry and acquire a higher fence. |
| Old recovery owner attempts completion | Owner/fence/expiry mismatch yields `LEASE_CONFLICT`; no blind retry. |
| Mutation/readback fails inside repository transaction | Transaction is not committed. If a future remote effect becomes ambiguous, use `WRITE_AMBIGUOUS_RECONCILE_REQUIRED`; do not infer success or retry. |
| Budget exhausted | Task/run stop with `BUDGET_EXCEEDED`, `PARTIAL_RESULT` classification and durable audit. No child allocation or automatic increase can bypass the root budget. |
| Approval replay or changed binding | Reject consumed, expired, wrong-scope/environment/capability/target/proposal/hash approvals. The staging operation and consumption are atomic. |
| Audit-chain integrity fails | Stop governed changes with `AUDIT_INTEGRITY_FAILURE`; preserve evidence for trusted investigation. |

Idempotency scope is workspace + project + operation + key, with a request hash that includes agent/certificate/policy attribution. Same key plus changed request is a conflict, not a second operation. Optimistic versions prevent stale replacement; immutable/terminal history cannot be silently rewritten.

Compensation fields describe whether work is required, the planned action, status, recovery owner and attempts. Phase 0 does not execute compensation against providers. For future external uncertainty, preserve intent and evidence, reconcile provider identity/readback, then plan an explicitly authorized compensation. Full rollback is not assumed safe.

## Classification and redaction

The classification vocabulary is PUBLIC, INTERNAL, CONFIDENTIAL and SECRET. Phase-0 platform evidence/checkpoints/normal state accept minimized PUBLIC or INTERNAL data. Customer-sensitive data and secrets are outside this foundation's persistence scope.

Security validation rejects known credential-bearing keys and recognizable secret forms; it is defense in depth, not a complete data-loss prevention system. Trusted callers must not provide raw credentials. Tool traces retain classification and hashes, not raw payloads. CONFIDENTIAL/SECRET traces are fully redacted. Do not treat a source's PUBLIC label as proof arbitrary payload content is safe.

Commands and queries are validated data only; there is no shell or arbitrary SQL execution API. URL/path guards protect proposal inputs but do not establish a network connection, resolve all DNS/rebinding cases or create filesystem isolation. Future executors must enforce actual address, redirect, symlink, filesystem, process and egress restrictions outside the model.

## Retention contract

| Record category | Retention semantics |
| --- | --- |
| Tasks/runs | Project history retained pending human review; preserve attribution and referenced evidence. |
| Audit | Security/legal hold; no agent update/delete and no automated disposal in Phase 0. |
| Evidence | Retain for source validity, dependent claims and investigation hold; expiry triggers revalidation need, not deletion or rewritten history. |
| Checkpoints | Retain through terminal status and recovery/investigation hold. |
| Tool traces | Minimized/hash-only; 30 days is a candidate retention policy for later human-approved cleanup, not an active deletion job. |
| Cost records | Accounting history subject to human review; budget facts must remain attributable. |
| Policies/certificates/approvals | Retain historical authority and revocation/consumption evidence; new versions do not erase prior grants. |

No automated deletion worker exists. DB rollback artifacts destroy isolated fixtures only and must not be used as retention enforcement.

## Evidence quality and candidate lifecycle

An observation is not a fact or lesson. Evidence metadata remains attributable to its creating run and source; a reliability label alone does not prove provider verification. Claims remain `FACT_CANDIDATE` or `LESSON_CANDIDATE`, project-scoped, with explicit evidence, verification/expiry and revalidation metadata. Behavioral lesson candidates require multiple referenced observations and an independent evaluator identifier; an identifier alone is not completed independent evaluation.

Skills persist version/hash/provenance, creator, tool dependencies and eval-suite metadata as `CANDIDATE`. There is no API for self-promotion to STABLE or for executing a skill. Future lifecycle EXPERIMENTAL -> CANDIDATE -> EVALUATION -> STABLE -> DEPRECATED/REVOKED requires separate trusted evaluation and immutable promotion evidence. No candidate can expand policy, raw-secret access, billing, owner identity, kill switches or production authority.
