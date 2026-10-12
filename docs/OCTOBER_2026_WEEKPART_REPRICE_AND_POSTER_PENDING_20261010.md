# KK Phone Rental — October 2026 owner fallback pricing correction and eight poster-pending event publishes

**Action at 2026-10-10 ~03:14–04:00 Asia/Bangkok.** This handoff records **real Google Sheets business writes** requested by the owner. Not to be confused with Draft PR #680 code-only changes or successful autonomous monthly Full Loop.

## Owner's locked pricing rule (supersedes previous 690/890 weekday mistake)

**ONLY when an exact-event comparable independent rental median is NOT verified and the date/event has no active booking or owner-specific higher confirmed price:**
- **Monday, Tuesday, Wednesday, Thursday**: X300 Pro phone-only **490 THB**; phone + ZEISS Lens **590 THB**.
- **Friday, Saturday, Sunday**: phone-only **690 THB**; phone + ZEISS Lens **890 THB**.
- Lens-only stays hidden unless governed booking exception permits it; no auto-post.
- If exact comparable median is credibly verified, evaluate that price per owner's market pricing rule; NEVER mislabel these fallback prices as competitor median.
- Any active booking on an event date blocks OTHER events on the whole date regardless of spare phones. Never change booked-event prices; preserve owner-hidden/tombstones and special owner overrides.

## Live canonical Sheet changes

Backend spreadsheet ID `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`. Existing Google Sheet tabs `01_Events` sheet ID `416044968`, `04_Event_Overrides` sheet ID `212840761`, derived `08_Web_Ready` ID `1887878700` and `09_Web_Packages` ID `1412319287`.

### Existing seven events — corrected five weekday prices

In `04_Event_Overrides`, only the price cells and price-origin note (C:E, retaining D=TRUE) on existing exact event rows were changed:
- Rows 902–903, `EVT-20261014-VVV-TORNADO-BUSKING-CENTRALWORLD`, Wednesday: **690/890 → 490/590**.
- Rows 905–906, `EVT-20261015-MAYA-TV-AWARDS-2026`, Thursday: **690/890 → 490/590**.
- Rows 908–909, `EVT-20261021-HER-HYNESS-LINGLING-KWONG`, Wednesday: **690/890 → 490/590**.
- Rows 911–912, `EVT-20261029-MINDY-SHOOT-YOUR-SHOT-FANSIGN`, Thursday: **690/890 → 490/590**.
- Rows 920–921, `EVT-20261015-IN2IT-EVEANDBOY-TLE-FIRSTONE`, Thursday: **690/890 → 490/590**.
- Oct17 `EVT-20261017-VIRAL-HITS-THAILAND-SPOTLIGHT-AWARDS` Saturday **690/890 preserved**.
- Oct25 `EVT-20261025-NARS-TEETEEPOR-EXCLUSIVE-EVENT` Sunday **690/890 preserved**.
- Each affected override note now `OWNER_WEEKDAY_MON_THU_FALLBACK_20261010 | NOT_COMPETITOR_MEDIAN`.

### New eight poster-pending event cards explicitly owner-authorized

Appended eight unique canonical rows to `01_Events` (rows 331–338): `open`, `active_on_web=TRUE`, no fabricated poster URL (blank E), short Thai notes with venue/time/source/permission caveats; health field `OK`. Appended **24** corresponding package overrides to `04_Event_Overrides`: phone-only and phone+lens at owner weekday/weekend rates, standalone lens-only FALSE/hidden.

| Date | Event ID | Name | Phone / bundle (THB) | Original source / poster state |
| --- | --- | --- | --- | --- |
| **Thu Oct15** | `EVT-20261015-LE7EL-1ST-DEBUT-ANNIVERSARY` | LE7EL 1st Debut Anniversary — AIS SIAM 18:00 | **490 / 590** | Official LE7EL artist post mirrored `https://www.sotwe.com/mollymmmale`; poster missing, no arbitrary older schedule image |
| **Sat Oct17** | `EVT-20261017-ENDLESS-US-YOU-MAYBE-ME-DEBUT` | endless us vol.1 — Union Mall 4F | **690 / 890** | `https://idoltrack.thaicyberpoint.com/event/endless-us-vol1-you-maybe-me-the-debut`; green official promotional poster mentioned by calendar, original stable poster URL not yet extracted |
| **Sat Oct17** | `EVT-20261017-MANEKINEKO-IDOL-PARTY-HALLOWEEN` | Manekineko Halloween Stage, MBK Center 7F | **690 / 890** | `https://brickinfotv.com/` / `https://idoltrack.thaicyberpoint.com/event/manekineko-idol-party-halloween-stage-oct-2026`; poster pending |
| **Sat Oct17** | `EVT-20261017-THE-PASEO-POP-THE-STAGE` | The Paseo POP THE STAGE — Ramkhamhaeng | **690 / 890** | `https://popradar.app/events`; primary poster/artist lineup/time pending, note does NOT claim primary verification |
| **Sun Oct25** | `EVT-20261025-VVV-TORNADO-SHOPPING-XIAOMI` | Tornado Shopping × VVV — Xiaomi, Dusit Central Park | **690 / 890** | `https://popradar.app/events`; date/brand primary verification pending |
| **Fri Oct30** | `EVT-20261030-AF-HALLOWEEN-AFTERLIFE` | AF Halloween Party AFTERLIFE — CHANG CANVAS One Bangkok | **690 / 890** | `https://popradar.app/events`; primary poster/entry policies pending |
| **Fri Oct30** | `EVT-20261030-POPPAH4-HALLOWEEN-NAMP` | POP-ป่ะห์ #4 × NAMP — Siam Center G Floor 18:00–21:00 | **690 / 890** | `https://popradar.app/events/festival/pop-pah-4-halloween-siam-center-2026`; distinguish Oct30 NAMP show vs Nov1 cover-dance |
| **Fri Oct30** | `EVT-20261030-VVV-SHOW-GO-WHOLESALE-RAMA2` | VVV Show — GO Wholesale Rama 2 | **690 / 890** | `https://popradar.app/events`; primary poster/precise access pending |

