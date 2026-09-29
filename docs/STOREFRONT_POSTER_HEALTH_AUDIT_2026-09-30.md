# Storefront Poster Health Audit — 2026-09-30

## Scope

Read-only audit of every currently visible storefront event poster. This work intentionally excludes Scanner, pricing, Private Reader, booking, stock, and business-data changes.

## Baseline

At audit start the Production public event feed contained 75 visible `show/show_full` rows and 62 distinct canonical poster URLs.

Canonical source distribution by distinct URL:
- Google Drive thumbnail: 43
- Pop/Eventpop CDN: 3
- Live Nation dynamic media: 2
- DMP CDN: 2
- Ticketmelon: 2
- Website Files CDN: 1
- M Card Mall: 1
- Sina image CDN: 1
- local storefront asset: 1
- GMMTV: 1
- Cloudways-hosted asset: 1
- ThaiTicketMajor: 1
- Zipevent: 1
- Muzik Move: 1
- T3 storage: 1

## Audit method

`scripts/audit-storefront-posters.js`:
1. reads `08_Web_Ready!A4:K` from the Production public boundary;
2. keeps only `show/show_full` rows;
3. builds the same Drive fallback shapes used by the storefront;
4. includes verified emergency/local fallback where one exists;
5. sends read-only GET probes with an 8-second timeout;
6. requires HTTP success, `image/*` content type, and non-empty response bytes;
7. records which candidate recovered an event;
8. fails closed when a visible event has no healthy poster candidate.

Evidence is uploaded as `storefront-poster-health.json` for 30 days.

The workflow has no schedule. It runs manually, and once when this audit implementation lands on `main`.

## Safety

- Production writes: 0
- Business-data mutations: 0
- Google Sheet writes: 0
- Admin authentication attempts: 0
- No poster URL is changed merely because one runner times out; failures are evidence for follow-up verification, not automatic SOT mutation.

## Existing remediation

PR #327 already preserves canonical SOT precedence while retaining verified emergency posters as delivery fallback. This audit measures the remaining source-health surface rather than changing that precedence.
