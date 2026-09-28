# Lens-only auto guard — 2026-09-28

Production rule: standalone lens rental is hidden by default and becomes visible only when the same event has an active phone_only booking. Active states are pending, confirmed, prepared, and picked_up.

Live acceptance after applying the rule to 09_Web_Packages J5:J1000: 115 lens-only rows, 113 hidden, 2 available. The available rows are BTS World Tour Arirang on 2026-12-03 and 2026-12-05, each at 390 THB with one lens available.

Stale lens-only active_override values were cleared so future phone-only bookings are not blocked by old per-event overrides. Existing price, note, sort-order, use-case, booking, inventory, and event visibility values were not changed.

Production storefront checks: Unlucky Bae Final EP remains visible with the owner-supplied local poster; AIBECK Live in Bangkok 2026 and IDOL EXCHANGE #67 remain hidden.

The current Apps Script lens compatibility repair does not rewrite column J, so this guard survives that repair path.