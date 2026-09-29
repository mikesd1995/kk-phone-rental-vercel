# Public Feed Pipe-delimited Internal Text Fix — 2026-09-30

## Detection

The new post-deploy runtime self-audit failed Production with:

`PRODUCTION_RUNTIME_AUDIT_FAILED`

Failed check:

`PACKAGE_FEED_INTERNAL_TEXT_CLEAN`

Production evidence showed internal package annotations still present in `09_Web_Packages`, including pipe-delimited values such as:

`OWNER_APPROVED_RENTAL_FIT_FALLBACK|PROVISIONAL_NEEDS_PRICE_RECHECK|NOVEMBER_V4_20260929`

## Root cause

`looksInternalPublicText()` already detected long ALL_CAPS machine tokens, but its boundary expression did not treat `|` as a valid delimiter. A machine token followed by a pipe therefore failed the boundary test and the full field was allowed through.

## Fix

The machine-token boundary now treats `|` as both a leading and trailing delimiter. Customer-facing sanitization therefore redacts the entire operational annotation field before the CSV leaves `/api/kk-data`.

## Regression coverage

Added a fixture matching the Production failure shape and asserted that:
- redaction count increases;
- `OWNER_APPROVED_RENTAL_FIT_FALLBACK` is absent;
- `PROVISIONAL_NEEDS_PRICE_RECHECK` is absent;
- `NOVEMBER_V4_20260929` is absent;
- the public package identity row remains present.

## Prevention

The post-deploy runtime watcher remains the external acceptance layer and will continue to fail Production acceptance if known operational tokens reappear in the public package feed.

No business data was modified. No Google Sheet rows were edited. The fix is at the public-data sanitization boundary.
