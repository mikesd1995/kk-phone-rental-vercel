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
