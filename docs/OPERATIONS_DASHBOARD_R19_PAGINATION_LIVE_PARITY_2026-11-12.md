# KK Operations Dashboard R19 — Long-tail pagination and actual source parity (12 Nov 2026 ICT)

**HOLD / NOT PRODUCTION.** This source-only update extends Draft PR #867 parent `87599acfdc16997340f239f6dedaba4e96ea87ff`, on its isolated branch. No merge, Production deployment, booking, price, stock, Google Sheet, Owner Lock, X, secret or ACL mutation.

## User-visible engineering defect and resolution
- Canonical `08_Web_Ready` currently includes 471 nonempty event IDs, while `admin/operations-dashboard.js` silently truncated an unfiltered table to 450 and each date's calendar to 12. 21 valid events could not be reached via the unfiltered table.
- New 150-row incremental page control includes an explicit "displayed from total" count, resets on filter/reload and retains access to the 471st event. Calendar has explicit "show more" batches of 12 per date. The Shared button CSS now honors `hidden`.
- Add pure pagination unit regressions, HTML control assertions, and live Chromium **synthetic-only 471-row** table/calendar/filter interaction QA. Existing eight viewport screenshot protocol still tests the original three fictitious rows; no customer fields or Production source in fixtures.

## Canonical Google Sheet readback (read-only, bounded)
Source exact `KK Phone rental backend`, timezone Asia/Bangkok. 471 canonical events, 471 Web Ready, 1,413 Web Package rows, 376 Owner Lock records and 84 Booking-range rows. This audit does not establish actual Production storefront parity.
- 124 SHOW / 14 SHOW_FULL / 333 HIDE. Of SHOW, 122 positive reported phone stock, two zero phones (BTS World Tour, 3 and 5 Dec 2026). Both must be treated not rentable despite the source SHOW state.
- 73 SHOW event IDs lack matching lock evidence; **two** have active Booking rows. Do not interpret missing evidence as a proven booking collision, create locks, or open dates automatically.
- Four SHOW posters are the storewide `kk-brand-hero-final-20260920.png` placeholder in BOTH Core and Web Ready: `EVT-20261225-CSE-POP-CONCERT` source row 363, `EVT-20270123-ALMOND-PROGRESS-FANMEET` row 422, `EVT-20270130-PEBACA-FAM-CONCERT` row 424, `EVT-20270131-PEBACA-FAM-CONCERT` row 427. No guessed posters were published.
- No orphan nonempty Core/Web Ready Event IDs. Bounded Booking A:D contains 0 duplicated nonempty IDs and no unknown nonblank status, but four ancillary rows lack status/Event ID. No customer names/contacts/payments or raw booking IDs were persisted.
- Earlier R17 audit found 52 missing locks; current count is **73**, not evidence of remediation.

## Remaining mandatory gates
1. Verify new exact-HEAD GitHub native full CI, 8-width Chromium, 471-row Chromium pagination QA.
2. Independent reviewer approval (author or AI self-review cannot satisfy).
3. Protected signed Admin positive UAT with approved private reader, Booking/Owner Locks live parity, negative auth/cache and PII-free raw-wire checks. Anonymous `login_required` is not the positive path.
4. Owner examination of 73 missing-lock cases, 4 placeholders, 2 zero-phone SHOW contradictions; X Post Log and actual storefront readback.
5. Explicit owner-governed Production release, tested rollback and exact Production SHA/API/UI readback.

No release hold may be waived by synthetic tests or Preview READY.