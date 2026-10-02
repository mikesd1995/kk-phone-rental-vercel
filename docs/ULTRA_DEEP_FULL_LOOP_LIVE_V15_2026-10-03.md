# Ultra Deep Full Loop Live V15 — 2026-10-03

## Goal
One owner command runs the current-month pipeline immediately: exhaustive discovery, candidate verification, exact-event competitor-price scan, fresh production SOT reconciliation, governed create/update, and exact storefront readback.

## Safety and behavior
- Discovery remains zero-write and must be FULL.
- Raw search rows are not publishable. Candidate verifier requires target-month date, event identity, venue, verified poster and rental-fit >= 7.
- Exact competitor scan uses the locked competitor-account set through the free DDGS fallback. Missing exact competitor evidence does not block an otherwise verified event; Final Pricing Policy V3 uses the approved rental-fit/package-template fallback and marks weekend zero-competitor pricing for recheck.
- A fresh authenticated production snapshot supplies existing events, bookings, package templates and visibility tombstones.
- Previously hidden/tombstoned events are not recreated.
- Booking dates are skipped by owner policy.
- Missing verified events use the existing governed Admin create executor only.
- Existing price/poster updates use the existing Admin actions and require exact post-write snapshot readback.
- New creates require exact storefront event/poster/package-price readback.
- The workflow retrieves KK_ADMIN_PIN ephemerally from the existing Vercel production environment using the existing VERCEL_TOKEN. The credential is masked and never uploaded in artifacts.
- No second business writer is introduced.

## Trigger
Owner comment on issue #368:
`/run-ultra-deep-full-loop-live YYYY-MM`

The workflow posts its terminal result automatically and uploads secret-safe evidence.
