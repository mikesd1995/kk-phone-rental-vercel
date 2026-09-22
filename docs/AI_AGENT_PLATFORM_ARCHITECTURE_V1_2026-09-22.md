# Universal AI Operations Platform — Architecture V1

Date: 2026-09-22  
Reference project: KK Phone Rental  
Status: DESIGN FREEZE CANDIDATE / NON-PRODUCTION FOUNDATION

## Objective

Create a reusable AI operating layer that can serve KK Phone Rental first and later other projects without coupling the platform to one model provider.

The platform may research, analyze, learn, create candidate skills/tools/workflows/code, test changes and produce PRs. It must not self-authorize, weaken governance, expose raw secrets or mutate production outside governed execution.

## Existing KK foundations preserved

This design extends rather than replaces existing controls:

- Scanner remains discovery/staging authority only.
- Verifier remains governed event adjudication authority.
- Canary remains zero-business-write.
- existing Machine-SOT, lock/fencing, Manifest, transaction and readback invariants remain authoritative where applicable.
- existing external discovery/HF providers remain advisory.
- runtime ledger remains evidence/control-plane telemetry, not business truth.

## Architectural planes

### Control Plane

Deterministic software owns:

- task identity;
- project/workspace scope;
- policy resolution;
- permission ceiling;
- risk classification;
- approvals;
- budgets;
- execution state;
- kill switches.

LLM output is never equivalent to execution authority.

### Agent Plane

Initial roles:

- Manager;
- Research;
- Social Intelligence;
- Business Analyst;
- Engineering;
- Operations;
- Evaluator.

Roles are stable abstractions. Model providers are replaceable implementations.

### Model Router

Routing considers:

- task capability;
- modality;
- tool requirements;
- accuracy/eval score;
- latency;
- cost;
- provider availability;
- data handling constraints.

Provider mapping is configuration, not architecture.

### Tool Gateway

Agents request typed capabilities through a gateway. External credentials are resolved outside model context.

No agent receives raw production secrets by default.

### Knowledge Plane

Separate:

- working memory;
- episodic run history;
- project facts;
- project lessons;
- global lessons;
- evidence;
- skill registry.

Facts and lessons have different promotion and expiry rules.

### Evaluation Plane

Changes progress through:

SANDBOX -> OFFLINE EVAL -> INDEPENDENT REVIEW -> PR/CANDIDATE -> CANARY -> PROMOTE/ROLLBACK

Production mutation is not a self-learning step.

## Hard policy hierarchy

Order:

1. PLATFORM_HARD
2. WORKSPACE
3. PROJECT
4. WORKFLOW
5. TASK

Lower layers may narrow authority but may never expand beyond an upper layer.

Unknown or ambiguous policy fails closed.

## Risk model

- R0: public/read-only discovery;
- R1: analysis/report/memory candidate;
- R2: staging write, sandbox execution, branch/test;
- R3: reversible external proposal/PR;
- R4: production data/config/deploy action;
- R5: secrets, permissions, billing or destructive administration.

R4+ requires human approval in V1. R5 is not autonomous-agent authority.

## Permission ceiling

- P0 PUBLIC_READ
- P1 PROJECT_READ
- P2 STAGING_WRITE
- P3 DEVELOPMENT
- P4 PROPOSAL
- P5 CONTROLLED_PRODUCTION
- P6 PLATFORM_ADMIN

Default autonomous agent ceiling is P4.

## Trust model

External content is data, not authority.

Treat web pages, email, social posts, documents, search results, external APIs and model outputs as untrusted instructions.

External content cannot:

- change objective;
- grant capability;
- modify policy;
- request secrets;
- authorize deployment;
- disable safety controls.

## Approval integrity

Approval binds to the exact canonical change hash.

If the diff changes, approval becomes invalid.

Approvals expire and require an identified approver.

## Capability Improvement Engine

Failure taxonomy:

- KNOWLEDGE_GAP
- SKILL_GAP
- TOOL_GAP
- MODEL_GAP
- DATA_GAP
- WORKFLOW_GAP
- CODE_DEFECT
- POLICY_BLOCK
- EXTERNAL_FAILURE
- AMBIGUOUS_TASK

