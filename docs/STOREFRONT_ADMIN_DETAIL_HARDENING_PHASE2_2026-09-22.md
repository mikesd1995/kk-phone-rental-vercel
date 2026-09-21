# KK Phone Rental — Storefront/Admin Detail Hardening Phase 2

Date: 2026-09-22
Parent hardening branch: `audit/storefront-admin-detail-hardening-20260922`
Phase 2 branch: `audit/storefront-admin-detail-hardening-phase2-20260922`

## Safety boundary

This phase is intentionally limited to customer/admin UX quality, read-only diagnostics, and pre-write warnings.

It does **not**:
- merge to `main`
- deploy Production
- mutate Apps Script
- write Google Sheet business data
- change reservation/collision rules
- enable Scanner / Verifier / Canary
- change Machine SOT
- enable HF production
- implement partial `return_time` support

## Implemented

### 1. Customer storefront event search

Added a dedicated search field above month/status filters.

Searches across:
- event name
- venue
- displayed date
- event note

The query is normalized with NFKC + locale-aware lower casing and whitespace cleanup.

The active query is persisted in URL parameter `q` alongside `month` and `filter`, so refresh/share preserves the browsing state.

Search result count is announced through an `aria-live` status region.

### 2. Browse state preservation across event modal URLs

Previous modal URL handling rebuilt the URL from the home URL and could discard active month/filter/search state.

Event modal open/close now modifies only:
- `event`
- legacy `e`
- `lang`

Existing `q`, `month`, and `filter` remain intact.

### 3. Dialog focus management and keyboard containment

Package and FAQ dialogs now:
- remember the element that opened the dialog
- focus the close button after opening
- trap Tab/Shift+Tab inside the active dialog
- return focus to the opener after close
- restore focus when browser history closes an event modal

Escape behavior remains supported.

### 4. Storefront Integrity diagnostics in Snapshot/System Guard

Added `storefrontIntegritySignals()` to snapshot health.

Read-only signals:
- invalid web-package identity
- orphan web packages
- negative availability rows
- published events missing poster
- published past events
- orphan Web Ready events
- venue naming variants

These signals are **warnings only**. They do not convert a structurally valid snapshot into a transport failure.

System Guard now displays dedicated rows:
- Storefront · Package identity
- Storefront · Event/package mapping
- Storefront · Availability
- Storefront · Published event quality
- Storefront · Venue canonicalization

### 5. Event-name quality lint before create/update

Admin now checks event display names for:
- repeated whitespace
- unmatched curly double quotes
- odd straight double quotes
- unmatched (), [], {}
- names longer than 140 characters
- separator punctuation at the beginning/end

The lint is advisory:
- OK = continue saving
- Cancel = return to edit

It intentionally does not treat apostrophes as quote pairs, so names such as `DON'T BE TOO EMOTIONAL` are not falsely flagged.

Backend duplicate/date integrity guards remain authoritative.

## Tests added

### `tests/snapshot-health-storefront-integrity.test.js`
Covers:
- malformed package identity
- orphan package mapping
- negative availability
- missing poster
- published past event
- orphan Web Ready row
- venue naming variants
- clean storefront integrity

### `tests/detail-hardening-phase2.test.js`
Covers:
- storefront search wiring
- query persistence
- modal URL state preservation
- focus management contract
- event-name lint behavior
- create/update lint acknowledgement
- System Guard storefront rows

## Deferred after Phase 2 acceptance

1. End-to-end `return_time` persistence.
2. Private-reader-only cutover after production reader acceptance.
3. Server-rendered event-specific Open Graph response for X/social crawlers.
4. Analytics activation after measurement/config decision.
5. CSS consolidation.
6. DEP0169 `url.parse()` runtime warning root-cause cleanup.
7. Stronger write receipt/readback UX after mutation.
