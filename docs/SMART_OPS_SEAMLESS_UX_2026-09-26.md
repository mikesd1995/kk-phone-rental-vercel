# Smart Ops + Seamless Storefront UX — 2026-09-26

## Scope

This rollout improves both Admin operations and the public storefront without changing the underlying booking, pricing, stock, or archive business rules.

## Critical incident fixed: cancelling a Booking bounced back to Overview

### Root cause

The Admin bind phase contained:

`$("[data-bulk-event-visibility]", overrideForm).forEach(...)`

`$` is the single-element `querySelector` helper, so the returned button element has no `.forEach()`. The exception happened during `bind()` before later Booking form handlers were registered.

Impact:

- Edit Booking submit could fall through to native form submission.
- The browser reloaded `/admin/app`.
- The default active panel is Overview.
- Operators experienced "cancel -> back to Overview" and repeated retries.

### Repair

- Replaced the broken selector with `qsa(...)`.
- Added hash-backed Admin tab persistence.
- Edit Booking explicitly restores `#edit-booking` after a successful mutation.
- Added regression coverage so native form fallthrough cannot return.

## Admin improvements

### Event Control Center

A new operations table is added to the Package tab with:

- search by event / venue / Event ID;
- filters for needs-action, all-hidden, partial-hidden, visible, event-card hidden, and full/waitlist;
- event-card visibility;
- package visibility with green/yellow/red state;
- queue availability;
- poster readiness;
- direct per-event controls;
- multi-select batch actions.

Batch writes are intentionally limited to 12 events per operation to keep write-lock/readback behavior bounded.

### Progressive operational lists

Previously the UI silently rendered only:

- 60 Action Center rows;
- 50 Events;
- 50 Bookings;
- 120 Pricing rows.

These are now progressive lists with explicit "show more" controls and visible shown/total counts.

### Mobile operations

The Event Control Center and Action Center tables render as labeled cards on small screens, reducing horizontal table scanning.

### Pricing workflow

Quick storefront visibility controls remain always visible, while advanced per-event price/package fields are collapsed under an Advanced Pricing disclosure.

## Storefront improvements

### Consistent card interaction

Every Event card now opens Event Detail first.

- Available event -> package choices.
- Full event -> full/waitlist detail with LINE waitlist CTA.

A full card no longer sends the customer to LINE immediately from a generic card tap.

### Waitlist semantics

A full/waitlist card now displays:

`คิวเต็ม · เปิดรับจองคิวหลุด`

instead of showing a stale/unavailable package price or generic "ask for price".

### Progressive browsing

The storefront initially renders 24 matching events and exposes "Show more".

Search/filtering still runs against the full loaded dataset.

### Search miss -> lead capture

If a customer searches for an event that is not listed, the LINE CTA is prefilled with the missing search term instead of opening a generic chat.

### Event sharing + contextual LINE

Event Detail includes a native Share action with clipboard fallback.

The mobile sticky LINE CTA becomes event-aware while a detail modal is open.

### Client error signal

Storefront runtime errors emit the existing GA event channel as `client_error` when GA is configured.

## Public feed optimization

`/api/kk-data` now removes parseable past-event rows by default:

- `08_Web_Ready`: uses event_date_text first, then Event ID date fallback.
- `09_Web_Packages`: uses the date encoded in canonical Event IDs.

Rows with an unparseable date are kept fail-open.

`showPast=1` bypasses the optimization for debug/history views.

The Sheet itself is not changed; historical data remains intact.

## Safety

This rollout does not mutate:

- existing Booking values;
- existing Event/Package visibility as part of deployment;
- prices;
- stock;
- assets;
- archive rows;
- Apps Script;
- Sheet schema;
- secrets/environment variables.

Only explicit operator actions continue to write business data.