**Honesty:** These 8 are **listed on Web Ready** with blank official poster image, **not** falsely tagged "official poster acquired". Public storefront JS has event-summary poster fallback path. Actual graphical cross-browser load was NOT verified in this turn; only derived Sheet `show` and packages readback below was verified.

### Discovered and corrected 09_Web_Packages capacity bug

- Pre-fix `09_Web_Packages` `gridProperties.rowCount=1000`. Last computed 1000th row belonged to `EVT-20261030-AF-HALLOWEEN-AFTERLIFE` bundle; POPPAH4 and VVV GO Wholesale each had **no generated package rows** even though `01_Events` contained those event IDs. `08_Web_Ready` consequently returned **0 available**, `เต็มแล้ว`, `show_full` incorrectly. This was **NOT a booking/inventory sellout**.
- Repair executed via one raw Sheets batch `updateSheetProperties`: `09_Web_Packages` rowCount **1000 → 1120**, followed by `copyPaste` original formula/validation/style rows **998–1000** into new **1001–1120**, preserving relative formula references and existing occupied cells 5–1000. No existing formula row was overwritten.
- Readback `09_Web_Packages!A1001:N1006`: exactly 3 package formulas for POPPAH4 + exactly 3 for VVV; `phone_only 690 / available`, `phone_lens_bundle 890 / available`, `lens_only 390 / hidden`.
- Readback `08_Web_Ready!A338:K339`: both are **`show`, `เปิดจอง`, available_phone_count=2**, no booking added. This preserves per-day shared actual inventory, not 2 newly invented devices per event.

### Final exact derived Sheet acceptance

Read `08_Web_Ready!A324:K342` and `09_Web_Packages!A958:N1015` for 15 unique event IDs from the two owner-directed batches (7 before + 8 now). All **15/15** passed:
- `action_for_web='show'` (none `show_full`).
- One `phone_only` row at correct owner weekpart fallback price and status `available` each.
- One `phone_lens_bundle` row at correct fallback price and status `available` each.
- One `lens_only` row at `hidden` each.
- First 7 original posters retained; new 8 intentionally blank pending verified poster URL.
- The default weekend group has 9 cards at 690/890, weekday group 6 at 490/590.

**Business-write count this turn:** 10 price-override price/note rows corrected; **8 new canonical event rows**, **24 new overrides**, and a formula-derived 09_Web_Packages capacity repair affecting only formerly blank rows 1001–1120. Zero changes to booked events, existing unrelated events, owner-hidden events, booking status or pricing, and zero paid providers; do not write `production_business_writes_zero` for this turn.

### Owner booking protection

Booked dates excluded: Oct18 OH MY FOURTH, Oct23 LYKN, Oct24 LYKN, Oct31 NCT127. Oct10/11 owner-closed dates protected. Old Oct25 LYKN booking was **cancelled**; does not block VVV Oct25. No new events on any owner-closed/active-booking day; no hidden tombstones resurrected. Each same-day card uses same physical inventory, with booking-day exclusivity rule for future bookings.

### Next poster follow-up and source risk

Eight pending original exact-event poster URLs (list above). First party official assets may appear on X/IG artist/brand/organizer accounts or event calendar source URLs; monitor and update ONLY exact event_id 01_Events column E after verifying original event name/date and public source permissions. Never use unrelated LE7EL May poster, generic older Siam Center Halloween poster, nightlife image or hallucinated/AI-generated poster. Leave no-poster fallback until verified. A few festival items currently rely only on secondary event calendars; monitor cancellations/venue/time changes and prevent booking misinformation.

### Operational gap

Draft PR #680 scanner code/Full Loop still not merged/accepted. **Customer-facing public data API GET for all 15 newly updated events was not successfully re-fetched this turn** due fetch/network limitations; Google derived Web Ready + Packages readback has been executed and passes 15/15. Prior separate turn verified public API for original 7/7. Do NOT claim a new exact public API verification or browser visual inspection for additional eight until actually performed.

**Safe handoff: PR #680 + Issue #685 + this document. Status: `WEEKPART_PRICING_RULE_RECORDED` / `15_OF_15_SHEET_SHOW_PRICED` / `8_POSTERS_STILL_PENDING` / `PACKAGE_GRID_LIMIT_FIXED_1120` / `BOOKING_EXCLUSIONS_INTACT` / `AUTONOMOUS_FULL_LOOP_NOT_ACCEPTED`.**
