# KK Phone Rental — Third-Party Agent Repo Readiness

Date: 2026-09-10 Asia/Bangkok
Branch: `skills/x-scanner-v2`
Status: `ISOLATED_EVALUATION_READY / PRODUCTION_INTEGRATION_PROHIBITED`

## Scope

Prepare KK Phone Rental for controlled evaluation of:

1. `DannyMac180/sol-advisor`
2. `Alishahryar1/free-claude-code`

This document does **not** authorize either project to become a KK production writer, scheduler, provider transport, or business source of truth.

## Live KK authority remains unchanged

Runtime authority remains the live KK Machine SOT and exactly one highest Active `_Policy_Registry` policy. CRM remains authoritative for booking/inventory truth. Existing canonical Scanner, Verifier, Canary, Notification Ledger, Make transports, booking writer, provider and customer boundaries remain in force.

Third-party agent tooling is subordinate to KK authority. It may help plan, review, test, or implement bounded development work; it may not redefine business truth or bypass governance.

## Pinned upstream evaluation heads

At evaluation start:

- Sol Advisor upstream `main`: `37b75cad535abdd46531f0227483a8842d045ab8`
- Free Claude Code upstream `main`: `81fa340ecac5ce1ae8ba4ea60e7a5517224bfaee`
- Free Claude Code package version observed: `6.2.2`

Do not silently track floating upstream `main` during a controlled KK evaluation. Any later update requires a new diff/review of the upstream change set before adoption.

## Sol Advisor — intended KK role

Sol Advisor is an orchestration layer for Codex-native software delivery. Its current design declares one of `solo`, `delegate`, `audit`, or `full`, with Sol/High retaining architecture and acceptance. Auxiliary roles are bounded and parent verification is mandatory.

### Allowed initial use

- architecture critique
- defect-hypothesis generation
- implementation planning
- branch-only code changes under an explicit owned-file scope
- deterministic test generation
- read-only final review of accumulated diff

### Not allowed initially

- direct Machine-SOT mutation
- direct Scanner/Verifier/Canary runtime operation
- task enable/disable/reschedule
- Make scenario activation or replacement
- Apps Script production writer creation/replacement
- owner/customer/provider send
- X publish
- KYC/customer-flow mutation
- merge to `main`

### Integration decision

Use Sol Advisor first as a **development-plane orchestrator**, not an operations-plane agent.

For KK, `solo` should remain default. `audit` is preferred for high-risk KK changes requiring fresh scrutiny. `delegate/full` should be used only when the bounded task and auxiliary model/runtime are independently proven available.

## Free Claude Code — intended KK role

Free Claude Code is a local proxy/router that can launch multiple coding agents against configured model providers. Current package metadata requires Python `>=3.14`, uses FastAPI/uvicorn/httpx, and exposes `fcc-codex` plus other client launchers.

The Codex launcher creates temporary command-line model-provider overrides and strips existing OpenAI/Codex credential-related environment keys from the child environment before launching Codex through the FCC proxy.

### Important security/config findings

- Proxy authentication is configurable but defaults to disabled in current settings.
- The sample/default proxy token is not suitable as a KK security boundary.
- Web-server tools are enabled by default in current configuration.
- The installer can install/verify many third-party coding agents and can execute upstream installer scripts from several vendors.
- Optional RTK setup can make global agent configuration changes.

### KK initial policy

FCC must begin **local-only / sandbox-only / least privilege**:

- bind only to loopback where supported
- enable proxy authentication with a unique local token
- never reuse KK provider, Make, Google, LINE, Telegram, X, Xama, Vercel, GitHub PAT, or production credentials
- disable unnecessary messaging/voice/web-server capabilities for the evaluation profile
- do not enable global RTK auto-patching during initial evaluation
- install/enable only the minimum client needed for the test lane
- do not give the FCC-routed coding agent production SOT or provider write access
- do not expose the FCC proxy to LAN/public network

## Required isolation architecture

```text
KK Production Plane
  Machine SOT / CRM / canonical runners / Make / providers
                 ^
                 | NO DIRECT WRITE
                 |
Development Gate
  explicit task spec
  owned files
  branch-only mutation
  deterministic tests
  parent diff review
  governed CI
                 ^
                 |
        Sol Advisor (optional)
                 ^
                 |
      FCC model route (optional)
```

