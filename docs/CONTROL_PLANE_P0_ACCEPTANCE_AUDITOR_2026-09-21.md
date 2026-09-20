# Control Plane P0 Acceptance Auditor — 2026-09-21

## Status

**REPOSITORY-ONLY HARDENING / ZERO TASK MUTATION / ZERO PRODUCTION WRITE**

This change tightens acceptance evidence for Issues #14, #47 and #50. It does not claim the platform-side task-off root cause is fixed and it does not award natural-run credit without exact evidence.

## Why this was added

The repository already had two useful #50 contracts:

- bounded Verifier Manifest append/readback evaluation;
- deterministic Scanner due-work denominator resolution.

However, the generic natural-occurrence analyzer could still classify a clean terminal run as an acceptance candidate without proving all of the persistence requirements tracked by #14/#47/#50 together.

The new auditor closes that evidence gap.

## New acceptance requirements

A counted Scanner or Verifier occurrence must now prove all of the following:

1. `origin = NATURAL_SCHEDULED`.
2. `manual != true` and `backfilled != true`.
3. Asia/Bangkok scheduled boundary is exact:
   - Scanner: `:00`;
   - Verifier: `:30`.
4. Current canonical task snapshot is present.
5. Before/current/after task identity contains and exactly matches:
   - Task ID;
   - Title;
   - Cadence;
   - Timezone;
   - Prompt fingerprint. If a live task snapshot supplies only raw `prompt`, the auditor derives SHA-256 internally; raw prompt text is not emitted in the audit result.
6. Before/current/after enabled state is explicit boolean `true`.
7. Existing Machine-SOT runtime acceptance still passes:
   - exact CORE + role boundary;
   - exact terminal Manifest;
   - owned locks RELEASED;
   - no unresolved PREPARED/COMMITTING transaction;
   - task still ON after runtime.
8. Verifier additionally proves bounded immutable Manifest readback and final Manifest identity equality.
9. Scanner additionally proves deterministic four-bucket due-work evidence and exact Planner readback equality.
10. Six consecutive latest hourly slots are required for each role by default.
11. Missing slots, duplicate slots, identity drift, manual/backfilled evidence, or role-specific evidence gaps receive zero persistence credit.

## Explicit non-claims

A repository PASS does **not** mean:

- TASK_OFF_RECURRENCE root cause is fixed;
- Scanner/Verifier production tasks should be re-enabled;
- a watchdog/replacement task is authorized;
- HF production activation is authorized;
- Production Stable is authorized.

The report intentionally returns:

- `production_stable_authorized=false`
- `hf_production_activation_authorized=false`

A later controlled review must combine a passing six-run natural snapshot with current Machine SOT and task-registry evidence before any production decision.

## Files

- `server/control-plane-persistence.js`
- `tests/control-plane-persistence.test.js`
- `scripts/audit-control-plane-persistence.js`

## CLI

```bash
npm run audit:control-plane -- path/to/snapshot.json
```

Optional streak length override for bounded diagnostics only:

```bash
node scripts/audit-control-plane-persistence.js path/to/snapshot.json --required=6
```

Production acceptance policy remains six consecutive natural occurrences per role unless a later authoritative policy explicitly changes it.

## Safety

This change performs:

- production writes: `0`
- task mutations: `0`
- schedule mutations: `0`
- Machine SOT mutations: `0`
- Apps Script deploys: `0`
- HF activation: `0`
- provider/customer sends: `0`


## Live task-registry compatibility

The ChatGPT task registry exposes raw `prompt` text rather than a precomputed prompt fingerprint. The auditor therefore accepts either:

- `prompt_fingerprint` / compatible explicit fingerprint field; or
- raw `prompt`, from which SHA-256 is derived internally.

This keeps exact prompt-identity checking usable against live registry snapshots without requiring callers to precompute a fingerprint and without returning the raw prompt in audit output. A changed raw prompt produces a different fingerprint and fails `TASK_IDENTITY_DRIFT`.
