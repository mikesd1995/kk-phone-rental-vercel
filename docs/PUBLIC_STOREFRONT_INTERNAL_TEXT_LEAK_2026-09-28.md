# Public Storefront Internal-Text Leak Incident — 2026-09-28

## Incident

A customer-facing package modal rendered an internal pricing annotation:

`OWNER_PRICE_ADJUST_2026-09-28_BIG_EVENT_COLLISION`

under public packages for `EVT-20261004-GOOD-BOY-THE-FIRST-RESTART`.

This is a release-blocking storefront defect. Internal operational/audit annotations are not customer copy.

## Verified production scope before the fix

The production public package feed was scanned directly.

- Public package rows inspected: 327
- Suspicious public free-text cells found: 18
- Affected events: 6
- Public event-note feed suspicious cells found: 0

Affected package `web_note` token classes:

- `WEEKDAY_FALLBACK_HIGH_FANDOM_2026-09-28`
- `OWNER_PRICE_ADJUST_2026-09-28_BIG_EVENT_COLLISION`
- `EXACT_EVENT_COMPETITOR_690_2026-09-28`
- `PROVISIONAL_MARKET_BENCHMARK_2026-09-28`
- `PROVISIONAL_BIG_EVENT_COLLISION_2026-09-28`
- `WEEKDAY_FANDOM_TIER_2026-09-28`

Each affected event had the same internal note copied to its three public package rows.

## Root cause

The public derived sheet can contain internal override/operational annotations in the `web_note` column.

The storefront already had a client-side sanitizer, but its internal-text detector was based on a finite list of known phrases. It recognized older classes such as `owner_locked`, `readback`, and `manifest`, but did not recognize new machine-style tokens such as `OWNER_PRICE_ADJUST_...`.

Therefore a new internal token class could bypass the browser guard and render in the package modal.

The public API also returned the raw annotation, so the protection existed only in the browser and was incomplete.

## Fix

### Layer 1 — server public-data boundary

`api/kk-data.js` now sanitizes customer-facing free-text before CSV leaves the unauthenticated endpoint.

Protected fields:

- `08_Web_Ready.event_note`
- `08_Web_Ready.line_message_template`
- `09_Web_Packages.web_note`
- `09_Web_Packages.package_note` compatibility header
- `09_Web_Packages.use_case`

Machine-style ALL_CAPS snake-case annotations with multiple segments fail closed and are returned as blank customer text.

The endpoint reports the number of redacted fields through:

`X-KK-Public-Fields-Redacted`

This preserves the internal source/audit note while preventing exposure to customers.

### Layer 2 — storefront browser defense

`script.js` keeps a second sanitizer with the same machine-token class plus the existing natural-language internal markers.

If an unsafe note somehow reaches the browser, the package modal falls back to the stable public package tagline instead of rendering the annotation.

### Cache refresh

`index.html` changes the storefront script cache key to:

`script.js?v=public-text-leak-guard-20260928`

so clients do not remain on the old browser sanitizer after deployment.

## Regression contract

Tests now prove that all six observed token classes are removed and that legitimate customer copy remains visible.

A separate response-level test verifies:

- the public API strips the unsafe token;
- `X-KK-Public-Fields-Redacted` is emitted;
- package identity/pricing rows remain intact.

Repository engineering policy now states that a public API response containing an internal operational token is release-blocking.

## Permanent rule

Internal operational annotations must never be treated as customer copy.

Do not delete internal audit rationale merely to hide it. Preserve it in internal/admin sources and enforce the customer boundary at the server plus browser layers.

Any future change to public note fields must keep this regression guard passing.
