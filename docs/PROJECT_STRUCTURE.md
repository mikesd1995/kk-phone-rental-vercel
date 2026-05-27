# Project Structure — v16.6.2_LINE_AUDITED

## Runtime files ที่ Vercel ต้องใช้

- `/index.html`, `/style.css`, `/script.js`, `/config.js` — หน้าเว็บลูกค้า
- `/admin/index.html`, `/admin/admin.css`, `/admin/admin.js` — หน้า Admin CRM
- `/api/kk-data.js` — proxy อ่าน Google Sheets สำหรับหน้าบ้าน
- `/api/kk-admin.js` — proxy เขียน/อ่าน Admin ผ่าน Apps Script
- `/vercel.json` — headers และ route rewrite `/admin`

## Backend

- `/apps-script/Code.gs` คือโค้ด Apps Script ที่ต้อง copy ไปวางใน Google Apps Script แยกต่างหาก
- ไฟล์นี้ไม่ถูก run บน Vercel แต่เก็บไว้ใน package เพื่อให้ง่ายต่อการ version control

## Docs

- `/docs/CLEANUP_REPORT.md` — สรุปสิ่งที่ปรับ
- `/docs/PROJECT_STRUCTURE.md` — โครงสร้างไฟล์นี้

## สิ่งที่ยังคงไว้เพื่อไม่ให้ลิงก์เดิมพัง

- `/admin` ยัง rewrite ไป `/admin/index.html`
- `/api/kk-data` และ `/api/kk-admin` ยังใช้ชื่อเดิม
- favicon/icon/manifest ยังอยู่ root เพื่อรองรับ browser/PWA เดิม
