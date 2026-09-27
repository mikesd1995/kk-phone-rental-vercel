# Discovery Commercial Preparation V1 — 2026-09-28

## Objective
Restore the commercial-enrichment stage that existed conceptually in the older Ultra Deep workflow without reopening unsafe Scanner-to-Core direct writes.

## Implemented
A new callable gateway task `prepare_event_commercial` invokes `kk-commercial-evidence`.

For each discovered candidate it now fail-closes on:
- missing event title/date/venue;
- fewer than 3 independent exact-event competitor price sources;
- competitor evidence without an HTTPS provenance URL;
- missing verified HTTPS poster evidence.

When the gate passes it calculates the exact-event market median plus observed min/max and selects verified poster evidence, preferring official evidence.

The output is `READY_FOR_FINAL_VERIFIER`; it is never a production mutation.

## Pricing boundary
V1 deliberately computes a market anchor, not an invented KK final selling price. Final KK price requires an explicit business-pricing policy/rule set plus Verifier/owner authority. This prevents an AI median calculation from silently becoming a live price.

## Poster boundary
V1 validates and selects an already discovered poster image URL with provenance. It does not scrape copyrighted media, upload to Drive, or mutate `poster_image_url` by itself.

## Safety
- production_writes = 0
- publishes = 0
- final_price_write_allowed = false
- final Verifier remains mandatory

## Remaining end-to-end gaps
1. live public-web provider binding for recurring autonomous discovery;
2. live competitor evidence collector feeding this worker;
3. live poster discovery/downloader feeding this worker;
4. approved KK pricing-policy worker that converts market evidence into a final package price;
5. governed final Verifier commit worker;
6. exact Core/storefront readback after commit.

This file is the implementation record for the commercial-preparation stage and must not be used to claim that autonomous production publishing is already active.
