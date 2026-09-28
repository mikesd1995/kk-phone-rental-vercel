# Storefront missing-poster recovery — 2026-09-28

## Scope
Production audit of `08_Web_Ready!A4:K` through the public Vercel API.

## Audit result
- 109 current/future rows returned by the API.
- 70 rows are public (`show` or `show_full`).
- 3 public rows had a blank `poster_image_url`: BNK48 & CGM48 Fan Festival (04/10), IDOL EXCHANGE #67 (04/10), and AIBECK Live in Bangkok 2026 (04/10).

## Recovery
Added bounded storefront poster overrides keyed by exact event identity and date using exact-event artwork sources. No hidden row was promoted and no booking, inventory, or pricing data was modified.

## Cache
Updated the script cache key so clients fetch the recovery.

## Follow-up
The upstream `poster_image_url` blanks should still be repaired in the source-of-truth sheet. The storefront override is bounded so the three bookable cards do not depend on that repair.
