# Apps Script Gate 2 — 9_5_12 Atomic Booking Timing Candidate — 2026-10-01

## Scope completed in source
Candidate `Code_9_5_12_ATOMIC_BOOKING_TIMING_CANDIDATE_2026-10-01.gs` extends accepted repository candidate 9_5_11 without modifying canonical `apps-script/Code.gs`, recovered 9_5_9 evidence, or reconciled 9_5_10/9_5_11 artifacts.

### Booking timing contract
- `return_time` remains optional.
- A supplied non-empty pickup/return time must parse as a valid clock time; malformed values fail closed.
- Create persists `return_time` to Booking column M.
- Update persists pickup/return together to columns L:M.
- Snapshot exposes `return_time`.
- Missing return uses the existing conservative end of 06:00 on the next Bangkok day.
- `picked_up` without return evidence remains reserved open-ended.
- Return at/before pickup is treated as cross-midnight.

### Atomic collision/capacity contract
Inside the existing `DocumentLock`, before the Booking write:
- construct the proposed reservation window;
- read active Booking holds;
- compare overlapping windows across event dates;
- reject aggregate phone/lens demand above rentable capacity;
- reject an explicitly/automatically selected physical Asset already present in an overlapping reservation window;
- update excludes its own row.

9_5_11 request-id replay behavior remains in the same lock and still precedes allocation/write.

## Safety boundary
- Production Apps Script deployment: 0.
- Booking/Event/price/stock business writes: 0.
- Canonical repository Apps Script source: unchanged.
- Existing recovered/reconciled provenance artifacts: unchanged.

## Remaining external acceptance blocker
GitHub Issue #9 still requires owner-authenticated readback of the bound Apps Script project's Project Settings timezone and installed trigger schedule before controlled production deployment. Connected repository/Drive evidence does not establish that authenticated project state.

Therefore source readiness and runtime activation are deliberately separated:
- SOURCE_GATE: pending exact-head CI for this candidate.
- RUNTIME_GATE: BLOCKED_SAFE / OWNER_GOOGLE_AUTH_REQUIRED until Project Settings + Triggers are read back.
