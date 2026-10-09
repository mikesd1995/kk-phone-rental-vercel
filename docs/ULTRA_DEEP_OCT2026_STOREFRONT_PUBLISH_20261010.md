# Ultra Deep October 2026 — Governed storefront publication record (2026-10-10)

**Confirmed business action this turn:** SEVEN legitimate user-directed event insertions into KK's actual canonical Google Sheets, with two packages each in the live customer-facing API, no GitHub deploy/merge.

**Owner instruction:** find first-party posters, check exact-event median market rent, add valid unbooked October event dates, never add unrelated events on booked dates or reopen owner-hidden dates. Correctly respect no-cost/no-paid-credits preference.

## Authoritative Google Sheet mutation / event identity

- Canonical backend: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`
- Write 1: `01_Events!A324:I330` — 7 new canonical dated events, `open`, `active_on_web=TRUE`, official organizer image URL and source detail in initial event note, `data_health=OK`.
- Write 2: 21 rows appended to `04_Event_Overrides`: 7 `TPL-VIVO-X300-PRO-PHONE` overrides at **690 THB** each, 7 `TPL-VIVO-X300-PRO-BUNDLE` overrides at **890 THB**, 7 `TPL-ZEISS-2-35X-LENS` at `active_override=FALSE`. No lens-only posting.
- Write 3: revised `01_Events!H324:H330` only, replacing verbose engineering diagnostic notes with customer-friendly Thai access/recording restrictions. Other existing event data, active booking and hidden locks unchanged.
- `03_Packages` base remains phone 890 / bundle 1090 / lens 390; **overrides only on these seven new event IDs**.

| Event date | Event | Exact new event_id | Original organizer poster link | Public-access condition |
|---|---|---|---|---|
| 2026-10-14 | VVV — Tornado Busking at centralwOrld | `EVT-20261014-VVV-TORNADO-BUSKING-CENTRALWORLD` | [official](https://x.com/VVV_theofficial/status/2105524106347356378) / [original image](https://pbs.twimg.com/media/HThFeOtbkAAd9C4?format=webp&name=large) | FANZONE 800 + FREEZONE 200 preregistration only, NO WALK-IN |
| 2026-10-15 | MAYA TV AWARDS 2026 | `EVT-20261015-MAYA-TV-AWARDS-2026` | [official](https://x.com/mayaonline2002/status/2086695635013828763) / [original image](https://pbs.twimg.com/media/HPVugLWakAEI0Q7?format=webp&name=large) | red carpet / hall/photography access controlled by organizer |
| 2026-10-15 | IN2IT × EVEANDBOY — Tle–FirstOne | `EVT-20261015-IN2IT-EVEANDBOY-TLE-FIRSTONE` | [official](https://x.com/EVEANDBOY/status/2097181438135439500) / [original image](https://pbs.twimg.com/media/HRqvZd3boAAYrti?format=webp&name=large) | LIMITED 30 lucky winners; application already closed 6 Oct |
| 2026-10-17 | The Viral Hits Thailand Spotlight Awards | `EVT-20261017-VIRAL-HITS-THAILAND-SPOTLIGHT-AWARDS` | [official](https://x.com/Theviralhits_th/status/2105601817627513220) / [original image](https://pbs.twimg.com/media/HTiZsLmasAAgy3K?format=webp&name=large) | entry and recording rules to be followed; QENRYX/TREV/Atom/Focus |
| 2026-10-21 | HER HYNESS × Lingling | `EVT-20261021-HER-HYNESS-LINGLING-KWONG` | [official](https://x.com/HerHynessBeauty/status/2102323265419252073) / [original image](https://pbs.twimg.com/media/HSy3SN2aEAALi4K?format=webp&name=large) | limited lucky/top fans, no universal public access implied |
| 2026-10-25 | NARS × TeeTeePor | `EVT-20261025-NARS-TEETEEPOR-EXCLUSIVE-EVENT` | [official](https://x.com/EVEANDBOY/status/2105857389144784980) / [original image](https://pbs.twimg.com/media/HTmBX5OaUAAVWVS?format=webp&name=large) | 20 selected lucky fans only; ICON CINECONIC 15:00 |
| 2026-10-29 | MINDY — Shoot Your Shot Photocard Fansign | `EVT-20261029-MINDY-SHOOT-YOUR-SHOT-FANSIGN` | [official](https://x.com/MINDYOFFICIALTH/status/2106942858527928675) / [original image](https://pbs.twimg.com/media/HT1dW3fb0AA8S0R?format=webp&name=large) | pre-order/registered rights, photo permissions unverified |

## REAL READBACK — VERIFIED

1. Google Sheets `01_Events!A324:I330` read back all 7 unique event IDs, dates, `active_on_web=TRUE`, correct poster URLs and `OK`.
2. `04_Event_Overrides` read back original 21 distinct event-specific records. No existing override modified.
3. `08_Web_Ready` derived readback each new event `action_for_web=show`, `booking_status_for_web=เปิดจอง`, `available_phone_count=2`, original poster_url, human-readable Thai participation notice.
4. `09_Web_Packages` derived readback each `phone_only=690 available`, `phone_lens_bundle=890 available`, `lens_only=390 hidden` and available count 2. **The hidden 390 is NOT a product offer; it is an inactive generated row.**
5. **Public live production API readback** (not just internal Sheet):
   - `https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK`: all seven canonical IDs found, original X media URLs, Thai notes, `show` and `เปิดจอง` for IN2IT and NARS examples checked.
   - `https://kk-phone-rental.vercel.app/api/kk-data?sheet=09_Web_Packages&range=A4%3AN`: all seven IDs found, **21 total package rows** with phone-only 690, bundle 890 and hidden lens-only.
   - **This is proof of live customer API publication.** Full visual iOS/browser screenshot and image load QA was NOT run; do NOT overclaim visual acceptance.
