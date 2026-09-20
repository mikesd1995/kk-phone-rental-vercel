# Booking Time Optional Safe-Fallback Policy — 2026-09-21

## Final operational policy

KK Phone Rental customers may book before pickup time is known, and event end times vary.

- `pickup_time`: optional / TBD.
- `return_time`: optional.
- If pickup is unknown, reservation starts at 00:00 on the event day.
- If return is unknown, reservation ends at 06:00 on the following day.
- If status is `picked_up` and there is no return evidence, the asset remains reserved open-ended until workflow state changes.
- A non-empty malformed pickup time is rejected.
- Missing optional times are informational and must not be fabricated to satisfy health checks.

## Production implementation

Policy identifier:
`booking-timing-optional-safe-fallback-2`

Admin UI:
- pickup input remains `type="time"`;
- `required` is removed;
- UI explicitly says TBD is allowed.

Vercel guard:
- blank pickup passes timing validation with mode `fallback-day-start`;
- explicit valid pickup uses `explicit-pickup`;
- invalid non-empty pickup returns `BOOKING_PICKUP_TIME_INVALID`;
- collision/capacity checks still run over the conservative window.

Snapshot health:
- missing pickup/return counts remain visible;
- pickup policy reports `OPTIONAL_TBD`;
- return policy reports `OPTIONAL`;
- missing optional times do not create snapshot warnings.

Google Sheet Health Check:
- missing pickup/return rows are `INFO`, not `CHECK`;
- reservation timing readiness no longer depends on both times being filled;
- timezone remains the only timing-readiness CHECK.

## Safety

This policy change does not:
- invent or backfill historical times;
- weaken asset collision/capacity checks;
- change booking/customer/pricing data;
- change Apps Script source/deployment or secrets;
- change Scanner/Verifier/Canary/Make/Machine SOT.

Timezone remains a separate CHECK until Apps Script project timezone and historical timestamp rendering are verified together with Spreadsheet timezone.
