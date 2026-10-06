# Ultra Deep November Incremental Discovery — 2026-10-05

## Scope

Read-only external-first discovery and reconciliation for **November 2026**, Bangkok + Greater Bangkok, requested by owner to find additional events suitable for KK Phone Rental storefront.

Safety:
- storefront/backoffice was used only after external discovery for reconciliation;
- owner-hidden / existing `hide` rows are protected and must not be re-added;
- no production business writes were performed;
- `production_writes=0`;
- no phase boundary was crossed.

## Production storefront reconciliation snapshot

The live public `08_Web_Ready` feed contained **44 November rows** at reconciliation time. External discovery was compared against those rows after source discovery.

### P0 — confirmed missing date / no-drop defects

1. **BIG ASS คอนเสิร์ตใหญ่ ก่อนตาย — 15 Nov 2026 — IMPACT Arena**
   - ThaiTicketMajor/IMPACT currently lists five shows: 13, 14, **15**, 16, 17 Nov 2026.
   - Production storefront currently contains 13, 14, 16, 17 but not 15.
   - Classification: `KNOWN_FAMILY_MISSING_SHOW_DATE / VERIFY_AND_PROMOTE`.
   - Strongest current source: ThaiTicketMajor IMPACT Arena venue/event listing.

2. **2026-2027 DOH KYUNG SOO CONCERT TOUR [DAY OFF] IN BANGKOK — 15 Nov 2026 — Thunder Dome**
   - Current event evidence confirms two Bangkok shows: 14 Nov 18:00 and **15 Nov 17:00**.
   - Production storefront currently contains 14 Nov but not 15 Nov.
   - This reproduces the historical multi-day no-drop risk already documented in November V4.
   - Existing stable show identity from prior handoff: `SHOW|doh-kyung-soo-day-off|20261115|S2`.
   - Classification: `KNOWN_FAMILY_MISSING_SHOW_DATE / VERIFY_AND_PROMOTE`.

## P1 — new high-rentability candidates absent from storefront

3. **THE PLAYERS BUILD FANCON — 21 Nov 2026 — Phenix Grand Ballroom**
   - ThaiTicketMajor venue page currently lists this event on 21 Nov.
   - Classification: `VERIFIED_CANDIDATE / FANCON / HIGH_RENTAL_FIT`.

4. **JMNK : SHEเสิร์ฟ CONCERT — 21 Nov 2026 — centralwOrld PULSE Hall, 7F**
   - Current Eventpop and JMNK official social announcements identify 21 Nov 2026.
   - Classification: `VERIFIED_CANDIDATE / T-POP / HIGH_RENTAL_FIT`.

5. **Bae Jin-young <Forever Young> Thailand Fan Meeting 2026 in Bangkok — 22 Nov 2026 — Phenix Grand Ballroom**
   - Current organizer/ticketing discovery indicates 22 Nov 2026.
   - Direct canonical ticket-page crosscheck is still required before publish.
   - Classification: `VERIFY_REQUIRED / K-FANMEETING / HIGH_RENTAL_FIT`.

6. **InnOngsa 1st Fan Meeting in Bangkok — 21 Nov 2026 — One Bangkok Forum**
   - Current public schedule evidence identifies 21 Nov and ThaiTicketMajor sale planned for 17 Oct.
   - Direct organizer/TTM page must still be captured before publish.
   - Classification: `VERIFY_REQUIRED / FANMEETING / HIGH_RENTAL_FIT`.

7. **YEW — THE SECOND NATURE CONCERT — 27 Nov 2026 — The Street Hall**
   - Current YEW official social announcement confirms 27 Nov 2026 and I HAVE TICKET sale on 30 Oct.
   - Classification: `VERIFIED_SOCIAL / THAI_INDIE / MEDIUM_HIGH_RENTAL_FIT`.

## P2 — verified additional live-music candidates

8. **DOMi & JD BECK — WHO ASKED? ASIA TOUR — 24 Nov 2026 — Bangkok/Khlong Toei**
   - Artist official tour site confirms Bangkok-area stop on 24 Nov.
   - Classification: `VERIFIED_ARTIST_OFFICIAL / MEDIUM_RENTAL_FIT`.

9. **Mass of the Fermenting Dregs Live in Bangkok — 22 Nov 2026 — Mr. Fox Live House**
   - Current Razor Riff event listing confirms event/date/venue.
   - Classification: `VERIFIED_ORGANIZER / MEDIUM_RENTAL_FIT`.

10. **brb. Live in Bangkok — 28 Nov 2026 — Mr. Fox Live House**
    - Current Razor Riff event listing confirms event/date/venue.
    - Classification: `VERIFIED_ORGANIZER / MEDIUM_RENTAL_FIT`.

11. **15 Years of Kolour — 21 Nov 2026 — Cloud 11 Park**
    - Official Kolour page + Megatix confirm 21 Nov.
    - Classification: `VERIFIED / FESTIVAL / MEDIUM_RENTAL_FIT`.

12. **KrosSphere: Dept x Homecomings — 22 Nov 2026 — VOLUME LIVEHOUSE**
    - Organizer/social discovery identified event; retain for verifier source crosscheck.
    - Classification: `VERIFY_REQUIRED / MEDIUM_RENTAL_FIT`.

## Holds / do not publish yet

- **Jesse Gold – Live in Bangkok — 18 Nov**: source text contains a venue conflict; remain `VERIFY_REQUIRED_FIELD_CONFLICT`.
- Low-priority / lower-rental-fit examples found: Harry Potter and the Goblet of Fire in Concert, I LOVE 70'S, mass-participation sports events. Do not prioritize ahead of fandom/concert candidates.

