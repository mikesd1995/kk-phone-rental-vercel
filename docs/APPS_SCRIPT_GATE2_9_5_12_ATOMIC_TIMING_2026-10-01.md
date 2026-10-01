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


## Follow-up audit: make physical asset selection window-aware

Post-preview source review found that the first 9_5_12 candidate still called the legacy date-wide `kkValidateManualAsset_` / `kkFindAvailableAsset_` before its new overlapping-window capacity gate. That could reject legitimate same-day non-overlapping reuse, or auto-select an asset that conflicts in the requested window and fail later instead of selecting another free asset.

The candidate now uses reservation-window-aware validation and auto-allocation for API create/update. Asset eligibility still requires the correct type/model and rentable status, but collision exclusion is based on strict reservation-window overlap and self-excludes the update row. The legacy date-wide helpers remain untouched for legacy callers.

This is candidate-only hardening. Production Apps Script writes/deployments remain zero. Exact-head CI and a new exact-head Preview are required again because the prior READY preview predates this correction.


### Prepared/picked_up transition correction

A second source audit found one remaining date-wide path: `kkAssignMissingAssetsForPreparedBooking_` still selected missing physical assets with the legacy whole-day allocator before update-time window validation. It now receives the edited Booking row number and uses the same reservation-window-aware allocator with pickup/return/status and self-exclusion. This closes the transition path where a confirmed Booking becomes prepared or picked_up.

Exact-head CI/Preview acceptance is reset again for this candidate-only correction. Production deployment and business writes remain zero.
