# KK Phone Rental v13.4 Audit Report

ตรวจซ้ำจาก v13.3 แบบละเอียดทั้ง backend และ frontend แล้วแก้เป็น v13.4

## Fixed / Optimized

1. Backend: `09_Web_Packages` เดิมดึง event จาก `01_Events!A5:A104` เท่านั้น เสี่ยงตกหล่นเมื่อ event เยอะขึ้น → ขยายเป็น `A5:A1000`.
2. Backend: ลด full-column formulas ใน output/booking lookups หลัก → ใช้ bounded ranges `5:1000` เพื่อให้ Google Sheets เบาลง.
3. Backend: เปิด full recalculation on open/import เพื่อให้สูตรใหม่คำนวณเมื่อเปิดไฟล์หรืออัปโหลดเข้า Google Sheets.
4. Frontend: ปรับ header normalization ให้ทนกว่าเดิม รองรับ underscore/space/dash/punctuation.
5. Frontend: ลด O(events × packages) ใน package builder โดยใช้ per-event `pkgMap`.
6. Frontend: แก้ comment/debug label จาก v13.3 เป็น v13.4 และแก้ note column เก่าที่ไม่ตรง.
7. PWA: เพิ่ม `icon-192.png` และ `icon-512.png` สำหรับ Android installability.
8. Index: preconnect ไป `lh3.googleusercontent.com` ให้ตรงกับ origin ที่โหลดรูปจริง.

## No critical unresolved bug found

ระบบยังไม่ใช่ Phase 2: ยังไม่มี server-side booking lock / race-condition protection แบบ online booking อัตโนมัติ เพราะผู้ใช้สั่งไว้ก่อนหน้านี้ว่ายังไม่ทำ Phase 2.

## Known limitation

Dynamic OG per event ที่ set ด้วย JS อาจไม่ถูก LINE/Facebook crawler อ่านบน static hosting ถ้าต้องการ per-event preview จริง ต้องทำเป็น server/build-time pages ใน Phase 2/SEO phase.
