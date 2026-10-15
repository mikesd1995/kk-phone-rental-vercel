# KK Phone Rental — ปิดงานค้างและความพร้อมปิดโปรเจ็ค (16 ต.ค. 2026)

**ผลรอบนี้: แก้ตัวบล็อกด้านโค้ดและบันทึกผลแล้ว แต่ยังไม่ผ่านการตรวจรับ Production เพื่อปิดทั้งโปรเจ็ค**
อ่านสถานะ CODE WRITTEN / LOCAL TEST PASS / CI PASS / PRODUCTION VERIFIED แยกกัน ห้ามนำผล local ไปแทนการเปิดใช้งานจริง

## เป้าหมายและขอบเขต
คำสั่งเจ้าของ: แก้งานที่ติดทั้งหมดและเตรียมปิด KK Phone Rental ตามเงื่อนไขเดิม ไม่เพิ่มค่าใช้จ่าย ไม่เดาข้อมูลลูกค้า/การจอง ไม่เปลี่ยน Production, สิทธิ์, Automation หรือส่งข้อความก่อนเกตที่เกี่ยวข้องผ่าน
ทำงานบน PR เดิม ตรวจ current main และส่วนที่ซ้ำก่อนแก้ ไม่สร้าง broad PR ใหม่ ไม่ปิด PR เดิมแบบเหมารวม

## ระบบจริงที่ตรวจ
- Production alias: https://kk-phone-rental.vercel.app/ — HTTP 200; Vercel READY `dpl_6BpGtGqNPG246ekTL3nHa73bRpCn`, source `a54a348dd3258d87b1ec0c70e6ffd255d4678018`
- main native full test: **1,717/1,717 PASS**; Issue #749 เรื่อง 21 inherited failures เป็น baseline เก่า ไม่ใช่ผลปัจจุบัน
- Public Web Ready / Packages: HTTP 200, 223/669 data rows, 11/14 columns; ไม่พบ customer/booking columns ใน header ที่ตรวจ
- Public Master Booking request ถูกปฏิเสธ HTTP 400; anonymous Admin snapshot และ Rental Dashboard ถูกปฏิเสธ HTTP 401
- Public feeds ยังมี `X-KK-Private-Reader-Strict: 0` และ `public-gviz-fallback` จึงยังไม่ถือว่าปิด Private Core migration
- Vercel inventory 82 objects = 73 Preview + 9 Production; จำนวน deployment ไม่ใช่หลักฐานว่า Storage GB เหลือพอ ไม่ลบ Production/rollback
- Snapshot เริ่มต้น: 35 open PRs / 69 open issues; ตรวจความต่าง 262 runtime paths พร้อม inventory ของทุก PR/Issue ใน [JSON inventory](KK_PROJECT_CLOSEOUT_INVENTORY_2026-10-16.json) ตัวเลขนี้มี timestamp และไม่ใช่สถานะถาวร

## สิ่งที่แก้สำเร็จจริงใน source

