# KK Phone Rental — Engineering Traceability v1

Date: 2026-09-10 Asia/Bangkok
Branch: `integration/ai-engineering-model-v1`
Status: DEVELOPMENT-PLANE CONTROL ARTIFACT

## Purpose

Create one auditable chain from requirement -> policy/authority -> implementation -> deterministic test -> runtime evidence -> provider/E2E evidence -> production stability.

This artifact does not replace live Machine SOT or `_Policy_Registry`. It makes engineering completion claims traceable and prevents `CI_PASS` from being promoted into `RUNTIME_PASS`, `PROVIDER_PASS`, or `PRODUCTION_STABLE` without evidence.

## Evidence ladder

| Gate | Meaning | Minimum evidence |
|---|---|---|
| KK-G0 | Requirement defined | requirement + acceptance criteria |
| KK-G1 | Architecture approved | authority/boundary/ADR or equivalent design evidence |
| KK-G2 | Ready for implementation | owned-file scope + test plan + rollback boundary |
| KK-G3 | CI_PASS | implementation + governed deterministic CI |
| KK-G4 | RUNTIME_PASS | natural runtime evidence + exact readback + terminal closure |
| KK-G5 | PROVIDER_OR_E2E_PASS | external provider ACK or controlled real E2E evidence |
| KK-G6 | PRODUCTION_STABLE | soak/SLO evidence with no material open incident |

## Current traceability matrix

| Capability / Requirement | Authority | Implementation / Contract | Test evidence | Runtime evidence required | Current gate target |
|---|---|---|---|---|---|
| Scanner scheduled natural occurrence | live policy + canonical task + Machine SOT | `lib/kk-runtime-acceptance-contract.js` | `scripts/kk-runtime-acceptance-contract.test.js` | scheduled trigger, unique lease/fence, manifest exact1, work/no-op, terminal, release, task remains ON | G4 then G6 |
| Verifier scheduled natural occurrence | live policy + canonical task + Machine SOT | same runtime acceptance contract | same deterministic suite | same chain plus transaction and Candidate/AI closure | G4 then G6 |
| Candidate <-> AI atomic handoff | live policy / Scanner-Verifier boundary | `lib/kk-discovery-closure-contract.js` | `scripts/kk-discovery-closure-contract.test.js` | READY lineage exactness and terminalization readback | G4 |
| Verifier transaction closure | live policy / `_Write_Transaction` | existing governed contracts + runtime acceptance | governed regression suite | PREPARED=0 and COMMITTING=0 at closure | G4 |
| Monthly/canonical projection consistency | Machine SOT lifecycle truth | existing projection/closure contracts | governed regression suite | canonical <-> monthly exact consistency | G4 |
| Competitor current-market freshness | market evidence policy | `lib/kk-competitor-current-market.js` and related contracts | governed competitor suites | exact-event current evidence with freshness semantics | G4/G5 depending source |
| Owner notification ledger | Notification Ledger authority | owner-notification contract + Make transport | governed notification tests | ledger transition + provider ACK for actual send | G5 |
| Booking exactly-once | CRM/booking authority | booking intake/idempotency contracts | governed booking suites | one controlled real booking + same-request retry without duplicate | G5 |
| Creative source binding | source-authority rules | `lib/kk-creative-binding-guard.js` | governed creative tests | exact authorized bytes/hash and controlled output | G5 |
| X publishing | owner approval + X provider | `lib/kk-x-publish-guard.js` | governed X guard tests | real provider post id / URL | G5 |
| KYC | canonical KYC adapter/provider | `lib/kk-kyc-xama-adapter.js` | governed adapter tests | authorized real provider result | G5 |
| Customer LINE | customer communication authority | provider path | contract evidence where available | authorized provider ACK | G5 |
| Business outcome / learning | POST_EVENT_FINAL truth | outcome projector | governed outcome tests | genuine completed event outcome | G5/G6 |
| Third-party AI tooling isolation | KK development-plane policy | `lib/kk-third-party-agent-guard.js` | `scripts/kk-third-party-agent-guard.test.js` | adversarial sandbox evidence before production-read access | G3 -> staged evaluation |

## Release claim rules

- A passing unit/regression suite is implementation/CI evidence only.
- A scheduled task metadata update is not runtime evidence.
- A manual run cannot prove natural scheduler reliability.
- HTTP/API success is not provider success without the provider's accepted/acknowledged evidence when such evidence is expected.
- Historical receipts cannot prove current recurring reliability.
- `PRODUCTION_STABLE` requires an explicit soak window and no material unresolved P0/P1 incident for the claimed boundary.

## Runtime reliability acceptance

Minimum initial target for Core Scanner + Verifier:

1. six consecutive accepted natural Scanner occurrences;
2. six consecutive accepted natural Verifier occurrences;
3. no manual rescue inside the measured sample;
4. no duplicate/non-monotonic fence;
5. no stale active lease or nonterminal manifest;
6. no PREPARED/COMMITTING leak;
7. no Candidate/AI orphan;
8. task remains enabled after each accepted occurrence.

Preferred production-stability evidence: 24-hour clean soak before calling the Core scheduler boundary stable.

## Third-party tooling progression

Third-party tools advance independently through:

`READ_ONLY -> BRANCH_ONLY -> ADVERSARIAL_ISOLATION_PASS -> PRODUCTION_READ_ONLY -> SELECTIVE_ADOPTION`

They do not receive production mutation authority merely because their code-review or sandbox tasks pass.
