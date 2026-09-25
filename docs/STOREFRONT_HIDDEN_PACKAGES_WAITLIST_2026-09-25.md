# Storefront hidden-packages waitlist behavior — 2026-09-25

## Owner rule

Package visibility and event visibility are separate controls.

- Hiding one or more packages hides only those package choices.
- Hiding **all** packages must **not** remove the event card from the storefront.
- An event with all packages hidden remains visible as **full / waitlist** so customers can join the queue and the storefront still demonstrates event coverage.
- An event is removed from the storefront only when the event itself is not publishable: source event is not `open`, `active_on_web` is not true, or `data_health` is not `OK`.
- Normal past-event filtering remains unchanged.

## Root cause

Two independent guards removed the card:

1. `08_Web_Ready!action_for_web` returned `hide` when no non-hidden phone package remained.
2. `script.js` calculated `hiddenByPackages` and filtered those events out after loading.

This defeated the existing full-event waitlist flow.

## Repair

- Removed the package-count condition from the `08_Web_Ready!J5:J1000` formulas. The formula now uses event health/status/active state for event visibility and returns `show_full` when availability is zero.
- Removed the storefront `hiddenByPackages` event-card filter.
- Kept hidden packages out of the package list. With no visible packages, availability is zero and the existing card behavior routes the customer directly to the LINE waitlist.
- Updated Admin confirmation/help copy to explicitly state that hiding all packages keeps the event card online for waitlist capture.
- Cache-busted `script.js` so browsers receive the corrected storefront logic.
- Added regression coverage for the new invariant.

## Live recovery verification

`ATLAS: RISING UP CONCERT` was the live reproduction case.

After the formula repair:

- event source remains `open`
- `active_on_web = TRUE`
- `data_health = OK`
- all three web packages remain `hidden`
- `available_phone_count = 0`
- `available_lens_count = 0`
- `booking_status_for_web = เต็มแล้ว`
- `action_for_web = show_full`

The package hide state was preserved; only the event-card visibility semantics changed.