Allowed self-improvement outputs:

- memory candidate;
- lesson candidate;
- prompt candidate;
- skill candidate;
- tool/MCP proposal;
- workflow candidate;
- code branch/PR;
- routing candidate;
- eval/regression case;
- source candidate.

Forbidden self-modification:

- platform policy;
- permission system;
- raw secrets;
- owner identity;
- approval requirements;
- audit history;
- kill switch;
- production guardrails;
- billing authority.

Policy blockage is not permission to weaken policy.

## Memory governance

Observation != lesson.

Facts require evidence and verification time.

Behavioral lessons require:

- repeated observations;
- evidence;
- explicit confidence;
- independent evaluation.

Stale knowledge must support revalidation/expiry.

Human corrections enter as evidence/candidates first and do not silently become global rules.

## Evaluation / anti-gaming

Promotion must use multiple measures where applicable.

Example discovery metrics:

- recall;
- precision;
- duplicate rate;
- evidence quality;
- cost;
- latency.

A system cannot pass solely by optimizing one metric.

Future mature evals should include hidden/held-out cases and production post-promotion measurement.

## Creator/judge separation

The worker that creates a candidate must not be the sole acceptance authority.

Critical changes require deterministic tests plus independent evaluation, with human approval when risk requires it.

## Concurrency and mutation

Existing KK fencing/readback patterns remain the production model.

Future agent-platform mutation contracts must require:

- idempotency key;
- expected version/precondition;
- lease/fencing when shared writers exist;
- commit;
- readback;
- explicit failure state;
- compensation/rollback path.

Blind write retry is forbidden.

## Recovery

Long-running task design must support:

- checkpoint;
- resume;
- timeout;
- bounded retries;
- orphan-run recovery;
- explicit terminal state.

Provider/tool failure must not be converted into fabricated success.

## Skill supply chain

Skills are versioned artifacts.

Lifecycle:

EXPERIMENTAL -> CANDIDATE -> EVALUATION -> STABLE -> DEPRECATED/REVOKED

Stable promotion will require:

- immutable content hash;
- permission ceiling;
- explicit tool dependencies;
- eval suite;
- evaluator identity;
- provenance/creator;
- no hidden production authority.

## Model drift

Provider/model changes require eval before default promotion.

Routing changes need enough samples, a promotion margin and a cooldown/canary strategy to avoid routing thrash.

## Project isolation

Every platform record must be scoped by workspace/project.

Cross-project access is explicit, never inherited accidentally.

Project-specific SOTs remain separate from the platform/audit database.

## Kill-switch principle

The platform must be capable of independently disabling:

- autonomous execution;
- external write;
- production write;
- deploy;
- schedules.

Read/audit/diagnostic capabilities should remain available during incident containment.

## V1 implementation sequence

Phase 0 — contracts and governance
- task/run schemas;
- policy hierarchy;
- permissions;
- trust boundary;
- audit format;
- kill-switch contract.

Phase 1 — read-only agent runtime
- research;
- diagnostics;
- evidence;
- evaluator.

Phase 2 — staging/development
- sandbox;
- branch;
- tests;
- PR;
- staging writes.

Phase 3 — learning
- memory promotion;
- lesson promotion;
- capability improvement engine;
- skill candidates.

Phase 4 — controlled operations
- only certified low-risk workflows may obtain bounded P5 executors.

Phase 5 — multi-project
- Project Packs reuse the same core.

## Current repository implementation in this branch

Added:

- server/agent-governance-contract.js
- server/capability-improvement-contract.js
- tests/agent-governance-contract.test.js
- tests/capability-improvement-contract.test.js
- .agents/skills/kk-capability-improvement/SKILL.md

package.json syntax checks include both new contract modules.

## Production state

This architecture branch does not:

- deploy production;
- merge main;
- modify Apps Script;
- mutate bookings/events/prices/assets/customers;
- change Machine SOT;
- enable Scanner/Verifier/Canary;
- enable HF/external providers;
- change Vercel environment variables;
- read or rotate raw secrets.

All changes are repository-side, reversible and reviewable.
