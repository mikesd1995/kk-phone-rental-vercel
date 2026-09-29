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


## Executed audit result

Validated run: GitHub Actions `Storefront Poster Health Audit #3`, run ID `36610533903`.

Summary:
- visible events: **75**
- pass: **74**
- fail: **1**
- recovered by fallback: **2**

### Confirmed failure

`EVT-20261005-KHOM-KHLANG-SPECIAL-EP5` — `KHOM KHLANG Special Episode 5` — 05/10/2026

Canonical Drive ID:
`1Vi_EOlbXPwHUb0EvMX2uWaKV0B4kVmIz`

All three storefront-compatible Drive delivery paths returned HTTP 200 **HTML sign-in pages**, not image bytes:
- Drive thumbnail -> Google Accounts sign-in
- `lh3.googleusercontent.com/d/...` -> Google Accounts sign-in
- `uc?export=view` -> Google Accounts sign-in

This is a source-permission/delivery defect. No verified exact-event emergency poster is currently registered, so the event correctly remains FAIL in the audit instead of silently substituting an unverified image.

### Confirmed fallback recoveries

1. `EVT-20260930-MINMIN-FROZEN-CANDY-LAND`
   - canonical Drive delivery is not publicly image-readable from the runner;
   - verified local poster recovers the event:
     `/assets/event-posters/minmin-teeteepor-frozen-candy-land-2026-09-30.jpg`.

2. `EVT-20261008-CIRCRL-1ST-ANNIVERSARY`
   - canonical Drive delivery is not publicly image-readable from the runner;
   - verified local poster recovers the event:
     `/assets/event-posters/circrl-1st-anniversary-2026-10-08.jpeg`.

PR #327 is therefore materially useful: once that storefront code reaches Production, these verified local assets remain behind canonical SOT and can recover delivery failures without overriding healthy canonical images.

### Nineentertain verification

`EVT-20260930-NINEENTERTAIN-24TH-ANNIVERSARY` passed:
- Sina canonical: HTTP 200 / `image/jpeg`
- verified local fallback: HTTP 200 / `image/jpeg`

The earlier external crawler timeout was not treated as sufficient evidence to replace the canonical SOT.

## Harness corrections during the audit

Two initial runs were rejected as harness failures and were **not** used to mutate storefront data:

1. Run #1: Node fetch configuration produced immediate `TypeError`.
2. Run #2: worker pool passed the numeric index into `probe()` as the optional fetch implementation, also producing immediate `TypeError`.

PR #329 corrected Node fetch compatibility.
PR #330 corrected worker argument binding and retained detailed error messages.

Only the third run, where real network status/content-type/redirect evidence was produced, is considered the valid audit result.

## Remaining action from this audit

Acquire or restore a publicly readable, exact-event poster for `KHOM KHLANG Special Episode 5`, then re-run the audit. Do not substitute a generic series image merely to turn the gate green.

Until then, poster coverage is **74/75 events with a healthy delivery candidate**, with one confirmed source-permission defect.