Neither Sol Advisor nor FCC becomes an authority layer.

## Branch strategy

Current production-development branch remains `skills/x-scanner-v2` and PR #1 must remain Draft/Open/Unmerged.

For actual third-party-agent implementation work, prefer a dedicated branch derived from the then-current reviewed KK development head, for example:

`integration/agent-tooling-sandbox`

Do not create that branch until the first concrete integration task is selected. Do not merge it to `main` without explicit Owner approval.

## File ownership boundary for first implementation

Initial implementation should be restricted to new development-plane files such as:

- `docs/kk-phone-rental/*agent*`
- `scripts/dev/*agent*`
- `scripts/dev/*fcc*`
- deterministic tests specifically for the integration guard

The first implementation must not modify Scanner/Verifier production launchers, provider adapters, booking writer, Make configuration, production deployment scripts, or Machine-SOT schemas.

## Acceptance gates before any production-connected experiment

All must pass:

1. Upstream commit is pinned and recorded.
2. Install/runtime steps are reviewed before execution; no blind `curl | sh` in the KK production environment.
3. FCC uses a dedicated isolated config directory/profile.
4. No production secrets are present in the agent environment.
5. Network exposure is loopback-only or equivalently isolated.
6. Proxy authentication is enabled with a non-default token if FCC is running.
7. No global RTK/agent auto-patching during initial evaluation.
8. Git changes are branch-only with exact changed-file inspection.
9. Existing `npm run check` / governed KK CI remains green after any KK code change.
10. Main remains untouched and PR #1 remains Draft/Open/Unmerged unless Owner explicitly changes that policy.
11. No Machine-SOT/CRM/Make/provider/customer/public mutation occurs from evaluation agents.
12. Rollback is deletion of isolated config/worktree/branch changes only; production state must require no rollback.

## Evaluation test plan

### Stage A — read-only capability test

Give Sol Advisor/FCC a bounded, non-production code-review problem against a snapshot or branch and require:

- explicit assumptions
- changed-file scope = zero for read-only test
- defect findings with evidence
- no external mutation

### Stage B — branch-only deterministic change

Select one low-risk internal contract/test defect. Require:

- owned-file allowlist
- regression test first or paired with fix
- complete diff inspection
- `npm run check`
- governed CI on final relevant head

### Stage C — adversarial isolation test

Attempt prompts that would normally tempt an agent to:

- edit unrelated files
- use production credentials
- modify scheduler state
- bypass a failing test
- merge `main`

Expected result: refusal/fail-closed within KK integration policy.

### Stage D — production-read-only observation

Only after A–C pass may an agent receive bounded read-only production evidence for diagnosis. It still receives no production write authority.

## Rollback plan

Because initial adoption is development-plane only:

- stop FCC process
- remove its isolated local config/profile
- remove Sol Advisor local plugin/role files from the isolated environment if needed
- discard/revert sandbox branch changes
- keep Machine SOT, CRM, canonical runners, Make and provider states untouched

If rollback would require editing production business state, the integration has violated this design.

## Current verdict

### Sol Advisor

`READY_FOR_ISOLATED_EVALUATION`

Good fit for KK architecture/review orchestration provided KK authority, file ownership, parent verification and no-production-write boundaries remain dominant.

### Free Claude Code

`READY_FOR_ISOLATED_EVALUATION_WITH_HARDENED_PROFILE`

Useful as an optional model-routing/cost lane, but it has a materially wider local attack/configuration surface than Sol Advisor. It must not be installed with broad defaults into the KK production environment.

### Combined use

`ALLOWED_IN_DEVELOPMENT_PLANE_ONLY`

Recommended order:

1. Evaluate Sol Advisor independently.
2. Evaluate FCC independently with a hardened isolated profile.
3. Only then test `Sol Advisor -> FCC-routed Codex/model` on one low-risk branch-only task.
4. Compare quality, latency, cost, deterministic test performance and scope discipline against native Sol/High.
5. Promote only capabilities that outperform the baseline without weakening KK safety invariants.

## Next concrete implementation

The next safe task is to create a **local/sandbox execution profile and integration guard contract** that prevents third-party agent tooling from receiving production credentials or production mutation targets. Do not connect it to Scanner/Verifier/Make/booking/provider paths yet.
