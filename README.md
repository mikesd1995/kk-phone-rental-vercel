# KK Phone Rental v13.2 — Audited & Fixed

## ทำอะไรเพิ่มจาก v13 Phase 0

### Backend ที่ต้องใช้คู่กับไฟล์ Excel v13.1
- Date-level availability: กันเครื่อง/เลนส์ถูกจองซ้ำในหลายงานวันเดียวกัน
- `03_Packages!N` เป็น `available_count` ต่อ package จริง: `phone_only`, `lens_only`, `phone_lens_bundle`
- Bundle ใช้จำนวนว่างแบบ `MIN(phone, lens)` เพื่อไม่โชว์ว่างถ้าขาดอย่างใดอย่างหนึ่ง
- แก้สูตร `internal_check` ใน `00_Master_Booking` ที่เคยเช็กผิดคอลัมน์ `active_on_web` แทน `event_status`
- เพิ่ม Apps Script archive automation ในไฟล์ `apps_script_archive_bookings.gs`

### Frontend Phase 1
- Loading skeleton แทน spinner เพื่อ UX ดีขึ้นตอนรอโหลด Sheet
- Cache key ผูกกับ sheet/range ลดโอกาส cache ชนกันเวลาเปลี่ยน backend
- Event deep link: เปิดหน้าแบบ `?event=EVT-xxxx` แล้วระบบ auto-open modal งานนั้น
- Client-side meta update สำหรับ title/description/og:image เมื่อเปิดงาน
- Modal poster ใช้รูปขนาดเต็มเฉพาะตอนเปิด modal
- Availability fallback ปลอดภัยขึ้น: ถ้า backend มี `available_count` แล้วจะใช้ค่านั้นเป็น source of truth

### สิ่งที่ยังไม่ทำ เพราะเป็น Phase 2 หรือใช้ไม่ได้แล้ว
- ไม่ทำ Apps Script API layer / server-side booking lock ตามคำสั่งว่า “ยังไม่ต้องทำ Phase 2”
- ไม่ทำ LINE Notify เพราะ LINE Notify ยุติบริการตั้งแต่ 31 มี.ค. 2025 แล้ว ให้ย้ายเป็น LINE Messaging API ใน Phase 2/3 แทน

## Deploy
อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น Vercel/Netlify เหมือนเดิม

## Files
```
index.html
style.css
script.js
config.js
manifest.json
favicon.png
apple-touch-icon.png
apps_script_archive_bookings.gs  ← copy ไป Google Sheets Apps Script ถ้าต้องการ archive อัตโนมัติ
```


## v13.2 Audit Fixes
ดูรายละเอียดใน `AUDIT_REPORT.md`