| งาน | ต้นเหตุ / สิ่งที่ดีขึ้น | หลักฐาน |
| --- | --- | --- |
| Revenue ใน #744 | Helper ซ้ำสามารถใช้ Master X ก้อนเดิมสองครั้ง ทำให้ synthetic 890 กลายเป็น 1,780; บล็อก duplicate active booking+event ก่อน aggregate ทั้ง Core/CRM ไม่เลือกแถวมั่ว | RED→GREEN, CSV/Map และ cross-event/inactive regressions; [รายละเอียด](KK_REVENUE_HELPER_DUPLICATE_GUARD_20261015.md) |
| LINE ใน #744 | แพ็กเกจที่ยังบอกว่าว่างอาจผ่านได้ทั้งที่ WebReady ซ่อน/เต็ม; รับ canonical เฉพาะ show + เปิดจอง + positive integer phone availability ก่อนอ่านแพ็กเกจ/โปสเตอร์ | Negative end-to-end case ยืนยันไม่มี Apps Script writer/push; privacy/replay เดิมอยู่ครบ; [รายละเอียด](KK_LINE_OWNER_REPLAY_PRIVACY_SOURCE_ONLY_20261015.md) |
| Inbox #700 | Test ตัด function ผิดขอบเขต แล้ว branch ค้างก่อน main ล่าสุด; แก้ตัวดึง test และ two-parent main reconciliation โดยเก็บ private-media/outbound code เดิม | 19 inherited failures หายโดยเก็บ current-main fixes ไม่ลด assertion; **1,771/1,771 PASS**, media ship gate **150/150**, routed **50/50** |
| Scanner/Verifier auditor ใน #744 | ตัวตรวจสร้าง 6 hourly slots ทั้งที่ Machine SOT ใช้ sparse daily times; เปลี่ยนเป็นอ่าน canonical cadence แบบจำกัดรูปแบบและ fail-closed | รวม Bangkok midnight, missing/off-cadence, finite DTSTART/UNTIL, malformed และ inherited seconds RED→GREEN; **58/58 targeted**; [runtime/readiness evidence](KK_RUNTIME_READINESS_AND_CADENCE_AUDIT_2026-10-16.md) |
| X copy #751 | กฎเก่ายังสวนกับ owner copy ล่าสุด; เพิ่ม V5 บล็อกวันที่ใน Hook/CTA และคำขายที่สั่งเลิก แสดง full label สำหรับวัน shop-closed ที่ยืนยันแล้วเฉพาะ copy โดยไม่แก้ backend | แก้ structural/date bypass ที่ independent review พบและปรับ active memory/skill ให้ตรงกัน; **1,767/1,767 PASS**; [รายละเอียด](https://github.com/mikesd1995/kk-phone-rental-vercel/blob/chore/x-marketing-integrated-release-candidate-20261015/docs/KK_X_COPY_CLOSURE_RECONCILIATION_2026-10-16.md) |
| Storefront #752 | เกต modal ยอมรับ anchor ที่ไม่มี alignment และ test cache ไม่รู้จัก version token ใหม่ | แก้เฉพาะ acceptance guard/tests; owner R4 จากงานขนานแก้ first-fold 320px; ทดสอบ actual Thai-font/browser และ 8 viewport แยก owner acceptance |

## ผลทดสอบที่ห้ามรวมยอดข้าม branch
- #744 รวม revenue + LINE + cadence: **1,873/1,873 PASS** และ poster ACL **26/26 PASS** แยก report; ไม่มี failed/skipped
- #700: **1,771/1,771 PASS**; #751: **1,767/1,767 PASS**
- #752 ล่าสุดอยู่ระหว่าง fresh-head acceptance; ใช้หลักฐานท้าย PR แทนการอ้างผลเก่า ทุก branch ยังเป็น Draft
- บันทึกที่ source tree เหมือนกันสามารถยืนยัน local test ได้ แต่ไม่ได้แปลว่า hosted checks ของ commit ใหม่ผ่านแล้ว
- Syntax check และ static invariant audit **10/10 PASS** (เป็น source checks ไม่ใช่ live data audit)
- Independent Reviewer ตรวจ material changes; engineering execution gate ยัง **BLOCKED: RELEASE_READBACK**
- ไม่ import #739/#737 ทั้ง branch ทับ #744 เพราะจะถอย strict transport/schema/cache protections ที่ใหม่กว่า
- #744 ใช้ centered-only modal architecture ต่างจาก #752; ยกเลิก port anchor patch เมื่อ context ไม่ตรง ไม่มี source ถูกเปลี่ยนจาก patch ที่ไม่ตรง

## ตัวบล็อกการปิด Production ที่ยังต้องมีหลักฐานจริง

| Gate | สิ่งที่ยังขาด / งานถัดไปที่แน่นอน |
| --- | --- |
| Private Core / #738 | independent owner read key + bound Apps Script identity/revision; 13/13 protected real dataset reads, reader-vs-admin negative checks, no-GViz/PII checks, rollback ก่อนค่อยจำกัด ACL |
| Poster ACL / #718 / #743 | #744 repins active allowlist 35/44 แล้ว แต่ยังไม่มี ACL repair/readback; fresh public snapshot ยืนยัน 76 cards/44 references/35 IDs ตรง pinned set ทุกตัว (เป็น membership ไม่ใช่ ACL-role readback); ต้อง dry-run owner-role แล้ว batch approval ตามสคริปต์; historical 209 เป็น audit ก่อนหน้า ต้องแยกตรวจ ไม่เหมารวมว่าแก้แล้ว |
| Booking / #714 | 17–18 ต.ค. เวลา handover ที่แท้จริงยังไม่ครบ และ contact/reference/ราคาที่ต้องยืนยัน ห้ามเดาเวลา ใส่เบอร์ หรือเปลี่ยนยอดโดยไม่มีหลักฐาน |
| LINE/Inbox / #9 / #715 | exact approved Apps Script binding, canonical #744/#700 integration, signed idempotent decision E2E, recipient/provider receipt และ private-image wrong-room/DB-concurrency acceptance; รูปเก่าที่ไม่มี provider ID สร้างกลับไม่ได้ |
| Runtime / #47 / #50 / #368 | canonical same-ID Scanner/Verifier ยัง OFF; ต้องตาม current policy ไม่ clone/วน re-enable, มี genuine scheduled occurrences/Manifest/Planner/coverage และ FULL/OIDC acceptance; source cadence fix ไม่ใช่ natural run |
| Make / #696 / #740 | free operations เหลือ 999 ต่อบัญชี แต่ recurring delivery ยังไม่ accepted; มี queue held 4 และ legacy writers ถูก quarantine ต้องพิสูจน์ approved outbox/project/receipt/ACK ก่อนเปิด |
| Final release / #49 / #713 / #692 | source-specific hosted CI, owner screenshot acceptance, authenticated Admin parity, Storage GB จริง, source/rollback และอนุมัติ release ที่ตรง scope |

