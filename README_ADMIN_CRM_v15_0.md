# KK Phone Rental v15.0 Admin CRM Starter

## ใช้อะไรได้แล้ว

หน้า `/admin` ทำได้:

- ดูภาพรวมงาน / booking / asset / health check
- เพิ่ม Booking โดย auto assign มือถือ/เลนส์ และเช็กจองซ้ำด้วย Apps Script LockService
- เพิ่มงานใหม่ และใส่ Poster URL
- อัปโหลด Poster เข้า Google Drive ได้ ถ้าตั้ง `KK_POSTER_FOLDER_ID` ใน Apps Script แล้ว
- แก้งานเดิม เช่น ชื่อ วันที่ สถานที่ รูป สถานะ เปิด/ปิดหน้าเว็บ
- เพิ่มแพ็กเกจ/ราคา/use_case
- แก้ราคา/ข้อความแพ็กเกจ
- เพิ่มมือถือ/เลนส์หลายรายการทีเดียว

## ตั้งค่า Vercel Environment Variables

```text
GOOGLE_SHEET_ID=12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU
KK_ADMIN_SCRIPT_URL=Apps Script Web App URL ที่ลงท้ายด้วย /exec
KK_ADMIN_API_KEY=key ที่สร้างจาก Google Sheet menu
KK_ADMIN_PIN=PIN ที่ใช้เข้า /admin
```

## URL ใช้งาน

```text
Public website: /
Admin CRM: /admin
```

## หมายเหตุสำคัญ

- ห้ามเปิดเผย `KK_ADMIN_API_KEY` ใน frontend ตรง ๆ ให้ใส่ใน Vercel ENV เท่านั้น
- หน้า `/admin` ใช้ PIN กันชั้นหนึ่ง และ API key ถูกแนบในฝั่ง Vercel proxy
- ถ้าอัปโหลดรูปไม่ได้ ให้ตั้ง Folder ID จากเมนู Google Sheet: `KK Admin > CRM: Set Poster Folder ID`
- ถ้าใช้ Poster URL ตรง ๆ ไม่ต้องตั้ง Folder ID ก็ได้
