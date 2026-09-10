# KK Phone Rental — Third-Party Tooling Stage A Evaluation

Date: 2026-09-10 Asia/Bangkok
Branch: `integration/ai-engineering-model-v1`
Stage: A — READ-ONLY CAPABILITY / SUPPLY-CHAIN REVIEW
Status: PASS_WITH_RESTRICTIONS

## Scope

Read-only evaluation of four external projects as methodology/tooling inputs for KK engineering. This stage authorizes no installation into the production environment and no production write access.

Pinned evaluation heads:

- `DannyMac180/sol-advisor` — `37b75cad535abdd46531f0227483a8842d045ab8`
- `garrytan/gstack` — `71f6048e8ada25180e61438abc1d98cb151fe9a7`
- `ksmaster03/claude-canfly-skill` — `ebd437142225c02570cbf1984df8a24b7d2e0223`
- `Alishahryar1/free-claude-code` — `81fa340ecac5ce1ae8ba4ea60e7a5517224bfaee`

No floating `main` dependency is approved by this document.

## Evaluation criteria

1. clear capability that maps to a current KK pain point;
2. no requirement to replace Machine SOT or live policy authority;
3. can be isolated to development-plane use;
4. installer/update/credential/network blast radius is understood;
5. useful behavior can be expressed as a KK-owned thin contract instead of importing broad overlapping behavior;
6. failure can be contained without production rollback.

## Results

### Sol Advisor

Decision: `STAGE_A_PASS`

Useful for selective route declaration, architecture ownership, bounded delegation and optional fresh review. The KK adaptation keeps Sol Advisor as a development-plane orchestrator only. Its route choice cannot grant production permissions or advance KK evidence gates by itself.

Initial adoption target: architecture/review routing on bounded repository tasks.

Restrictions:

- no Machine-SOT/scheduler/Make/provider/CRM mutation;
- no implicit merge/deploy authority;
- auxiliary model/runtime availability must be proved rather than assumed;
- KK parent verification remains required.

### gstack

Decision: `STAGE_A_PASS_METHODS_ONLY`

High-value methods for KK:

- root-cause-first investigation;
- pre-landing structural review;
- security / skill-supply-chain review;
- browser-based QA;
- retrospective learning;
- release/readiness discipline.

The current upstream also contains broader setup, browser, ship, land/deploy, auto-update and cross-agent behavior. Those are not approved for initial KK use.

Initial adoption target: extract methodology into KK-owned `kk-investigate`, `kk-invariant-review`, `kk-security-review`, `kk-browser-qa`, and `kk-retro` workflows.

Restrictions:

- no team-mode bootstrap into KK production repo;
- no autonomous merge/deploy;
- no broad authenticated production browser mutation;
- no silent auto-update as a production dependency.

### Claude Canfly Skills

Decision: `STAGE_A_PASS_CURATED_SUBSET`

High-value methods for KK:

- SDLC quality gates;
- requirement-to-test traceability;
- observability / SLI / SLO / incident runbook design;
- segregation of duties;
- threat modeling and security-test planning.

The repository intentionally contains a very large skill catalog. Bulk installation would create unnecessary overlap and context pollution for KK.

Initial adoption target: methodology-only extraction into KK-native artifacts.

Restrictions:

- do not import the full skill catalog;
- do not let generic deploy/security skills redefine KK production authority;
- retain only traceable skills with a current KK use case.

### Free Claude Code

Decision: `STAGE_A_PASS_WITH_HARDENED_SANDBOX_REQUIRED`

Potential value: optional local model/provider routing for coding agents and cost/quality experimentation.

Material risks:

- broader local runtime and dependency surface;
- installer can install/verify multiple coding agents and external tools;
- optional global agent/RTK configuration changes;
- proxy authentication and network configuration require explicit hardening;
- provider credentials create a new secret-handling boundary;
- routing through a local proxy creates another failure domain.

Initial adoption target: isolated local benchmark only after the KK guard passes adversarial branch tests.

Restrictions:

- loopback/isolated network only;
- explicit non-default local auth;
- no KK production credentials;
- no global RTK/agent auto-patching;
- minimum client/provider only;
- no production target or provider/customer action.

## Risk matrix

| Tool | Value to KK | Initial blast radius | Main risk | Stage A decision |
|---|---:|---:|---|---|
| Sol Advisor | High | Low/Medium | orchestration role could be mistaken for authority | PASS |
| gstack methods | Very High | Medium if fully installed | deploy/browser/auto-update breadth | METHODS ONLY |
| Canfly curated SDLC | High | Low when copied as methodology | context/skill overlap if bulk imported | CURATED SUBSET |
| Free Claude Code | Medium/High if benchmark wins | High relative to others | secrets/network/provider/runtime complexity | HARDENED SANDBOX ONLY |

## KK controls already implemented before Stage B

- `lib/kk-runtime-acceptance-contract.js`
- `scripts/kk-runtime-acceptance-contract.test.js`
- `lib/kk-third-party-agent-guard.js`
- `scripts/kk-third-party-agent-guard.test.js`
- `KK_AI_ENGINEERING_OPERATING_MODEL_V1.md`
- `KK_RUNNER_RELIABILITY_SPEC_V1.md`
- `KK_ENGINEERING_TRACEABILITY_V1.md`
- `KK_CURATED_AI_SKILLS_V1.md`

Governed CI on the reviewed slice reached `KK-G3 CI_PASS`. Runtime/provider/production gates are not implied.

## Stage B entry criteria

Stage B is a branch-only deterministic change performed through one selected third-party development lane. Before starting:

1. select exactly one low-risk task;
2. define exact owned files;
3. deny production credentials/targets;
4. use `integration/ai-engineering-model-v1` or a child sandbox branch, never `main`;
5. require deterministic regression coverage;
6. inspect complete diff;
7. require governed CI on the resulting head;
8. rollback must be branch deletion/revert only.

## Recommended Stage B sequence

1. Sol Advisor first, because its integration surface is smallest.
2. gstack methods remain reference methodology during the first task rather than a broad install.
3. Canfly remains methodology/reference only.
4. FCC remains deferred until after the branch-only agent guard and review flow have been proved with native Codex/Sol.

## Stage A verdict

`PASS_WITH_RESTRICTIONS`

KK is ready to begin **one controlled Stage B branch-only experiment with Sol Advisor methodology/orchestration**. It is not ready to grant any of the four projects production mutation authority.
