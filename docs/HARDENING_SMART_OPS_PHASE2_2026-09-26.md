# Hardening + Smart Ops Phase 2 — 2026-09-26

## Objective

Close the remaining storefront/Admin UX, resilience, observability and governance gaps found after the Smart Ops rollout, without mutating live customer business data merely for testing.

## Admin hardening

### Web Storage bootstrap safety

Admin no longer reads or writes the compact-mode preference through unguarded localStorage calls.

Added:
- safeLocalGet
- safeLocalSet
- safeLocalRemove

This closes the same browser-privacy failure class that previously caused the signed-session Admin blank-page incident through unguarded Web Storage access.

### Operational attention on Overview

The Overview now surfaces actionable CHECK/WARN/FAIL rows already present in the Admin snapshot health data.

It intentionally does not change the underlying health truth. Current Sheet CHECK items such as Booking Risk, timezone verification, atomic timing readiness and accessory capacity remain evidence, not auto-fixed values.

### Searchable Event selectors

Select-backed Event forms keep their existing payload and validation semantics, but large Event lists now get an inline search field. Search is activated for lists with at least 25 Events and filters by the exact rendered Event label.

### Event Control state synchronization and batch preflight

- Select-all checkbox now maintains checked/indeterminate state from the actual selected Event IDs.
- Batch actions skip Events already in the requested state.
- The 12-Event safety bound applies only to rows that actually require a write.
- Confirmation shows the number of actual writes and redundant rows skipped.

### Undo

A 20-second one-step Undo is provided only where reversal is exact:
- Event-card visibility changes can be reversed exactly through active_on_web.

Package bulk visibility does not receive a generic Undo because an inverse hide/show cannot always reconstruct prior mixed/inherited override state exactly.

### Client incident IDs

Admin browser errors and unhandled promise failures receive a visible ADM-* incident ID so an operator can report a concrete failure instead of only “the page broke”.

## Lead attribution without Sheet schema mutation

Storefront LINE messages now carry deterministic reference tokens:
- KK-BK-* for direct booking intent
- KK-WL-* for waitlist intent
- KK-EV-* for general Event inquiry
- KK-SRCH-* for search-miss demand

Admin Add Booking now accepts Lead Ref. The value is sanitized and appended to the existing Booking note as [LEAD_REF:...].

No new Sheet column is introduced in this phase.

This enables manual end-to-end attribution from storefront/LINE to a created Booking while preserving the current backend schema.

## Search-demand measurement discipline

search_no_result analytics now:
- wait 700 ms after the last render;
- ignore queries shorter than 3 normalized characters;
- de-duplicate the same normalized query for 30 seconds;
- verify that the current search still matches before emitting.

This prevents B -> BT -> BTS typing from being counted as three independent demand misses.

GA4 remains intentionally disabled because no real Measurement ID exists in repository/config evidence. No placeholder ID was activated.

## Social sharing / SEO

### Server-rendered Event share metadata

Added /event/:eventId -> /api/kk-event-share?event=:eventId.

The server reads the existing public Event feed and renders Event-specific:
- title
- description
- canonical target
- Open Graph title/description/url/image
- Twitter card metadata

The page uses a zero-delay metadata refresh to the normal storefront deep link so the customer continues into the existing ?event= Event Detail flow.

### Structured data

Homepage now includes JSON-LD for:
- Organization
- Service

No fabricated rating, address or unsupported Event schema is emitted.

## Runtime warning diagnosis

No direct url.parse call exists in repository source, while Vercel still reports Node DEP0169.

Added a scoped warning tracer to:
- kk-data
- kk-admin-snapshot-v6

It logs only warning code/name, endpoint surface and a bounded stack trace when DEP0169 is emitted after application code has installed the listener. It does not log request bodies, credentials, customer data or secrets.

If production continues to emit DEP0169 without KK_DEP0169_TRACE, the warning is likely emitted before the application handler installs its listener or by the platform wrapper; that result is itself useful ownership evidence.

## CI / exact main

The existing Admin Regression workflow was re-audited and already contains both:
- pull_request -> main
- push -> main

and runs npm run check + npm test.

The earlier absence of a main run in the connector view was a tooling visibility limitation: that connector lists pull-request-triggered runs only. The workflow itself did not need a duplicate gate.

Regression coverage is extended to preserve:
- Admin safe storage behavior
- actionable health strip
- searchable Event selectors
- batch selection/deduping
- exact-safe Undo policy
- lead attribution
- search-miss debounce/dedupe
- server-side share metadata
- structured data
- DEP0169 tracer wiring
- main push regression workflow contract

## Production safety boundary

This phase does not automatically mutate:
- Booking status
- Event visibility
- Package visibility
- prices
- stock
- Assets
- Archive rows
- Sheet timezone
- Apps Script project settings/triggers
- secrets or environment variables

Runtime write actions still require an explicit Admin operator action.

GA4 activation remains pending a real owner-supplied Measurement ID.
Timezone/trigger readiness remains CHECK until authenticated Apps Script Project Settings and installed Trigger evidence is available.
