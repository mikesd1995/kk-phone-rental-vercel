# V6 production cleanup — 2026-10-02

## Production evidence
V6 asset marker is live and the V5.9 cache marker is absent. FAQ and theme controls are present. The rejected FAR SEAT / CLOSE MEMORY copy remained in HTML because mobile V6 hid the entire hero with CSS; it was not a V5.9 deployment, but stale source content.

## Cleanup
- Removed FAR SEAT / CLOSE MEMORY and obsolete FIELD/optics/proof markup from source.
- Replaced desktop-only hero copy with Thai customer-facing copy while preserving the V6 mobile rule that hides the hero and starts with search/filter/catalogue.
- No booking, event, pricing, inventory, API, or write-path changes.

## Acceptance
Source must contain the V6 cache marker and must not contain FAR SEAT / CLOSE MEMORY. Existing Admin Regression and Storefront Visual QA remain required before merge. Production must be re-read after deployment.
