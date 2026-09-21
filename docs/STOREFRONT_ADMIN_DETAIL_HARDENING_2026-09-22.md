# KK Phone Rental — Storefront/Admin Detail Hardening

Date: 2026-09-22
Branch: `audit/storefront-admin-detail-hardening-20260922`
Production mutation: **none**
Apps Script mutation: **none**
Google Sheet business-data writes: **none**
Scanner / Verifier / Canary state: **unchanged**

## Objective

Close the highest-value detail gaps found in the storefront/admin audit without changing rental business rules or performing a production cutover.

## Changes implemented

### 1. Public data exposure reduced

`/api/kk-data` now exposes only the two customer-facing derived feeds used by the storefront:

- `08_Web_Ready`
- `09_Web_Packages`

Removed from the unauthenticated allowlist:

- `03_Packages`
- `04_Event_Overrides`

Why: these internal tables are not required by the browser and exposed template/override pricing details unnecessarily.

Regression coverage explicitly requires both internal tables to return HTTP 400 through the public endpoint.

### 2. Public feed row sanitation

The proxy now parses CSV safely, including quoted fields and embedded newlines, and removes rows missing required identity fields.

Required public event identity:
- `event_id`
- `event_name`

Required public package identity:
- `package_id`
- `event_id`
- `package_type`

If rows are dropped, the response includes `X-KK-Public-Rows-Dropped` for diagnostics.

This specifically blocks price-only blank package rows from leaking into the customer-facing feed while preserving valid package rows.

### 3. Bangkok-locked storefront date logic

Storefront `TODAY_TS`, event-day comparison, and month grouping are now based on `Asia/Bangkok`, not the browser device timezone.

This prevents "today", "soon", past-event filtering, and month grouping from drifting when the customer device uses another timezone.

### 4. Freshness wording corrected

The storefront previously displayed a browser render time under wording equivalent to "Last updated", which could imply the Sheet itself had just been updated.

The label now states:

- TH: `ตรวจสอบข้อมูลเมื่อ`
- EN: `Data checked at`

The displayed clock is explicitly Bangkok time.

### 5. Existing event notes are now used

The public feed already provides `event_note`, but the frontend only attempted to read `web_note`.

The storefront now reads `event_note` first (with `web_note` compatibility fallback) and shows the note inside the package modal when present.

No schema change is required.

### 6. LINE booking context improved

Both booking and waitlist messages now include event venue in addition to event name/date/package details.

This reduces admin ambiguity for same-name or multi-day events.

### 7. Storefront URL state improved

User-driven month and availability-filter changes now update the current URL using `history.replaceState()`.

This makes refreshed/shared storefront views retain their filter state.

### 8. Promotion wording clarified

Thai storefront wording changed from ambiguous `ฟรีมัดจำ` to:

`ฟอล X ร้าน = ไม่ต้องวางมัดจำ + ฟรีประกันเครื่อง`

Business entitlement is unchanged; only wording was corrected.

### 9. Admin entry suggestions added

Admin create/edit forms retain free text entry, but now provide Snapshot-backed datalist suggestions for:

- venue
- phone asset ID
- lens asset ID

Asset suggestions include model/status/rentable context and sort available assets first.

This reduces typographical errors without weakening backend reservation/collision guards.

### 10. Stale cache/version labels cleaned for touched assets

- Storefront script query key updated for this hardening release.
- Admin JS query key updated from historical `resilience-1`.
- Admin HTML title no longer claims Snapshot Resilience 1.

These are cache/debug hygiene changes only.

## Tests added/updated

### `tests/public-data-proxy.test.js`
- internal package table denied
- event override table denied
- blank price-only package row removed
- dropped-row diagnostic header asserted

### `tests/storefront-detail-hardening.test.js`
- Bangkok timezone contract
- honest data-check wording
- venue in booking/waitlist messages
- `event_note` rendering contract
- filter/month URL synchronization

### `tests/admin-detail-entry.test.js`
- venue datalist wiring
- phone/lens asset datalist wiring
- Snapshot-backed suggestion population

## Safety boundaries

This branch intentionally does **not**:

- merge itself into `main`
- deploy Production
- modify Apps Script
- write bookings/events/prices/assets
- change Machine SOT
- enable HF production
- enable Scanner/Verifier/Canary
- change production write permissions
- add `return_time` persistence before backend support is complete

## Deferred follow-up

The following audit findings remain intentionally deferred because they require a larger or separately accepted change:

1. End-to-end `return_time` persistence: Admin → API → Apps Script → Sheet → Snapshot → Guard → readback.
2. Searchable storefront event search.
3. Server-rendered event-specific Open Graph pages for X/social previews.
4. Storefront analytics activation after deciding the analytics provider/configuration.
5. System Guard storefront-integrity checks for orphan packages, missing posters, canonical venue warnings, and effective-price mismatches.
6. Private-reader-only public data cutover after credential/runtime acceptance.
7. CSS consolidation after Admin UX stabilizes.
8. Trace/removal of the runtime `DEP0169 url.parse()` warning.
9. Stronger event-name display linting before save.
10. Full modal focus trap/focus-return accessibility pass.

## Acceptance target

Before merge:

- `npm run check` PASS
- `npm test` PASS
- PR regression workflow PASS
- no production writes
- no production deployment
- review public endpoint behavior in Preview
