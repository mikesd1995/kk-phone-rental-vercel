# AI Agent Platform Hardening — Change Log

Date: 2026-09-22  
Branch: agent-platform-hardening-v1-20260922  
Target: main  
Production deployment: NONE

## Why this pass exists

The prior architecture correctly separated Scanner/Verifier/Canary and introduced external discovery safety, but the planned multi-agent/self-improving platform still relied on several rules that existed only as design discussion.

This pass converts the most safety-critical rules into versioned executable contracts and regression tests.

## Added

### 1. Deterministic agent governance contract

File:

server/agent-governance-contract.js

Adds:

- fixed policy hierarchy;
- risk classes R0-R5;
- permission levels P0-P6;
- external-content trust classification;
- upper-policy deny precedence;
- permission-ceiling narrowing;
- self privilege-escalation refusal;
- hard-governance capability refusal;
- R4/R5 human-approval classification;
- canonical change hashing;
- hash-bound expiring approval validation;
- external data cannot authorize capabilities.

### 2. Capability improvement contract

File:

server/capability-improvement-contract.js

Adds:

- standardized failure taxonomy;
- standardized improvement-candidate taxonomy;
- explicit forbidden self-modification targets;
- failure diagnosis requirements;
- candidate validation;
- fact promotion requirements;
- lesson promotion requirements;
- independent evaluator requirement;
- minimum sample/promotion gates;
- primary metric threshold;
- cost-regression threshold;
- zero-production-write evaluation gate;
- candidate-only learning behavior.

### 3. Regression coverage

Files:

- tests/agent-governance-contract.test.js
- tests/capability-improvement-contract.test.js

Tests protect:

- prompt-injection authority boundary;
- policy precedence;
- permission ceilings;
- privilege escalation;
- hard governance;
- human approval boundary;
- exact diff approval hashes;
- approval expiry;
- unknown-policy fail closed;
- failure taxonomy;
- governance self-modification refusal;
- direct production-authority refusal;
- evidence-backed lessons/facts;
- evaluation sample and promotion gates.

### 4. Repository capability-improvement skill

File:

.agents/skills/kk-capability-improvement/SKILL.md

This gives future coding/agent sessions explicit instructions for measured self-improvement rather than ad-hoc self-modification.

### 5. Check pipeline coverage

package.json now runs Node syntax validation on both new server contracts.

## Safety impact

Before:

Several important rules were architectural intent and agent instructions.

After:

Key rules have deterministic machine-checkable enforcement primitives and regression coverage.

Most important improvement:

SELF-LEARNING != SELF-AUTHORIZATION

An agent can create an improvement candidate but cannot grant itself production authority or rewrite the controls that govern promotion.

## Compatibility

No existing production module imports the new contracts in this branch.

This is deliberate.

The contracts must first pass repository CI/review before later Phase-0 wiring.

## Remaining gaps

This pass does not yet implement:

- persistent task/run database schema for the new platform;
- centralized tool gateway;
- credential broker;
- agent runtime;
- model router;
- production capability certificates;
- hidden eval corpus;
- durable checkpoint/resume;
- skill signature registry;
- memory database/revalidation worker;
- multi-project Project Pack runtime.

Those are implementation phases after design/contract acceptance.

## Rollback

Rollback is repository-only:

- close/reject the branch/PR; or
- revert the added commits.

No production rollback is necessary because production was not mutated.


## Validation evidence

### Initial CI finding

The first PR CI run correctly failed one newly added regression:

- workflow: Admin Regression #471;
- syntax checks: PASS;
- tests: 478 PASS / 1 FAIL;
- failing invariant: unknown policy level must fail closed.

Root cause:

Policy-level validation was occurring from the Array.sort comparator. With only one layer the comparator did not execute, so an unknown single policy level could bypass validation.

Correction:

- validate every policy level before sorting;
- validate permission ceilings before policy resolution;
- add regression coverage for the single-layer case.

The same hardening pass also added:

- prefix-aware hard-governance blocking;
- explicit lower-level empty allow-list = deny-all;
- external objective/secret/approval requests treated as control attempts;
- capability candidates require an explicit target class;
- fact verification timestamps must parse as real dates;
- promotion must explicitly prove zero production writes during evaluation.

### Final CI

Final PR CI:

- workflow: Admin Regression #475;
- syntax checks: PASS;
- regression tests: 481 / 481 PASS;
- failures: 0;
- HF benchmark harness safety check: PASS;
- HF readiness fail-closed check: PASS.

### Preview

Vercel created branch previews with target=null only.

Latest verified branch preview state: READY.

No production deployment was requested or performed by this hardening pass.

## Review score snapshot

These scores distinguish design quality from implementation coverage.

- Architecture / governance design: 8.9 / 10
- Safety / fail-closed discipline: 9.2 / 10
- Regression / audit discipline: 9.0 / 10
- Self-improvement governance: 8.6 / 10
- Reusability / project isolation design: 8.5 / 10
- Runtime agent implementation completeness: 5.8 / 10
- Multi-model/tool routing implementation completeness: 4.5 / 10
- Persistent memory/skill registry implementation completeness: 4.5 / 10

Interpretation:

The project is strong enough to freeze the governance direction, but the reusable AI platform itself is not yet complete. The next work should build Phase-0 persistence and execution primitives rather than add more model providers.
