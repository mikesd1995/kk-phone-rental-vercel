# KK Phone Rental — Booking P0, 17–18 Oct and NCT 1 Nov
Date: 2026-10-14 ICT | owner requested **resume Task #1**, superseding the earlier exclusion. Stage: **operational readiness PARTIAL**, new exact-source notes recorded. No customer contact, automatic booking confirmations, LINE sends, paid tools, merge or deploy in this execution.

## 1. Verified live booking identities
Read canonical `00_Master_Booking!A4:AE`, derived `08_Web_Ready!A4:K`, `09_Web_Packages!A4:N`, `02_Assets!A4:K`, owner LINE inbox (inbound only), and existing Issue [#714](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/714). **No phone numbers, customer names, LINE provider IDs or raw messages are stored in this GitHub report.**

| Day | Booking ID / row | Package / assigned hardware | Owner agreed charge | Pickup and return (L/M) |
| --- | --- | --- | ---: | --- |
| 2026-10-17 K-LIVE FESTIVAL BAND:AGE, UOB LIVE EMSPHERE | `BK-20261017-001`, Master row 60 | phone_only, PHONE-001, **no lens** | ฿750 | both blank |
| 2026-10-17 K-LIVE FESTIVAL BAND:AGE, UOB LIVE EMSPHERE | `BK-20261017-002`, Master row 63 **NEW BOOKING added 14 Oct 18:34 ICT** | phone_only, PHONE-002, **no lens** | ฿750 | both blank |
| 2026-10-18 OH MY FOURTH, BITEC LIVE | `BK-20261018-001`, Master row 52 | phone_lens_bundle, PHONE-001+LENS-001 | ฿1,090 | both blank |
| 2026-10-18 OH MY FOURTH, BITEC LIVE | `BK-20261018-002`, Master row 58 | phone_lens_bundle, PHONE-002+LENS-004 | ฿1,050 | both blank |
| 2026-11-01 NCT 127, Thammasat Stadium | `BK-20261101-001`, Master row 59 | phone_only, PHONE-001, **no lens** | ฿1,090 | both blank |

17 Oct **2 of 2 phone slots full**; 18 Oct **2 of 2 phones and 2 lenses full**. Both days have distinct phone asset IDs and no same-day phone or lens double-allocation. All above Booking rows `confirmed`, `unpaid`, `amount_received=0`, customer contact path present in Master. **NO DEPOSIT**: collect actual cash at physical handover, never mark paid or completed ahead of time. All assigned phone/lens assets are currently `rentable_now=TRUE`. `LENS-002` is inactive, not used in any of these bookings.

**Storefront parity checked**: K-LIVE Oct17 `08_Web_Ready show_full`, phone0, lens0 (effective), Phone package `full`, bundle `full`, lens-only `hidden`; OH MY FOURTH Oct18 same `show_full` phone0/lens0 and no rentable packages. **Do not reopen any alternate Oct17 or Oct18 hidden-event cards**, owner booked-day/visibility locks remain. NCT Nov01 `show`, phone count1/lens count2, public phone-only package ฿1,090 available1, bundle ฿1,390 available1; customer Master booking remains phone-only, no lens assigned.

## 2. Owner-confirmed discounts: NO PRICE CHANGE AUTHORIZED
- Oct17 both PHONE-001 and PHONE-002 owner source notes each state public phone_only ฿790, single new-renter discount **-฿40**, booked total **฿750**. **2 separate discounts, not a deduction from entire day's package.** Both notes are present. Contact/Booking H for row63 channel currently blank; owner direct booking origin is documented in private T63 but cannot be equated with LINE source. Do not fabricate channel value.
- Oct18 row52 agreed bundle **฿1,090**; row58 source T58 documents public bundle ฿1,090 less one owner-approved newcomer discount **-฿40** = **฿1,050**. The inbound LINE template's public price ฿1,090 is before discount. Do not overwrite row58 charge to 1090.
- Nov01 row59 **฿1,090 phone_only** equals currently available public phone-only price; inbound customer **original template** matches this Master nickname AND full normalized phone+event/date from **2026-10-09 22:39 ICT** but requests **phone+lens bundle ฿1,390**. A **second distinct** inbound inquiry on 2026-10-12 for same date/event is **not the same customer**; do not auto-link or create a second booking.
- Original user/owner change agreement for Nov01 phone+lens → phone_only is **not verified**. Never silently add lens/charge ฿300; never assume initial inquiry is final consent. Must confirm with customer/owner before handover.

## 3. Actual edit made this run — exactly one operational note
- **Preflight:** `00_Master_Booking!A59=BK-20261101-001`, status confirmed, package_type `phone_only`, `X59=1090`, old `T59` 580 characters, no prior same marker, target has no data validation.
- Append only to **`00_Master_Booking!T59.userEnteredValue`** (cell native format left unchanged) the marker `BOOKING_P0_NOV1_PACKAGE_VERIFY_2026-10-14`: time and source of matched inbound LINE initial bundle+price, note that final phone-only conversion is not verified, explicit do-not-auto-change contract, reminder to check customer confirmation and logistics; original owner staff note preserved in full.
- **Readback PASS:** T59 now 1,279 characters, marker present, original note text intact, `A59` unchanged, `I59=phone_only`, `X59=1090`. No customer PII copied to repo. No change to Booking ID/customer contact/phone, fields L/M, status, cash, package, asset, public price, event visibility or stock. This is an operational **warning/verification note**, not a reservation change.

## 4. Exact handover readiness gaps
- **17 Oct, PHONE-001 row60:** LINE customer-proposed pickup **15:30** (12 Oct incoming), documented in T60 as *not shop confirmed*; return time/location missing.
- **17 Oct, PHONE-002 row63:** new owner-origin confirmed booking, customer phone exists, but **no pickup proposal, owner-confirmed return or meeting point**, H channel blank; do not invent H.
- **18 Oct, PHONE-001 + LENS-001 row52:** LINE customer-proposed pickup **13:00** (5 Oct incoming), not owner confirmed; return time/location missing.
- **18 Oct, PHONE-002 + LENS-004 row58:** LINE customer-proposed pickup **15:00–16:00** (9 Oct incoming), a *window*, not a single agreed appointment; return time/location missing.
- **Between 17→18 Oct** both phones are used on successive dates: verify 17 Oct return before 18 Oct pickup, device condition/charge/storage, Lens assets ready for 18 Oct. No conflict inside one calendar day does **not** prove cross-day physical turnaround.
- **Nov01 row59:** no pickup/return confirmation; original request bundle vs current confirmed phone-only must be owner/customer verified before delivery.
- Owner-side operational handover requires explicit customer-agreed pickup date/time, exact venue meetup point, return place/time, accepted package/price, reachable contact, event/day asset locks; payment collected only at physical handover and marked then; after hardware return + cloud upload + Drive share, final lifecycle state verified. Do not mark completed simply because customer has phone in Master.

## 5. Customer-follow-up drafts (DRAFT ONLY, NOT SENT)
**17 Oct K-LIVE PHONE-001:** `สวัสดีค่ะ 📱 ยืนยันรายการวันที่ 17 ต.ค. งาน K-LIVE ที่ UOB LIVE, EMSPHERE มือถืออย่างเดียว ราคา 750 บาท (ส่วนลด 40 บาทแล้ว) ขอคอนเฟิร์มเวลารับ 15:30 น. พร้อมจุดนัดรับ และเวลาหรือจุดคืนอุปกรณ์ด้วยนะคะ 💙 ชำระเมื่อรับเครื่อง ไม่มีมัดจำค่ะ`.
**17 Oct K-LIVE PHONE-002:** `สวัสดีค่ะ 📱 รายการวันที่ 17 ต.ค. งาน K-LIVE มือถืออย่างเดียว ราคา 750 บาท (ลด 40 บาทแล้ว) รบกวนยืนยันเวลานัดรับ จุดรับคืน และเวลาคืนเครื่องที่สะดวกด้วยนะคะ 💙 ชำระตอนรับเครื่อง ไม่มีมัดจำค่ะ`.
**18 Oct OH MY FOURTH PHONE-001 + LENS-001:** `สวัสดีค่ะ 📱 รายการ OH MY FOURTH วันที่ 18 ต.ค. ที่ BITEC LIVE มือถือพร้อมเลนส์ ราคา 1,090 บาท ขอคอนเฟิร์มเวลารับ 13:00 น. และจุดนัดรับ/คืนกับเวลาคืนเครื่องอีกครั้งนะคะ 💙 ไม่ต้องมัดจำค่ะ`.
**18 Oct OH MY FOURTH PHONE-002 + LENS-004:** `สวัสดีค่ะ 📱 รายการ OH MY FOURTH วันที่ 18 ต.ค. ที่ BITEC LIVE มือถือพร้อมเลนส์ ราคา 1,050 บาท (ส่วนลด 40 บาทแล้ว) เวลารับที่เคยเสนอ 15:00–16:00 น. สะดวกยืนยันเวลาใด และจุดนัดรับ/คืนกับเวลาคืนเครื่องที่ไหนคะ 💙 ไม่มีมัดจำค่ะ`.
**Nov01 NCT row59:** `สวัสดีค่ะ 📱 ขอเช็กแพ็กเกจก่อนวันงาน NCT 127 วันที่ 1 พ.ย. ค่ะ ข้อความสอบถามแรกเป็นมือถือพร้อมเลนส์ 1,390 บาท แต่รายการยืนยันล่าสุดในระบบเป็นมือถืออย่างเดียว 1,090 บาท รบกวนยืนยันแพ็กเกจและราคาที่ตกลงสุดท้าย รวมถึงเวลารับ/คืนด้วยนะคะ 💙`. **Do not send without owner review, especially pending package choice.**

## 6. Revenue and QA evidence after new booking
- New 17 Oct booking raised active Core count to **27**, sum of active agreed X quotes to **฿30,370**; native `00_Rental_Dashboard` shows Actual **฿67,125**, Future **฿30,370**, Forecast **฿97,495** (snapshot, not proof Production server analytics fixed). Day quote totals 17 Oct ฿1,500 and 18 Oct ฿2,140, combined ฿3,640, no cash received for these entries yet.
- Public date availability with `show_full` remains correct, no same-day asset collision; upcoming times still 0/4 shop-confirmed. **Acceptance: PARTIAL** until exact scheduling/return constraints, customer Nov01 package acceptance, and real handover lifecycle UAT. Website Production changes not performed.

## 7. Release / safety
- Core Booking Sheet still security P0 Anyone Reader (#738). Keep no private contact in GitHub and do not expose Booking data via public feed. Existing Inbox private media/owner E2E still hold (#715).
- Main remains untouched, no new deployment/merge, no paid runner/Make credit use, no unknown pricing correction, no automatic dispatch to LINE, no ID number changes.
- This checkpoint supersedes older Issue #714's **3 bookings 17–18** census and accepts **4 bookings** after Oct14 new K-LIVE owner booking.
- Owner's order to resume Task #1 now applies. The earlier no-Task1 exclusion in older task #2–13 docs is no longer the current user instruction.

**Result: exact 1-cell staff-note protection FIXED and read back; bookings allocation and discounts VERIFIED; external owner/customer appointment acceptance still open.**
