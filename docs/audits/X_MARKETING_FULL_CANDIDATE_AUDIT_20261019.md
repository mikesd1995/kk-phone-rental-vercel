# X Marketing Full-Candidate Audit — 2026-10-19 (Bangkok)

## Scope and evidence
- Read live Production API /api/kk-data for 08_Web_Ready A4:K and 09_Web_Packages A4:N (HTTP 200), no production writes.
- Parsed CSV quoted multiline fields and deduplicated by event_id (last occurrence).
- 203 unique rows from Web Ready; 38 future event-date rows met exact gates: action_for_web=show, booking_status_for_web=เปิดจอง, available_phone_count>0, date >= 2026-10-19.
- Read Google Sheets 18_X_Post_Log A4:P1950 (165 rows including header) and 18_Event_Visibility_Locks A1:N500 (278 rows including header). Log's recent rows were October 2, not evidence of today's actual X posts; fresh X metrics not verified.
- Browser extension read failed because connected browser context unavailable. Production API show is not a rendered DOM proof. Therefore do NOT label any candidate production-verified visible or auto-post-ready.
- Owner lock rules apply; Jasper December 18 and 20 show_full / full, only December 19 is show / open / one phone. Other events on Dec18-20 explicitly owner-locked.

## Proposed editorial slots for Oct19 (not authorized publishing)
06:00 KRIST 20 Oct — conversion — 790/990
07:30 HER HYNESS Lingling 21 Oct — conversion — 490/590
09:00 LYKN 24-25 Oct — conversion — 990/1290; Oct23 full
10:30 NCT127 Nov1 — awareness — 1090/1390; Oct31 full
12:00 0WAVE Oct21 — conversion — 490/590
13:30 DEW TEE Nov7-8 — awareness — 790/990
15:00 BENTON Oct28 — conversion — 590/690
16:30 DAOUOFFROAD Oct30 — awareness — 790/990
18:00 PAÑPURI PHUTATCHAI Oct21 — conversion — 490/590
19:30 JASP.ER Dec19 ONLY — awareness — 990/1290
21:00 NARS TeeTeePor Oct25 — conversion — 790/990
22:30 STARLYMPICS Nov28 — awareness — 890/1190
00:00 Antidotes Phuwin Oct29 — conversion — 490/590 (Oct20 00:00)

Editorial balance 8 conversion / 5 awareness. Selection is qualitative and not a measured X engagement ranking. 90-minute intervals. Do not publish without real DOM/booking CTA verification, current X duplicate check, live engagement evidence, and owner approval. Existing draft PR #716 max 2 new recommendations per Bangkok business day and safety gates remain in force; 13 slots are a planning slate, not permission to post 13 times.

## Defects and remaining work
1. Candidate discovery must traverse ALL show+open rows, not just first page of 24; add regression case Jasper Dec19 and owner-locked sibling dates.
2. Verify DOM-rendered cards and booking CTA in an actual browser. Current Browser connector needs originating browser extension; not available in this chat.
3. Collect authenticated X metrics with source/time, avoid stale or assumed_posted log rows, and dedupe against live account.
4. Use AI/learning/Hugging Face labels only with real execution and recorded provenance; none executed in this audit.
5. Investigate inconsistent add-on prices vs package totals: some rows show lens add-on 390 while bundle delta 100/200/300; publish base and bundle only until reconciled.
6. No merge, deploy, changes to production, bookings, rights, automations, or extra paid services in this audit.
