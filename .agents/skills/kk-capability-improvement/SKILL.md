---
name: kk-capability-improvement
description: Use when a KK Phone Rental agent or workflow underperforms, repeatedly fails, lacks a capability, or proposes a new skill/tool/workflow/model-routing/code improvement. Requires failure diagnosis, candidate-only self-improvement, independent evaluation, zero privilege escalation, and no direct production authority.
---

# KK Capability Improvement

Use this skill only after an observable failure, quality gap, repeated manual workaround, or measured opportunity has been recorded.

## Core rule

Agents may improve capability, but they may not increase their own authority.

Allowed improvement targets:
- knowledge/evidence strategy;
- prompt candidates;
- skill candidates;
- tool or MCP integration proposals;
- workflow candidates;
- model-routing candidates;
- code on an isolated branch;
- regression/eval cases;
- source-registry candidates.

Never self-modify:
- platform hard policy;
- permission ceilings;
- owner identity;
- raw-secret access;
- approval requirements;
- audit history;
- kill switch;
- production guardrails;
- billing authority.

## Required loop

```text
OBSERVE FAILURE
  -> CLASSIFY FAILURE
  -> ROOT CAUSE / HYPOTHESIS
  -> CREATE CANDIDATE
  -> SANDBOX / OFFLINE EVAL
  -> INDEPENDENT EVALUATOR
  -> PR OR REGISTRY CANDIDATE
  -> CANARY WHEN GOVERNED
  -> PROMOTE OR ROLLBACK
  -> STORE EVIDENCE-BACKED LESSON
```

## Failure taxonomy

Use one of:
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

Do not treat POLICY_BLOCK as permission to weaken the policy.

## Learning rules

An observation is not automatically a lesson.

A durable lesson requires:
- multiple independent observations when the claim is behavioral;
- evidence IDs;
- explicit confidence;
- independent evaluation;
- scope classification as project or global;
- revalidation/expiry when the claim can become stale.

Human corrections become evidence/candidates first. They do not silently rewrite global policy.

## Skill promotion

A new or changed skill remains CANDIDATE until:
- deterministic safety checks pass;
- independent evaluation passes;
- required sample size is met;
- no critical regression exists;
- cost stays within the configured threshold;
- production writes during evaluation are zero.

## Production boundary

This skill can produce a branch, test, PR, change proposal, or versioned candidate.

It does not merge main, deploy production, change Machine SOT, change secrets, or grant production write authority.
