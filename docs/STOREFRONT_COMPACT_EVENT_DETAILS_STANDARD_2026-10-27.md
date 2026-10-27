# KK Phone Rental — clean event-detail modal standard

**Owner directive:** 2026-10-27. **Scope:** all currently visible storefront events and all future events added manually, by Google Sheets/API sync, Ultra Deep Scan, marketing agent, or an import pipeline. **Reference:** compact BTS World Tour Arrirang sheet versus cluttered ZATO Hariguem Zaboy event sheet.

## Required default customer view

1. Full official event name (no unsafe truncation), event date(s), venue. If the official title is naturally long, allow multiline wrapping without overlaying close control.
2. A compact heading: **เลือกแพ็กเกจ** / **Choose a package**.
3. Only actively sellable packages or the existing sold-out / waitlist flow; show package model, minimal distinguishing inclusion/type, real price and unit, and an unobstructed **จองเลย** / Book now (or inquiry / queue) link.
4. Keep share and close actions. Mobile actions and disclosure summaries must have at least 44px touch height; maintain keyboard/focus, iOS scrolling, TH/EN and dark/light.
5. Do not render generic marketing taglines, redundant model/spec text, auto-generated helper copy, repeated booking instructions, or full event announcements in the default view.

## Secondary but still available information

- For a genuine, sanitized `event_note` / `web_note`, show a compact **ดูรายละเอียดงาน** / Event details native disclosure below venue. Empty notes produce **no disclosure or gap**. Store the complete public value inside the disclosure without arbitrary truncation.
- For a genuine, sanitized public package `use_case` / `web_note`, show **รายละเอียดแพ็กเกจ** / Package details as a collapsed disclosure within that package. If no explicit note exists, do not show fallback marketing slogans as extra lines.
- Source annotations that the existing public-text sanitizers mark internal must never appear either expanded or collapsed. If a legal/safety/restriction notice is mandatory to know before booking, do not bury it invisibly or silently delete it: surface a concise accurate restriction up front and provide complete conditions on expansion or at the booking step.
- One title, date and venue are enough: never duplicate them as free-text prose in the main modal.

## Architecture / implementation owner

- **Only shared renderer:** `showModal(c,options)` in `script.js`. It receives an event object from `08_Web_Ready` and packages from `09_Web_Packages`. This single code path covers all current/new events regardless of event identity. Do **not** create per-event if/else templates.
- **Actual last-loaded visual layer:** `assets/kk-storefront-v5.css` with CSS scoped under `#overlay` so FAQ/cards/admin are untouched.
- **Source fields remain unchanged:** event names, dates, venues, prices, package availability, stock, owner-hidden state, booking IDs, LINE links, canonical Sheet data. Display clean-up must never rewrite business truth.
- When publishing new events, keep any curator-generated announcement and internal pricing/engagement reasoning in the proper source/audit fields rather than the default booking surface. Only add brief, customer-relevant conditions to public note fields. A verbose public note must still display via disclosure without changing source data.
- No new paid API, preview/deploy quota top-ups, or automatic production writes.

## Release acceptance for every future storefront/event change

- Sample **short/empty-note event** (BTS-like) and **verbose-note event** (ZATO-like) and confirm both use identical compact structure. Check switching between them does not retain stale summary/copy.
- Sample phone-only, lens-only (including duplicate text), bundle, two or more packages, inquiry-only, and fully booked events; compare displayed actual price/availability and customer LINE deep-links to the canonical source.
- Verify long TH/EN title and venue line wrapping at 320, 375, 390, 430, 480, 768, 1024 and 1440px, both themes; modal scroll, close, focus restoration and interaction controls.
- Run repository regression `tests/storefront-compact-event-modal.test.js` and dynamic fixture `tests/storefront-compact-event-fixtures.test.js`; repeat deterministic UX review and visual QA. CI success alone is insufficient for aesthetic/owner acceptance.
- The owner-approved release gate and exact-commit production readback remain mandatory. This policy must apply **by default to each newly added event** rather than requiring a separate owner reminder.

## Known rollout status at documentation time

The changes originate in Draft PR #800, branch `fix/compact-event-modal-details-20261027`, starting from main `64cec7bf`. Draft changes are not the same as live production. Final approval, full tests, verified screenshot review, and merge/deploy status must be reported separately.
