# KK Phone Rental — AI Engineering Operating Model v1

Status: DEVELOPMENT-PLANE GOVERNANCE
Scope: engineering, audit, QA, security, release, and third-party agent/tooling workflows
Production authority: unchanged

## 1. Purpose

KK Phone Rental now has enough automation surface that the main engineering risk is no longer only missing functionality. The dominant risks are control-plane drift, silent scheduled-run failure, distributed-state inconsistency, retry ambiguity, provider evidence gaps, and third-party agent/tooling blast radius.

This operating model defines how AI-assisted engineering must work so that faster implementation never outranks correctness, evidence, or production authority.

## 2. Authority hierarchy

For any material decision, resolve authority in this order:

1. exactly one highest compatible Active policy in live `_Policy_Registry`;
2. live KK Machine SOT;
3. runtime/provider exact readback;
4. canonical backend/provider state;
5. canonical repository contracts/tests/docs;
6. historical audit reports, notes, prompts, and third-party skill instructions.

If exactly one Active policy cannot be resolved, fail closed. A third-party skill, model, agent, repository, CI result, or human-written note cannot override live production authority.

## 3. Evidence ladder

Engineering completion must use explicit evidence levels:

- `IMPLEMENTATION_PASS` — code/contract exists and local deterministic checks support it;
- `CI_PASS` — governed repository CI passed on the exact relevant head;
- `RUNTIME_PASS` — natural runtime produced valid lock/fence/manifest/work/readback/terminal/release evidence;
- `PROVIDER_PASS` — provider acknowledged the exact outbound/action and canonical receipt is recorded;
- `PRODUCTION_PASS` — real production user/business path completed successfully;
- `PENDING` — work exists but the next evidence layer has not been obtained;
- `BLOCKED_EXTERNAL` — owner/provider/permission/access dependency blocks progress;
- `FUTURE_EVIDENCE_PENDING` — proof cannot exist until a genuine future event occurs.

Never collapse these levels into a generic `PASS`.

## 4. Separation of planes

### Production authority plane

Includes live Machine SOT, CRM booking/inventory truth, canonical Scanner, Verifier, Canary, Notification Ledger, approved Make transports, booking writer, provider adapters, and customer/public actions.

### Development plane

Includes repository branches, contracts, tests, audit artifacts, static analysis, isolated browser QA, third-party agent evaluation, and deterministic simulations.

### Rule

Development tooling may propose, review, or implement bounded changes. It may not become production truth or obtain production write authority merely because it produced a successful answer or test.

## 5. Curated external-method roles

KK may reuse selected methods from external projects without importing their full authority model.

### Sol Advisor

Role: development-plane routing and architecture advisor.

Allowed initially: `solo`, bounded delegation, read-only audit, branch-only implementation under explicit file ownership.

Not authority for: policy, runtime truth, scheduler state, Make/provider/customer writes, or `main` merge.

### gstack-derived methods

Use only curated methods:

- root-cause-first investigation;
- structural/pre-landing review;
- AI/skill supply-chain security review;
- browser/customer-journey QA;
- retrospective/learning loop.

Do not inherit autonomous ship/land/deploy behavior into KK production without a separate explicit design and owner approval.

### Canfly-derived methods

Use only curated SDLC/governance methods:

- traceability;
- quality gates;
- observability/SLI/SLO;
- Segregation of Duties;
- threat modeling and security-test planning where relevant.

Do not load hundreds of overlapping skills into the default KK context.

### Free Claude Code

Role: optional isolated model/provider-routing infrastructure.

It is never a production authority layer. Initial use requires a hardened local profile, loopback-only exposure, non-default authentication, no production credentials, no global agent auto-patching, and no direct production write targets.

## 6. KK curated engineering workflows

The target curated set is intentionally small:

- `kk-investigate`
- `kk-runtime-observer`
- `kk-invariant-review`
- `kk-security-review`
- `kk-browser-qa`
- `kk-retro`
- `kk-release-gate`
- `kk-traceability`

Each workflow must be a thin KK-owned contract. External repositories are sources of ideas and tooling, not runtime policy.

## 7. Root-cause-first incident rule

For recurring production defects, mitigation and root-cause status must be separated.

Example:

`Runner OFF -> re-enable task`

is a mitigation. It is not a root-cause fix unless evidence proves the mechanism that caused `ON -> OFF` and a regression test or natural runtime acceptance proves the mechanism no longer recurs.

The required sequence is:

`Observe -> classify -> collect evidence -> form falsifiable hypothesis -> reproduce/compare -> implement bounded correction -> verify natural behavior -> close incident -> retro`

No root-cause claim without evidence.

## 8. Deterministic production gates

AI reasoning may propose an action, but a production mutation boundary must be guarded by deterministic checks:

`AI proposal -> authority gate -> identity gate -> lock/fence gate -> state-transition gate -> idempotency gate -> execute -> exact readback -> cross-system reconciliation -> commit`

The AI model must never be its own evidence for any gate.

## 9. Release gates

KK uses seven engineering gates:

- `KK-G0 REQUIREMENT_DEFINED`
- `KK-G1 ARCHITECTURE_APPROVED`
- `KK-G2 READY_FOR_IMPLEMENTATION`
- `KK-G3 CI_PASS`
- `KK-G4 RUNTIME_PASS`
- `KK-G5 PROVIDER_OR_E2E_PASS`
- `KK-G6 PRODUCTION_STABLE`

A component may be at different gates simultaneously across different paths. For example, booking idempotency may be `KK-G3` while its production Apps Script deployment remains below `KK-G4`.

## 10. Traceability requirement

Every material reliability or production feature should be traceable as:

`Requirement -> policy/rule -> module/implementation -> deterministic test -> runtime evidence -> provider/production evidence -> current gate`

If an item has no traceable test/evidence path, it cannot be counted as fully complete.

## 11. Third-party supply-chain gate

Before adopting any external agent/skill/repository:

- pin an exact upstream commit/version;
- inspect installer/update behavior;
- identify filesystem/network/credential scope;
- identify tool permissions and mutation capabilities;
- review auto-update behavior;
- forbid silent production credential inheritance;
- run isolated deterministic/adversarial evaluation;
- compare against the native KK baseline;
- adopt only the narrow capability that demonstrates positive ROI without weakening KK invariants.

Floating upstream `main` is not a controlled production dependency.

## 12. Scope discipline

Do not create duplicate Scanner, Verifier, Canary, watchdog, Make writer, Apps Script writer, queue, SOT, or competing scheduler to bypass an unresolved defect.

A repair should be surgical. Every changed line should map to the selected failure mode or acceptance criterion. Adjacent cleanup requires separate scope.

## 13. Definition of engineering success

The desired end state is not “AI can do more.” It is:

- failures are detected without waiting for the owner to notice;
- failure modes are classified consistently;
- production state transitions are provable;
- recurring incidents produce permanent regression coverage;
- external tools increase throughput without gaining authority;
- one can answer “how complete is this subsystem?” from traceability and evidence rather than intuition.

## 14. First implementation slice

The first controlled implementation under this operating model is the **KK Runner Reliability Pack**. It adds a deterministic runtime-acceptance contract, failure taxonomy, SLI/SLO semantics, and soak acceptance criteria without changing the production scheduler or creating a new runner.