## Protected existing hidden rows

Do **not** re-add merely because they were rediscovered externally. Current November storefront rows already marked `hide` include examples such as:
- Zara Larsson
- Shine Bangkok Fansign
- LANY
- wave to earth
- SO JI SUB
- JAN JINGJING
- Lena & Miu
- JOJI
- FKJ
- Khalid

Treat as `OWNER_HIDDEN_TOMBSTONE / DO_NOT_READD` unless owner explicitly changes policy.

## Next governed path

Priority verifier order:
1. BIG ASS 15 Nov
2. DOH KYUNG SOO 15 Nov
3. THE PLAYERS BUILD FANCON
4. JMNK SHEเสิร์ฟ
5. Bae Jin-young Fan Meeting
6. InnOngsa
7. YEW
8. DOMi & JD BECK
9. Mass of the Fermenting Dregs
10. brb.
11. Kolour
12. KrosSphere

After verification, send only VERIFIED candidates into Phase-3 pricing. No storefront write is allowed from this discovery document alone.


## 2026-10-06 production completion pass — November storefront additions

Owner explicitly requested that the November storefront discovery work be completed rather than left at discovery-only, with **BIG ASS excluded**. A fresh external-first reconciliation was run against LiveIn, ThaiTicketMajor, Eventpop, Ticketmelon/organizer pages, Natgan and official artist/organizer/ticketing sources, then reconciled against the canonical Google Sheet.

### New rows promoted with exact production readback

The following November candidates were verified, given current event-specific posters, priced using exact-event evidence where available or the governed comparable/base fallback where no usable phone-rental median existed, written to `01_Events` + `04_Event_Overrides`, and exact-read back through `08_Web_Ready` + `09_Web_Packages`:

- `EVT-20261117-MY-CHEMICAL-ROMANCE-BANGKOK`
  - 17 Nov 2026, IMPACT Challenger Hall
  - poster: Bangkok current-event key visual mirror
  - 890 phone / 1,090 bundle; lens-only hidden at canonical 390
- `EVT-20261128-KIM-JI-WON-WONEDERLAND-BANGKOK`
  - 28 Nov 2026, SiamPic Hall
  - current WONEDERLAND Asia-tour key visual
  - 890 / 1,090; lens-only hidden
- `EVT-20261114-BNK48-CGM48-GE2026-FINAL-RESULTS`
  - 14 Nov 2026, MCC Hall The Mall Lifestore Bangkapi
  - exact current Eventpop hero poster
  - same-fandom / same-day Journey of Dreams comparable fallback 890 / 1,090
- `EVT-20261113-EUROVISION-ASIA-PREVIEW-SHOW`
  - 13 Nov 2026, One Bangkok Forum
  - official Eurovision Asia current key visual
  - high-demand live-show fallback 890 / 1,090
- `EVT-20261114-EUROVISION-ASIA-GRAND-FINAL`
  - 14 Nov 2026, One Bangkok Forum
  - official Eurovision Asia current key visual
  - high-demand multi-country live-show fallback 890 / 1,090
- `EVT-20261113-GREASY-CAFE-UNPLUGGED-UNTOLD`
  - 13 Nov 2026, 383 Live House by Cin Guitars
  - exact current Ticketmelon event poster
  - Thai indie/livehouse comparable fallback 790 / 990; lens-only hidden at 390

All six currently read back as `show` with two devices remaining.

### Existing row verified during completion

`EVT-20261101-VET-KKU-A-NIGHT-TO-REMEMBER`
- A Night to Remember | 40YEARS VET KKU : Charity Concert
- 1 Nov 2026, SiamPic Hall
- current Eventpop/Hoshi exact event poster
- 790 / 990
- already present in canonical storefront during the completion pass; no duplicate created.

### Availability exclusions preserved

- **15 Nov 2026** is fully booked by K*Pop Masterz + MilkLove. DOH KYUNG SOO 15 Nov and all other additional events on that date remain hidden/not added.
- **21 Nov 2026** is fully booked by two CAT EXPO bookings. THE PLAYERS BUILD FANCON, JMNK SHEเสิร์ฟ, InnOngsa and other additional candidates on that date remain hidden/not added.
- BIG ASS remains excluded per owner instruction; the missing 15 Nov BIG ASS date was **not** added.

### Current storefront reconciliation state

Latest canonical `08_Web_Ready` November readback:
- 102 November rows total
- 84 `show` / `show_full`
- 18 hidden
- 3 `show_full`
- **0 active rows with missing/non-HTTPS poster URL**
- no exact name+date duplicate detected in the November storefront audit

Fresh external sweeps across current ThaiTicketMajor, Eventpop, LiveIn and Thai BL/GL schedules did not expose another high-priority November candidate that was simultaneously:
1. missing from canonical storefront,
2. on a date with device availability,
3. not owner-hidden/tombstoned,
4. exact-date verified,
5. and supported by a current event-specific poster.

Known holds:
- `SUNSU หมึกกรุบ Presents In NoVibe-ber Concert` — Eventpop still TBA, so no canonical date and no publish.
- Greasy Cafe was the remaining exact-date/current-poster gap and has now been promoted.
- lower-rental-fit orchestra/classical/general events were not prioritized over fandom/music-phone-rental candidates.

### Production invariants

- BIG ASS excluded.
- No hidden/tombstoned event was re-added.
- Full-booked dates 15/11 and 21/11 were not reopened for additional events.
- Every newly active row has a current HTTPS poster.
- Generated `09_Web_Packages` exact readback was required after every write.
