# KK Phone Rental — Curated AI Skills v1

Date: 2026-09-10 Asia/Bangkok
Branch: `integration/ai-engineering-model-v1`
Status: CURATED / NO THIRD-PARTY RUNTIME INSTALLATION

## Goal

Adopt only high-ROI methods from reviewed external repositories. Do not install hundreds of overlapping skills into the KK operating context. Every adopted method remains subordinate to live KK authority and deterministic gates.

## Curated set

| KK capability | Inspiration | KK adaptation | Initial authority |
|---|---|---|---|
| `kk-investigate` | gstack `/investigate` | root-cause-first incident investigation; no permanent fix without evidence-backed hypothesis | read-only diagnosis; bounded branch changes only after RCA |
| `kk-invariant-review` | gstack `/review` | review state machines, identity, side effects, fencing, transactionality, idempotency and evidence claims | development-plane review |
| `kk-security-review` | gstack `/cso` | secret archaeology, dependency/supply-chain, AI skill trust boundary, CI/CD/provider exposure | read-only audit |
| `kk-browser-qa` | gstack `/qa` | real-browser critical-journey acceptance for booking/admin/customer flows | staging/sandbox first |
| `kk-retro` | gstack `/retro` | convert incidents/misses/manual rescue into durable learning/debt | documentation/learning only |
| `kk-runtime-observer` | Canfly `/observability` | expected-vs-observed runner SLI/SLO, incident taxonomy, runbook and error-budget logic | read-only observation |
| `kk-release-gate` | Canfly SDLC quality gates | G0 requirement -> G6 production stable evidence ladder | deterministic classification |
| `kk-traceability` | Canfly traceability | requirement -> policy -> code -> test -> runtime -> provider -> production | documentation + CI metadata |
| `kk-sod-review` | Canfly SoD | formal role x permission checks for Scanner/Verifier/Canary/Auditor/Owner/provider writers | fail-closed governance |
| `kk-threat-model` | Canfly threat model | STRIDE/abuse cases around agents, provider credentials, booking/customer data | design/review only |

## Orchestration roles

### Sol Advisor

Use as optional development-plane router/architect. It may select a bounded delivery/review mode, but KK rules decide what is writable, what evidence is valid, and whether a result may advance a release gate.

### gstack methods

Use as methodology sources for investigation, structural review, security review, browser QA and retro. Do not enable automatic deploy/merge/production browser mutation as an initial KK capability.

### Canfly methods

Use selected SDLC/observability/SoD/threat-model concepts as KK-native artifacts. Do not import the full skills catalog into routine context.

### Free Claude Code

Treat as optional model-routing infrastructure only after independent hardened sandbox evaluation. It is not required for the KK operating model to function.

## Explicitly excluded from initial adoption

- automated `land-and-deploy` / direct production deploy;
- autonomous merge to `main`;
- broad authenticated production-browser mutation;
- automatic installation of large third-party agent suites;
- global RTK/agent auto-patching;
- third-party direct Scheduler/Make/Machine-SOT/CRM/provider writes;
- self-modifying governance or automatic weakening of failed gates.

## Routing rule

Use the narrowest capability that can solve the observed problem:

`incident -> kk-investigate`

`code/diff -> kk-invariant-review`

`new external tool/skill -> kk-security-review + kk-threat-model`

`runner reliability -> kk-runtime-observer + kk-release-gate`

`customer/admin UI -> kk-browser-qa`

`after incident/release -> kk-retro`

Do not invoke multiple overlapping reviewers merely to increase apparent confidence. Independent review is required only when risk justifies it.

## Definition of success

This curated model succeeds if it lowers repeated incidents, manual rescues, false completion claims, scope drift and time-to-root-cause without creating a competing authority or a second production control plane.
