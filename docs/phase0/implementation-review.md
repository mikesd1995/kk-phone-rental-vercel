# Implementation review and acceptance evidence boundaries

This is the Phase-0 implementation review for Issue #153, stacked on unmerged PR #152 at `0bb2c07522c706d02f1edcf6bb9cfb5c74dd96b0`. Final commit, remote CI and deployment observations belong in the Draft PR and delivery report, so this document does not certify a later HEAD.

## Problem → solution → improvement

| Problem | Solution | Improvement |
| --- | --- | --- |
| Governance contracts did not persist generic task/run state | Scoped repository interface with a local SQLite implementation and strict migration | Restartable state without importing KK network writers or adopting a cloud vendor in core |
| Model text or minimal approval helpers could be mistaken for authority | Trusted host-bound service, five complete persisted policies, certificate, single-use scoped approval | Deny precedence and P4/R3 maximum remain deterministic |
| State could be recorded without matching audit | State, budget, approval consumption, audit and outbox commit in one transaction | Failure rolls back the whole local operation; denial audit records only hashes and error codes |
| Retries/recovery could duplicate work or restore old budgets | Request-hash idempotency, version checks, immutable checkpoints, leases and increasing fences | Same accepted request returns its stored result; stale owners and changed versions fail closed |
| Child/candidate work could escape parent budget | Durable child reservation and active run charging for evidence/claims/skills | Candidate creation is bounded work and cannot bypass an exhausted task |
| New modules could accidentally become production entrypoints | Transitive production-import barrier and all activation flags OFF | Later integration must deliberately change the barrier and supply new acceptance evidence |

## Defects found and corrected

| Symptom | Root cause | Correction and regression |
| --- | --- | --- |
| Audit chain had repeated sequence values | Generic repository list order is by opaque ID, not event time | Sort and validate the full sequence/hash chain before append; service tests verify multi-event chains and block forged history |
| Candidate/evidence metadata could be created after task budget exhaustion | Initial metadata methods were not tied to active run budget charging | Bind evidence/claim/skill writes to creating run, current configuration and transactional step charging; exhausted-run regression |
| Secret-like fields could enter checkpoint payloads | Initial core key filter omitted token suffixes, camel-case API keys and service-role fields | Validate JSON before serialization, reject credential keys and preserve narrowly typed accounting fields; five secret-field checkpoint regressions |
| Recovery could be bypassed with an ordinary state transition | Generic transition allowed RECOVERING → RUNNING without fence completion | Require fenced `finishRecovery`; stale owner and ordinary-transition bypass regressions |
| Certificate mutation failure classification varied by trigger order | Authority and revocation guards could both match | Deterministic adapter validation preserves refusal and precise error classification; repository regression |
| Schema metadata could be absent after creation interruption | Schema DDL and migration identity were initially separate commits | One transaction includes schema plus migration identity; apply/reopen/rollback/reapply tests |
| Nonfinite sandbox limit produced an inconsistent error classification | Strict JSON shape rejection precedes domain limit checks | Preserve fail-closed schema rejection and test both malformed shape and invalid finite bound |

The preexisting Windows regression baseline produced line-ending-sensitive failures until tracked text was normalized for local test execution. No production source contents or existing tests were changed. Its remaining symlink-creation test fails with Windows `EPERM`, including outside the filesystem sandbox. Linux CI must run that original test unchanged before accepting the exact final HEAD.

## Coverage map for the requested gates

| Gates | Regression assets |
| --- | --- |
| Project isolation, adversarial read/write, approval/certificate scope, missing IDs | `tests/platform/control-plane.test.js`, `repository.test.js` |
| Policy deny, ceilings, unknown policy, privilege refusal, zero P5/P6/R4/R5 | Service tests plus unchanged `tests/agent-governance-contract.test.js` |
| Web/email/model/tool injection and fake approval | Service tests and `gateway.test.js` |
| Mutation idempotency, stale version, immutable terminal state | Service and repository tests |
| Task/run/model/tool budgets, delegated allocations, child authority | Service tests |
| Kill switches, unavailable/stale switch, independent deployment/schedule controls | Service and gateway tests |
| Interrupted worker, checkpoint hash/version, recovery ownership/fence | Service restart/recovery tests |
| Approval diff, expiry, nonce, scope, target, capability, environment and replay | Service and repository tests |
| Certificate expiry, revocation, self-issuance and scope | Service and repository tests |
| Audit generation, failure, tamper evidence, failure atomicity | Service and repository tests with injected failures |
| Actual local migration, identity drift, rollback/reapply and history preservation | Repository tests |
| Outbox idempotency, rollback and no executor | Service tests; `STAGED_DISABLED` is never dispatch evidence |
| Production import isolation | `production-import-isolation.test.js` |
| SSRF/private networks/URL credentials, traversal, command/query boundaries, oversized/malformed payloads | `security.test.js`, `gateway.test.js` |
| Project Pack/version/flags, candidate-only skill/claim lifecycle | `project-pack.test.js`, service tests |

## Remaining boundaries

Only isolated SQLite migration execution is covered. No PostgreSQL/Supabase migration or shared staging validation has occurred. Node 24.13.1 is pinned for the local adapter's CI; `node:sqlite` is still marked experimental by that runtime. Production Node and dependencies remain unchanged; no production dependency was added.

Host authentication, authority administration and real process/network sandbox enforcement are integration prerequisites. The local repository and constructors are trusted host APIs, never agent tools. The credential broker denies acquisition; the tool gateway has no executor. Provider/model fields do not connect providers. Approval staging consumption does not authorize a later real dispatch: that future executor needs its own governed acceptance and transaction design.

The audit chain detects corruption accessible through this adapter, not a privileged administrator rewriting an entire database and hashes. External anchoring is deferred. Audit verification currently scans the project's history and is intended for bounded Phase-0 fixtures; scaling needs separately evaluated indexing/anchoring without weakening integrity.

Child budgets remain conservatively reserved; no refund or automatic authority increase exists. Retention labels do not activate deletion. Independent evaluator IDs are metadata, not execution proof. Machine SOT and operational/provider runtime state were not revalidated because no integration into those systems is performed.

No automatic main merge, production deployment, business write, Apps Script change, scheduled-runner change, Machine-SOT authority change, provider activation, secret operation or production environment change is part of this branch.