รายละเอียด task IDs, cadences, queue counts, current policy v4.9.44, leases/transactions, schema bindings และข้อจำกัดการตรวจมีใน runtime report ไม่มี customer PII หรือ secret ในรายงานนี้

## บันทึก GitHub และการไปต่อ
ใช้ #744 เป็น canonical source checkpoint ของ cleanup/security/revenue/booking/runtime guards, #700 เป็น Inbox candidate, #751 เป็น marketing/ledger candidate และ #752 เป็น owner hero candidate
PR #705/#700/#706/#721/#742 และ Issue #49 ยังคง OPEN/HOLD ตาม gate ของแต่ละงาน Older discovery/governance/shadow PRs อยู่ใน inventory; ไม่เรียกว่าบั๊กที่ยังพังทุกตัว และไม่ปิดทิ้งเพื่อทำให้ตัวเลขดูน้อย
การ push ปกติใน scratch ไม่มี Git credential จึงใช้ connected GitHub Git-data API: ตรวจ blob/tree SHA เท่ากับ local tested tree, update branch แบบ fast-forward พร้อม expected head, แล้วอ่านกลับ ไม่มี force push
Commit ใหม่ใช้ `[skip ci]` เพื่อลดการ trigger hosted งานอัตโนมัติ ไม่เรียก skipped ว่า PASS ไม่ส่ง owner-command release comment
Rollback: revert source commit เฉพาะงาน; #700 เก็บ parent เดิมและ main สอง parent ไว้ ไม่มี runtime cutover ให้ย้อนกลับจากรอบนี้
Next chat: อ่านรายงานนี้ + PR head/readback ล่าสุดก่อนลงมือ ไม่ทำ audit ซ้ำจาก memory เก่า และทำ acceptance ตาม gate ที่ยังขาด


## Concurrent-head and browser boundary correction
- GitHub ref update returned a transient GraphQL error. Fresh readback proved #744 had concurrently advanced to `2969bee28ccd13c6b36b1953c22e33834f41dcb9` with a bounded private Admin snapshot cache guard. No stale ref was overwritten. Reconciled that exact newer parent locally, preserving all three new paths, and reran combined native regression before a guarded ref update. The first unreferenced Git object was never activated.
- Latest #752 eight-width continuation was automatically rejected when it could request unverified event-image/font hosts. Those destinations were not retried. A materially safer run blocks every external browser request and uses already captured public CSV plus local first-party fallback artwork. Exact new-head poster/font delivery therefore remains UNVERIFIED; do not call offline fixture rendering Production acceptance. Earlier font-correct #744 eight-width technical PASS and #752 live320 regression are separate evidence.

Final concurrent-head combined source validation: native `npm test` **1,865/1,865 PASS + 26/26 poster ACL PASS**, zero failures/skips. Prior 1,864 result preceded the separately reviewed concurrent bounded-cache guard and remains historical. Final source/branch SHA must be read from the linked PR checkpoint after push.

A second concurrent privacy repair at `570efaecaead3a421d1a4a41c2c5c83254f0f46d` sanitizes forged provider error codes using locally owned errors. Preserved all three added paths, reviewed the bounded WeakSet classification, and reran combined native regression: **1,873/1,873 PASS + 26/26 ACL PASS**, zero skips/failures. No newer safety fix was overwritten. Issue #749 is now CLOSED after current-main 1,717/1,717 verification; other project release gates remain open.
