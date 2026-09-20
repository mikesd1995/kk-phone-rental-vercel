# Booking Time Optional Safe-Fallback Policy — 2026-09-21

## Final operational policy

KK Phone Rental customers may book before pickup time is known, and event end times vary.

- `pickup_time`: optional / TBD.
- `return_time`: optional.
- If pickup is unknown, the reservation window starts at 00:00 on the event day.
- If return is unknown, the reservation window ends at 06:00 on the following day.
- If a booking is already `picked_up` and there is no return evidence, the asset remains reserved open-ended until workflow state changes.
- A non-empty malformed pickup time is rejected.
- Missing optional times are informational and must not be fabricated to satisfy health checks.

## Production implementation

Policy identifier:
`booking-timing-optional-safe-fallback-2`

Admin UI:
- pickup input remains `type="time"`;
- `required` is removed;
- UI explains that TBD is allowed and the conservative fallback applies.

Vercel guard:
- blank pickup passes timing validation with mode `fallback-day-start`;
- explicit valid pickup uses `explicit-pickup`;
- invalid non-empty pickup returns `BOOKING_PICKUP_TIME_INVALID`;
- collision/capacity guard still runs on the calculated conservative window.

Snapshot health:
- missing pickup/return counts stay visible;
- policies are reported as `OPTIONAL_TBD` / `OPTIONAL`;
- missing times do not create health warnings.

## Safety

This policy change does not:
- invent or backfill historical times;
- weaken asset collision/capacity checks;
- change booking/customer/pricing data;
- change Apps Script source/deployment or secrets;
- change Scanner/Verifier/Canary/Make/Machine SOT.

Timezone remains a separate CHECK until Apps Script project timezone and historical timestamp rendering can be verified together with the spreadsheet timezone.
