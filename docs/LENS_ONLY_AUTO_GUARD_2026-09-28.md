# Lens-only auto guard — 2026-09-28

Production rule: standalone lens rental is hidden by default and becomes visible only when the same event has an active phone_only booking. Active states are pending, confirmed, prepared, and picked_up.

Live acceptance after applying the rule to 09_Web_Packages J5:J1000: 115 lens-only rows, 113 hidden, 2 available. The available rows are BTS World Tour Arirang on 2026-12-03 and 2026-12-05, each at 390 THB with one lens available.

Stale lens-only active_override values were cleared so future phone-only bookings are not blocked by old per-event overrides. Existing price, note, sort-order, use-case, booking, inventory, and event visibility values were not changed.

Production storefront checks: Unlucky Bae Final EP remains visible with the owner-supplied local poster; AIBECK Live in Bangkok 2026 and IDOL EXCHANGE #67 remain hidden.

The canonical Apps Script source now owns this rule too. `kkFormulaWebPackageStatus_()` generates the lens-only guard for 09_Web_Packages column J, and `kkRepairLensCompatibilityFormulas_()` rewrites J together with the existing stock formulas. `KK_LENS_COMPAT_PATCH_VERSION` was bumped so a future repair/install uses the guarded formula instead of an older status formula.

## Poster-source audit
Production 08_Web_Ready was parsed as CSV after the lens guard change.
- public rows (show/show_full): 82
- public rows with blank poster_image_url: 0
- source types: 1 local asset, 54 Google Drive thumbnails, 27 external image URLs
- duplicate poster groups: 3, all explainable multi-day/same-campaign artwork (BABYMONSTER 7–8 Nov, GMMTV FANIVAL 12–13 Oct, Moonshadow 14–15 Oct)

This audit confirms poster-source coverage. It does not claim that every remote image host was pixel-validated in this pass; the owner-supplied Unlucky Bae poster is local and production-bound.


## Canonical-code hardening
- Added `kkFormulaWebPackageStatus_(rowNumber)` to `apps-script/Code.gs`.
- The status formula hides `lens_only` unless the same `event_id` has an active `phone_only` booking.
- Active booking states are `pending|confirmed|prepared|picked_up`.
- Explicit `active_override=FALSE` remains a kill switch.
- `kkRepairLensCompatibilityFormulas_()` now restores column J as well as I/M, so a repair cannot silently remove this policy.
- Added regression coverage in `tests/lens-only-auto-guard.test.js`.

The live sheet rule was already active before this repository hardening. This change makes the repository source of truth match production behavior and protects future repair/deployment paths.
