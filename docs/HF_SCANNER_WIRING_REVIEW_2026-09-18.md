# HF Scanner Wiring Review V1 — 2026-09-18

Branch: `hf-event-assist-v1-20260918`
PR: #44
Tracking issue: #46

## Objective

Stage the minimum safe Scanner→Hugging Face integration contract after HF Event Assist V1.8 passed bounded live UAT, while preserving the current Machine SOT authority model and performing zero production wiring.

This review is intentionally fail-closed and zero-production-write.

## Live authority re-check

Machine SOT highest Active policy was re-read from `_Policy_Registry` and remains:

```text
v4.9.15 AUTONOMOUS CLOSURE & OWNER NOTIFICATION HARDENING
```

Relevant inherited/current controls remain active, including:
- shared writer serialization;
- strict fencing / immutable runtime identity;
- Manifest and transaction schema contracts;
- post-acquire writer recheck;
- no competing runner/watchdog architecture;
- task-state attribution / own-runtime-disable forensic gates.

No policy row was created or modified by this review.

## Production runtime location finding

Repository inspection confirms the canonical production Discovery Scanner runtime is not implemented as a normal repo API/server entrypoint.

The live Scanner is the existing ChatGPT task `KK Discovery Scanner — Current Policy`, whose prompt reads Machine SOT at runtime and owns current discovery / Candidate↔AI handoff duties.

Therefore this review does not pretend that adding a Node module equals production Scanner deployment.

The repository work is a staging/executable contract only.

## Read-only task-registry finding

A read-only task-registry check on 2026-09-18 observed:

```text
KK Discovery Scanner — Current Policy = OFF
KK GPT Verifier — Current Policy = OFF
KK Canary Safety — Enabled Suite = OFF
```

No task was enabled, disabled, edited, rescheduled, recreated, cloned, or otherwise mutated during this review.

The Scanner/Verifier OFF state is a separate control-plane persistence blocker. It must not be silently repaired as part of HF feature rollout.

## Files added

### `server/hf-scanner-wiring-contract.js`

Pure zero-write gate contract.

It requires all of the following before one advisory HF external call may be attempted:

1. `HF_EVENT_ASSIST_ENABLED=true`;
2. nonblank Scanner Run ID and Candidate identity;
3. exactly one Active policy;
4. zero pre-acquire conflicting writers;
5. exactly one held `CORE_SHARED_WRITER / CORE` lock for the run with a fencing token;
6. exactly one held Scanner role lock for the same run with a fencing token;
7. explicit post-acquire writer recheck;
8. zero post-acquire conflicting writers;
9. exactly one Scanner Manifest for the run;
10. Manifest has `Frozen At`;
11. Manifest policy version equals current Active policy;
12. Manifest fencing token matches the Scanner role lock;
13. exactly one Planner item for the run;
14. exactly one authorized Planner item.

Any missing, duplicate, ambiguous or conflicting prerequisite produces:

```text
external_hf_access_allowed = false
hf_call_count = 0
production_writes = 0
final_truth_mutation = false
notification_sends = 0
```

### Advisory result authority contract

Accepted HF results must have:

```text
status = ASSISTED
authoritative = false
verifier_required = true
production_writes = 0
```

Allowed assist tasks are only:

```text
ZERO_SHOT_EVENT_CLASSIFICATION
EVENT_EMBEDDING
EVENT_DEDUP_ASSIST
```

The contract rejects HF output that attempts to carry final-authority fields such as:
- final decision;
- verified / approved final truth;
- monthly write;
- pricing write;
- booking write;
- inventory write;
- notification send.

Provider failures produce no fabricated handoff or business decision.

Provider exception message text is deliberately not surfaced by the Scanner wiring contract; only a bounded error class is retained.

### `server/hf-scanner-adapter.js`

Composes the actual existing HF classifier with the Scanner gate:

```text
Scanner evidence snapshot
→ wiring preflight
→ only if authorized: HF.classifyEventCandidate()
→ advisory payload
→ READY_FOR_VERIFIER handoff contract
```

The adapter does not write to Sheets, Candidate Queue, AI Inbox, monthly tabs, pricing, booking, inventory, lifecycle or Notification Ledger.

It is not imported by any production API/admin entrypoint.

### Handoff shape

Successful staging produces a nonauthoritative payload:

