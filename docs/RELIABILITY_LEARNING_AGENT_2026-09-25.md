# KK Reliability Learning Agent — 2026-09-25

## Why this exists

The project already has strong point protections—locks/fencing, exact readback, transaction recovery, no-drop reconciliation, source miss learning, Core promotion debt, and content performance learning. The remaining problem is cross-system recurrence: the same defect classes can reappear on different surfaces and trigger another custom repair.

The Reliability Learning Agent adds a shared failure-memory layer without creating another production runner or expanding business authority.

## Live audit findings that drove the design

- Natural Scanner/Verifier slots have repeatedly shown timer/task metadata without a governed Machine-SOT runtime boundary.
- Tracker→Core lineage debt has contained false "resolved" states caused by identity/row-position mismatch and later had to be reopened using exact identity.
- Make-dependent paths remain vulnerable to external Free-plan credit exhaustion; new bypass transports would only hide the real blocker.
- Apps Script/Admin write health has required multiple hardening rounds around transient upstream health.
- Candidate↔AI no-drop and Tracker↔Core parity have required repeated repair/hardening.
- Production currently reports recurring Node DEP0169 url.parse warnings; ownership is not yet proven, so blind route rewrites are prohibited.
- Repository history has substantial branch/repair sprawl, making a shared incident memory more valuable than another specialized runner.

## Implementation

Added:

- `config/kk-reliability-memory.json`
- `server/kk-reliability-learning-agent.js`
- `scripts/kk-reliability-learning-dry-run.js`
- `tests/kk-reliability-learning.test.js`
- `skills/kk-reliability-learning/SKILL.md`

The existing `scripts/kk-system-audit.js` is extended to call the Reliability Learning Agent only when the supplied snapshot includes reliability observations/incidents.

## Learning model

Each known fingerprint stores:

- severity/domain;
- root-cause confidence;
- matching signals;
- known repair recipe;
- regression guards;
- explicit "never do" actions.

New incidents can generate a proposed memory update only when evidence and at least one regression guard are supplied. The proposal is never auto-applied.

## Seeded recurring fingerprints

- control timer without runtime boundary;
- task unexpectedly OFF;
- runtime timestamp integrity;
- identity/row-position mismatch;
- Candidate↔AI pairing gap;
- Tracker↔Core parity gap;
- Make credits exhausted;
- Apps Script transient health flap;
- stale competitor price;
- provider ACK missing;
- DEP0169 url.parse warning.

## Safety

The agent hard-codes:

- production writes = 0;
- task mutations = 0;
- policy mutations = 0;
- provider sends = 0;
- auto merge = false;
- auto deploy = false;
- human approval required.

This matches the v4.9.43 authority boundary: it improves diagnosis and memory, not Scanner/Verifier business authority.

## What this changes operationally

Before: recurring problem → diagnose again → create another repair → risk another special-case component.

After: recurring problem → fingerprint match → reuse known repair → run known regression guards → only escalate to new architecture when the incident is genuinely novel.

## Follow-up improvements from the full-project audit

1. Trace the DEP0169 warning owner before fixing it.
2. Keep expired/legacy automation tasks disabled and avoid accumulating new one-shot control-plane tasks when an existing closure/audit path can be reused.
3. Establish branch-retention hygiene; the repository currently contains a large historical branch population.
4. Resume Make-dependent production paths only after external credits and exact health/readback acceptance.
5. Continue reducing positional spreadsheet assumptions; stable IDs + exact date/identity must remain mandatory.
6. Once the reliability agent has several real incident samples, consider surfacing its read-only summary inside the existing 07:30 closure rather than adding a new scheduled runner.
