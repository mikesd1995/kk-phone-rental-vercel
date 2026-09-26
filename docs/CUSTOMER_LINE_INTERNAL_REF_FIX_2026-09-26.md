# Customer LINE Internal Reference Fix — 2026-09-26

## Incident

Storefront LINE prefill messages exposed deterministic internal attribution identifiers such as:

- `KK-BK-*`
- `KK-WL-*`
- `KK-EV-*`
- `KK-SRCH-*`

The identifiers were not credentials or secrets, but they were internal implementation metadata and produced poor customer-facing UX.

## Root cause

Smart Ops Phase 2 implemented cross-channel attribution by appending `Ref : <internal-id>` directly to customer-visible LINE message text.

This mixed two concerns:

- customer communication;
- internal telemetry / attribution.

## Remediation

The storefront now keeps customer LINE copy free of internal identifiers for all four journeys:

1. booking;
2. waitlist;
3. general event inquiry;
4. search-miss inquiry.

The deterministic `leadRef()` message helper was removed.

Admin Add Booking no longer displays or processes the manual `Lead Ref` field. No Sheet schema migration was required.

## Attribution retained without customer-visible metadata

Existing analytics events remain the internal attribution surface:

- `booking_click` now includes `event_id`, `package_type`, `event_name`, price and source;
- `waitlist_click` includes `event_id`, event name, availability and source;
- contextual sticky LINE event inquiries emit `event_inquiry_click`;
- search-miss inquiry clicks emit `search_inquiry_click`;
- `search_no_result` remains separately debounced/deduplicated.

Analytics remains opt-in and no new paid service, database, external tracking vendor or schema was introduced.

## Safety

This change does not mutate:

- bookings;
- events;
- package prices;
- stock/capacity;
- assets;
- Google Sheets schema;
- Apps Script;
- Supabase;
- Make;
- secrets/environment variables.

## Regression contract

Tests must ensure:

- no customer-visible `Ref :` attribution helper remains;
- no `KK-BK/WL/EV/SRCH` tokens are generated in storefront LINE copy;
- Admin has no `lead_ref` control or `[LEAD_REF:...]` injection path;
- internal analytics click metadata remains wired.

## Cost

Zero-cost. Uses existing repository, CI, Vercel deployment pipeline and optional existing analytics surface only.
