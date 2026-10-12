# KK Ultra Deep October 2026 — actual source and safety checkpoint (2026-10-12)

## Status / hard boundary
READ-ONLY REAL SOURCE AUDIT completed. AUTONOMOUS FULL LOOP NOT ACCEPTED. Production business writes, poster writes, price writes, booking writes, hide/unhide changes, merges and deploys: 0. No paid credits or top-ups.

Vercel Production READY: deployment dpl_45antEymEgQKuVkMovRcz4HHh6Ge; main SHA 56714eb709131647babb87c6758b5c0a967fe5fe. Draft PR #680 not promoted.

## Backend reconciliation
Backend Google Spreadsheet 12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU, 01_Events A4:I550, 08_Web_Ready A4:K550, 00_Master_Booking A4:W100. The owner flag active_on_web is NOT the same as Web Ready public visibility. Only action_for_web values show and show_full certify the EFFECTIVE displayed-card classification. This is a sheet-level check, not independent rendered browser acceptance.

- All rows: 96 Core owner-active, 89 effectively shown (77 show and 12 show_full), 7 Core active but derived hide, 72 shown current/future as of October 12, 3 blank public canonical poster URLs. No duplicated event_id in the bounded Core/Web reads.
- October dates 01–31: 57 Core active, 50 effectively shown; October 12–31: 35 shown. No blank poster URL among the 35 October 12–31 public entries (this does not mean all image bytes render or every image is the correct official artwork).
- Core active but Web Ready hide (DO NOT auto-unhide): EVT-20261015-LE7EL-1ST-DEBUT-ANNIVERSARY; EVT-20261017-MANEKINEKO-IDOL-PARTY-HALLOWEEN; EVT-20261017-THE-PASEO-POP-THE-STAGE; EVT-20261025-VVV-TORNADO-SHOPPING-XIAOMI; EVT-20261030-AF-HALLOWEEN-AFTERLIFE; EVT-20261030-POPPAH4-HALLOWEEN-NAMP; EVT-20261030-VVV-SHOW-GO-WHOLESALE-RAMA2. Unknown package/stock/owner gate causes remain HOLD; do not infer an owner instruction to republish.
- Three customer-visible blank poster URLs are all November: EVT-20261102-SUPER-SUN-ZEE-PRUK-BIRTHDAY-FANSIGN; EVT-20261105-MIZUMI-PHUWIN-MOISTURE-MATCH; EVT-20261106-BRICE-POND-NARAVIT-FAN-EVENT. Thus the 10 Core active blank poster URLs previously counted comprise 7 effectively hidden plus 3 public entries. Any fallback UI image does not fix the missing canonical Core poster.
- Booking-day locks verified on actual Master Booking rows: October 18 (2 confirmed Oh My Fourth), 23 (2 confirmed LYKN), 24 (1 confirmed LYKN), 31 (2 confirmed NCT127). ANY effective booking on a calendar date blocks repricing of ALL events that date. The October 25 observed LYKN booking is cancelled and does not itself lock the date. Never include personal names/phone numbers in audit logs.

## Real Supabase October runtime
Project mxjnjujqjybqughsnqbz read-only SQL: public.kk_ultra_deep_commands has 9 October FULL_READ_ONLY commands, of which 8 FAILED and 1 historical COMPLETE, all production_writes=0. Latest failure October 6. public.kk_ultra_deep_scan_shards now EXISTS, but has 0 total rows and 0 October receipt rows. Presence of schema is not proof that the new sharded FULL scanner executed; cannot assert Full Loop passed or source-universe coverage complete. Do not create a misleading COMPLETE using an unverified write command.

## External source verification: independent targeted sweep, NOT exhaustive
- CHiLLiZ, October 30 gamescom asia × Thailand Game Show: organizer/programme https://www.online-station.net/pc-console-game/1001710 confirms Meet & Greet 15:00–16:00; https://www.online-station.net/entertainment/1001798 confirms distinct Mini Concert 18:30–19:00; official expo https://gamescom.asia/ent/b2c-faqs confirms public entertainment area at QSNCC. Already exists in Tracker _Candidate_Queue as VERIFIED_HOLD, NOT a missing new storefront card. Entry ticket and filming/external lens rights plus verified demand/prices still need approval.
- TEEHENG GEN OF US 1st FANMEETING, October 24: original organiser https://www.deehuphouse.com/ confirms 16:00 ONE BANGKOK FORUM and live ticket sale. Existing Core EVT-20261024-TEEHENG-GEN-OF-US-1ST-FANMEETING has active_on_web FALSE and Candidate status VERIFIED_HOLD. October 24 booked LYKN date; no auto publish or price changes.
- MAYA TV AWARDS 2026 exists in Core EVT-20261015-MAYA-TV-AWARDS-2026 (owner active). https://www.maya-channel.com/maya_tv_awards/ is first-party event identity evidence, not proof of public camera permission or a ticket.
- Independent event calendars https://www.natgan.com/?month=2026-10 and https://www.popupplans.com/events support source discovery only. Natgan explicitly cautions details may be inaccurate. Venue/brand/ticket/artist official sources remain final event/date authority.

## Source fixes committed to Draft PR #680
- New pure read-only server/kk-ultra-deep-storefront-readback.js: separate Core active vs Web Ready public; derive *public-only* missing posters; join active Booking by date across event_id; protect booked dates; flag unknown active-booking date as READ_ONLY_AUDIT_WITH_UNRESOLVED_BOOKINGS rather than assuming no bookings. Always outputs production_writes=0, auto_unhide=false, pricing_write_authorized=false.
- Added tests/kk-ultra-deep-storefront-readback.test.js: owner Core hidden, public poster, separate event same-day Booking, cancelled Booking, show_full, invalid dates, unresolved booking. Wired into existing package.json test:ultradeep:recall test suite.
- Commit trail: 7b30a76f60845e5cfcbceb099fe3ddd8bc544116 (source), 52c747efe82582ea03dc0a0816570ea7056f6c92 (tests), 0122291e5e19601fbc76b63a75a4bf58447c4847 (CI suite wiring), a7d3896c4b5f5bca9a9b0277556d5d3612a3adc8 (orphan booking safety), e1a760f1ecb779f8d0488dcfc05343f97635c746 (test).
- Isolated V8 functional tests 7 PASS / 0 FAIL, NOT a complete Node CI pass. Execution of actual code against current Sheet matrices yielded counts above. PR stays DRAFT; no release claim.

## Follow-through release gates
P0: real official source-universe receipts including long-tail brand/mall/artist/indie/award coverage, exact event-date dedup, owner-hidden history, camera/entry/venue and poster confirmation; actual October read-only shard command with receipts, independent Verifier and full-loop readback (currently 0 shard rows).
P0: independently accepted exact-head CI, security and free-tier preview, authentic Agent invocation where claimed; no credit purchase or bypass.
P1: three publicly missing November posters only via authorized exact poster_image_url writer with Core -> Web Ready -> Public API -> rendered QA. P1: AI Pricing to remain shadow-only until model invocation, competitor evidence, booking-date owner locks, Learning calibration and authorized writer are proven.

**Overall:** durable source repair and real backend diagnostic PASS; October autonomous FULL acceptance and business storefront edits NOT COMPLETE.
