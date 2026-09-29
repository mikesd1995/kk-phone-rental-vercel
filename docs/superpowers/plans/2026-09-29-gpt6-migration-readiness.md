# GPT-6 Migration Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make KK Phone Rental explicitly ready for a safe GPT-6 migration without claiming or enabling a production model cutover before a real OpenAI transport and shadow evaluation exist.

**Architecture:** Keep the current Machine-SOT/Agent-Gateway authority topology unchanged. Add a deterministic, zero-write migration policy that records the GPT-6 target routing and blocks cutover until transport, prompt audit, representative shadow evals, and zero-write safety acceptance are all proven. Harden the repository prompt contracts so a newer model cannot infer broader authority from capability alone.

**Tech Stack:** Node.js 20, node:test, existing KK Agent Gateway/Registry/skills, ChatGPT scheduled runtime, Vercel.

**Spec:** This plan is the migration spec. Official OpenAI guidance checked 2026-09-29: GPT-6 family = Astra/Sol/Luna; Responses API is preferred for agentic API workloads; preserve the current workload role/effective reasoning when migrating.

## Global Constraints

- Discovery Scanner remains staging-only.
- Verifier remains governed verification authority under Machine SOT.
- Canary remains zero-write and isolated.
- Owner-hidden storefront state must never be reopened implicitly.
- No production model cutover, deployment, schedule mutation, pricing/booking/inventory/business-truth mutation in this branch.
- Current repo has no OpenAI SDK/API invocation; do not invent a Responses transport as part of readiness scaffolding.
- A model target is configuration intent, not execution evidence.
- Default migration target for the current GPT-5.6 Sol workload role is GPT-6 Sol.
- GPT-6 Luna is for efficient/high-volume bounded work; GPT-6 Astra is escalation-only for hardest ambiguity.
- Any future API transport should use Responses API unless a later verified requirement says otherwise.

## Review Focus

- A more capable model must not gain broader Scanner/Verifier/Canary authority.
- Public migration state must not claim GPT-6 is executing when transport is not wired.
- Cutover must remain blocked if any required readiness gate is false.
- Model routing must preserve a low-cost path for repetitive workloads and deterministic Canary behavior.
- Prompt hardening must not weaken existing owner-visibility, fencing, readback, or fail-closed rules.

---

### Task 1: Add failing migration-policy regression

**Files:**
- Create: `tests/kk-model-migration-policy.test.js`
- Test: `tests/kk-model-migration-policy.test.js`

**Interfaces:**
- Consumes: existing AGENTS.md and Scanner/Verifier/Canary skill contracts.
- Produces: expected interface for `server/kk-model-migration-policy.js`.

- [ ] Write tests for zero-write shadow-only state, workload routing, readiness gates, and prompt-authority invariants.
- [ ] Run CI and verify RED because `server/kk-model-migration-policy.js` does not exist.

### Task 2: Implement deterministic GPT-6 migration policy

**Files:**
- Create: `server/kk-model-migration-policy.js`
- Modify: `package.json`
- Modify: `server/kk-agent-registry.js`
- Test: `tests/kk-model-migration-policy.test.js`

**Interfaces:**
- Produces: `POLICY_VERSION`, `routingForWorkload(name)`, `migrationReadiness(evidence)`, `publicPolicy()`.
- Registry exposes the migration policy as readiness metadata only.

- [ ] Implement the minimum deterministic policy needed by Task 1.
- [ ] Add syntax checking for the policy module.
- [ ] Expose readiness metadata through the public Agent Registry without changing agent authority.
- [ ] Run targeted test and full CI to verify GREEN.

### Task 3: Harden prompts for GPT-6 without expanding authority

**Files:**
- Modify: `AGENTS.md`
- Modify: `.agents/skills/kk-discovery-scanner/SKILL.md`
- Modify: `.agents/skills/kk-event-verifier/SKILL.md`
- Modify: `.agents/skills/kk-canary-safety/SKILL.md`
- Test: `tests/kk-model-migration-policy.test.js`

**Interfaces:**
- Consumes: current Machine-SOT authority boundaries.
- Produces: explicit model-neutral authority, evidence taxonomy, and completion/readback contract.

- [ ] Add compact model-migration rules: capability never expands authority; distinguish observed/source/inference/recommendation; completion requires required evidence/readback; ambiguous protected writes fail closed.
- [ ] Keep Scanner staging-only, Verifier authority, Canary zero-write.
- [ ] Run targeted test and full CI.

### Task 4: Record inventory, decisions, and next cutover gate

**Files:**
- Create: `docs/GPT6_MIGRATION_READINESS_2026-09-29.md`

**Interfaces:**
- Records current runtime facts, changes, evidence, blockers, and next gate.

- [ ] Record repo inventory: no OpenAI SDK/API invocation, no Vercel Agent Runs observed in 7d, ChatGPT scheduled runtime remains separate from repo execution.
- [ ] Record target routing and why GPT-6 Sol is the default migration target.
- [ ] State that Responses API wiring is deferred until a real API transport is deliberately introduced.
- [ ] Record test/CI evidence and unresolved cutover blockers.