6. Source PR #680 remains Draft and not merged; no code deploy was needed to publish these canonical business rows to existing production API.

## Booking and owner locks — obeyed

- Active bookings (confirmed/pending/prepared/picked_up) on **Oct18 OH MY FOURTH 2 phones; Oct23 LYKN 2 phones; Oct24 LYKN 1 phone; Oct31 NCT127 2 phones**. Absolutely no unrelated additions on ANY of those dates, even with one free Oct24 phone.
- Oct10 owner permits REMASTER only; Oct11 owner permits Weeknd only. No new cards on Oct10 or Oct11; held Skin Editor sessions remain `VERIFIED_HOLD`.
- Oct23 RoV is owner-hidden; no reopening. Oct14/15 Moonshadow are already separately published and were not duplicated. Oct30 Siam Halloween already live; was not duplicated. November owner locks unchanged.
- On Oct25, an old LYKN booking was **cancelled**, so not an active date lock. Two phone slots shown unbooked for NARS and market fallback.
- 15 Oct contains **two independent eligible event cards** (MAYA and IN2IT) because the owner rule excludes other events only once an active booking exists on the day. Keep checking booking SOT on each later reservation.

## Price integrity

- Requested exact 10–20 independent competitor median checked via targeted X search for MAYA, VVV, HER HYNESS/Lingling, NARS, MINDY and variants. There were NOT enough comparable current exact-event price/package observations to calculate a trustworthy median (zero or ambiguous indexed public quotes for these named events).
- Used preapproved owner's **690 THB phone / 890 THB phone+lens BASELINE FALLBACK**, not advertised as verified competitor median. Explicit `OWNER_BASE_FALLBACK_20261010 | NOT_COMPETITOR_MEDIAN` in all price override notes. Pricing on booked-date events and existing cards unchanged.
- Dates/entry/photo conditions in card notes derived from first-party announcement. Brand fansign/winner events are RESTRICTED; new offer applies only to legally eligible attendees with permitted recording. No revenue guarantee or public access claim.

## Remaining October source leads not published (correctly fail-closed)

- LE7EL AIS SIAM Oct15 (first-party event confirmed but official stable show-poster URL couldn't be reliably extracted; an unrelated 2025 LE7EL photo must NOT be substituted).
- endless us vol.1 Union Mall Oct17 (official Instagram media signed CDN might expire; stable durable event flyer not found).
- VVV Xiaomi Oct25, POP-ป่ะห์ NAMP Oct30, AF Halloween Oct30, other small-stage leads from Issue #685: require exact primary artist/brand poster URL/date/photo access and real demand/eligibility.
- Oct23 Cathy Doll Orm, Oct24 Idol Live Stage, Oct31 Sugar N Spice / T-DAY **blocked by active Booking** (report only); other 18/23/24/31 candidates similarly excluded.
- Some secondary calendar items might be incorrect or duplicate existing owner-hidden rows: no guessed poster/median, no auto reactivation.

## Durability and QA gates

- Current change deliberately edits **business data**. Thus do **NOT** describe this turn as `production_business_writes_zero`: 7 event writes, 21 override writes, and 7 event note updates **were performed**, all user-authorized. No Booking mutations, no non-target price changes, no owner-locked visibility mutations, no X posting, no provider topup.
- Any concurrent new booking on an October date must cause a future booking-day reconciliation to close/hold other cards on that date; the runtime's owner-date rules still apply.
- Follow Issue #685 manual full October source sweep, #684 Beauty Buffet missed incident, and PR #680 scanner engineering. Autonomous scanner V27 Production Full Loop is not fixed or accepted by this manual insertion.
- If future image URL hotlink loads fail, use approved permanent original source poster asset hosting via source workflow, never AI mock-up, unrelated photo, low quality screenshot, or guessed file. Do not claim visual screenshots were done.

**Classification:** `GOOGLE_SOT_BUSINESS_WRITE_7_EVENTS_21_OVERRIDES` / `PUBLIC_API_EXACT_READBACK_7_OF_7` / `BOOKING_DATE_EXCLUSIONS_PRESERVED` / `SOURCE_IMAGES_ORIGINAL_PBS` / `690_890_OWNER_FALLBACK_NOT_MEDIAN` / `PRODUCTION_AUTONOMOUS_FULL_NOT_ACCEPTED`.