```text
handoff_state = READY_FOR_VERIFIER
route = EXISTING_SCANNER_TO_VERIFIER_HANDOFF
authoritative = false
verifier_required = true
production_writes = 0
final_truth_mutation = false
notification_sends = 0
direct_business_write_allowed = false
direct_notification_allowed = false
```

Embedding vectors are not copied into the handoff payload; only bounded summary metadata is retained.

## Regression tests added

Files:
- `tests/hf-scanner-wiring-contract.test.js`
- `tests/hf-scanner-adapter.test.js`

Coverage includes:
- HF disabled by default → zero network calls;
- duplicate Active policy → zero calls;
- pre-acquire writer conflict → zero calls;
- missing CORE shared writer → zero calls;
- missing Scanner role lock → zero calls;
- missing post-acquire recheck → zero calls;
- new writer appearing after acquisition → zero calls;
- Manifest not frozen → zero calls;
- Manifest policy mismatch → zero calls;
- Manifest fencing mismatch → zero calls;
- Planner zero items → zero calls;
- Planner duplicate items → zero calls;
- missing Candidate identity → zero calls;
- successful exact gate → exactly one advisory HF call;
- authoritative HF result rejected;
- nonzero HF production writes rejected;
- forbidden final-authority field rejected;
- provider failure produces no handoff / no fabricated decision;
- embedding output is summarized without vectors;
- dedup output preserves identity-conflict / Verifier semantics;
- direct business-write surfaces are absent;
- production entrypoints are forbidden from importing the staged adapter.

The final test is an executable rollout boundary: CI will fail if the staged adapter becomes wired into current production API/admin entrypoints before a later controlled acceptance explicitly changes that contract.

## CI evidence

Current staging head during review:

```text
7a6cd7ccd82ceda5c00a986cfbd46eff2ba32438
```

Admin Regression run:

```text
#191
SUCCESS
tests = 187
pass = 187
fail = 0
```

HF benchmark harness safety check: PASS.
HF live-UAT readiness contract: PASS.
Production-import isolation guard: PASS.

## Vercel preview evidence

Preview deployment for head `7a6cd7c...`:

```text
state = READY
target = null / preview
```

No production promotion was performed.

## What materially improved

Before this review:
- HF quality was proven, but Scanner integration gates existed only in policy / issue text;
- there was no executable contract proving that a writer race or missing Planner/Manifest would prevent an HF call;
- there was no repository-level barrier preventing premature production import.

After this review:
- gate order is executable and regression-tested;
- TOCTOU writer recheck is explicitly required;
- Manifest policy/fencing consistency is enforced;
- Planner exact1 authorization is enforced;
- HF authority escalation is rejected;
- provider failure cannot fabricate a Scanner decision;
- production entrypoint import is explicitly blocked by CI;
- adapter is staged and composable without mutating live runtime.

## What was intentionally NOT changed

```text
Machine SOT business writes = 0
Policy mutations = 0
Scanner task mutations = 0
Verifier task mutations = 0
Canary task mutations = 0
Candidate/AI writes = 0
Monthly/pricing writes = 0
Booking/inventory writes = 0
Notification Ledger writes = 0
LINE/Telegram sends = 0
New runner/scheduler/queue/watchdog = 0
Production Vercel promotion = 0
HF production activation = 0
```

## Current status

```text
HF live quality gate = PASS
Scanner HF staging contract = PASS
Scanner HF production import = BLOCKED BY CONTRACT
Production HF activation = OFF
Canonical Scanner task = OFF (read-only observation)
Canonical Verifier task = OFF (read-only observation)
```

## Next controlled gate

Production integration is not authorized yet.

Before changing the live Scanner task/prompt or enabling recurring HF access:

1. resolve the existing Scanner/Verifier task-persistence/control-plane blocker under current v4.9.15 governance;
2. prove canonical tasks remain ON across a natural runtime boundary without an unattributed disable;
3. re-read highest Active policy immediately before any feature integration;
4. perform exact no-writer / CORE / role-lock / post-acquire recheck;
5. preserve current Manifest / Planner / fencing contracts;
6. only then consider replacing the production-import isolation test with an explicitly accepted production adapter integration;
7. keep HF advisory and Verifier final authority;
8. retain immediate rollback `HF_EVENT_ASSIST_ENABLED=false`.

Passing this staging review is not production approval.
