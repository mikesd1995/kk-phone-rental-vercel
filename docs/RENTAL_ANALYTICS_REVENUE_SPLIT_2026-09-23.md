# Rental Analytics Revenue Split — 2026-09-23

## Objective

Correct the Rental Analytics revenue presentation so a booking that exists but is not yet completed is not reported as realized revenue.

Owner-approved business definitions:

- **Actual revenue / รายรับจริง** = booking amount for rows with `status=completed` only.
- **Future revenue / รายรับในอนาคต** = booking amount for active workflow states: `pending`, `confirmed`, `prepared`, `picked_up`, `returned`, `uploaded`.
- **Forecast revenue / คาดการณ์รายรับรวม** = Actual revenue + Future revenue.
- `cancelled`, `no_show`, blank/unknown statuses are excluded from all three revenue buckets.
- A booking can belong to only one revenue bucket, so moving Active -> Completed transfers value from Future to Actual without double counting Forecast.

## Root cause

The previous Rental Analytics aggregate summed `amount_received` for every non-cancelled booking:

```text
received += row.amount_received
```

The booking read model pre-populates the booking amount even when the booking is not completed. Therefore the UI label “ยอดรับแล้วตามข้อมูล” could include future booked value and overstate realized revenue.

## Implementation

Updated both analytics execution paths so Core fallback and private CRM produce identical revenue semantics:

- `server/rental-dashboard-core.js`
- `api/kk-rental-dashboard-v5.js`

New API fields:

- `metrics.actual_revenue`
- `metrics.future_revenue`
- `metrics.forecast_revenue`

The same split is also emitted for monthly, event and affiliation aggregates.

For compatibility, legacy `amount_received` remains in the response as an alias of `forecast_revenue`; the Admin UI no longer labels it as realized/received revenue.

Updated presentation:

- `admin/admin.js` now shows three separate KPI cards: รายรับจริง · งานปิดแล้ว, รายรับในอนาคต · Booking, คาดการณ์รายรับรวม.
- Top Event / Affiliation revenue columns are labeled `คาดการณ์รวม` instead of `ยอดรับ`.
- `admin/index.html` explains the three revenue definitions.
- `admin/rental-analytics.js` keeps the legacy standalone view consistent.

## Regression coverage

`tests/dual-sheet-intelligence.test.js` now verifies:

1. completed amount -> Actual only,
2. active booking amount -> Future only,
3. Forecast = Actual + Future,
4. cancelled amount -> excluded,
5. no-show amount -> excluded from revenue,
6. Active -> Completed semantics cannot double count a booking.

## Safety boundary

- Read-only analytics change only.
- No Booking, price, stock, event or customer mutation.
- No Apps Script deployment.
- No Google Sheet schema/data write.
- No secret or environment-variable change.
- No production deployment or merge performed by this change set.

## Baseline

Branch created from exact `main` commit:

`bd42408bbdca1d6514c2ccdc877cb1f63fcf4f7e`

Branch:

`rental-analytics-revenue-split-20260923`
