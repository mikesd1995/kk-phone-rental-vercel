# KK Phone Rental Frontend v13.4 — Lean Audited + Optimized

Frontend นี้แก้ให้ทำงานกับ backend lean v13.4 แล้ว

## Source sheets

- Event-level data: `08_Web_Ready!A4:K`
- Package-level data: `09_Web_Packages!A4:L`

## Backend structure ที่รองรับ

- `01_Events` = ข้อมูลงานเท่านั้น
- `02_Assets` = เครื่อง/เลนส์จริงแบบ 1 ชิ้นต่อ 1 แถว
- `03_Packages` = Package Template กลาง
- `04_Event_Overrides` = ราคา/โน้ต/active เฉพาะงานพิเศษ
- `09_Web_Packages` = output แพ็กเกจที่ frontend อ่าน

## Deploy note

หลังอัปโหลด backend ไป Google Sheets ให้ publish/เปิดสิทธิ์อ่านเหมือนเดิม แล้วแก้ `sheetId` ใน `config.js` ถ้าใช้ไฟล์ Google Sheets ตัวใหม่



## v13.4 Audit Notes
- Backend output remains `08_Web_Ready!A4:K` and `09_Web_Packages!A4:L`.
- Frontend package builder now uses per-event package rows for better performance.
- Manifest includes 192/512 icons.
