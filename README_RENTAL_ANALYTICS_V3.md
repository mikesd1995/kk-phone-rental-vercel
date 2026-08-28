# Rental Analytics Integrated V3

ใช้ baseline จาก ZIP production ที่ผู้ใช้อัปโหลดโดยตรง

## อัปโหลด/ลงทับเพียง 4 ไฟล์
- admin/index.html
- admin/admin.js
- admin/admin.css
- api/kk-rental-dashboard.js

จากนั้น Deploy Vercel ตามปกติ แล้วเข้า URL เดิม `/admin/` > `รายงาน`

## เพิ่มอะไร
- ลูกค้าไม่ซ้ำ / Booking / Completed / Active / Repeat Rate
- เดือนที่คนเช่าเยอะ
- Top Events
- Package Mix / Status Mix
- Top ค่าย/ผู้จัด: unique customers, booking, จำนวนงาน, amount_received
- Organizer Coverage + Unknown count เพื่อไม่ให้สรุปเกินข้อมูล

## Organizer resolution
1. organizer/agency/label column ถ้ามีในอนาคต
2. Event Note tag เช่น `organizer: iMe`, `ผู้จัด: GMMTV`, `ค่าย: DOMUNDI`
3. conservative inference สำหรับชื่อ event ที่มั่นใจสูง เช่น GMMTV, DMD, BUS/SONRAY, 4EVE/XOXO, FortPeat/Me Mind Y, BTS/HYBE, &TEAM/HYBE Labels Japan, NCT/TEN/SM, GFEST/GMM SHOW
4. ที่เหลือแสดง Unknown ไม่เดา

## ไม่แตะ
- หน้า public index.html / script.js / style.css / config.js
- api/kk-data.js
- api/kk-admin.js
- Apps Script Code.gs
- Google Sheet schema / Booking / ราคา / Stock

## Failure isolation
ถ้า `/api/kk-rental-dashboard` โหลดไม่สำเร็จ จะขึ้น error เฉพาะกรอบ Rental Analytics ส่วน DCRM เดิมยัง render จาก `/api/kk-admin` ตามปกติ

## Rollback
คืน admin/index.html, admin/admin.js, admin/admin.css เป็นไฟล์ก่อน V3 และลบ api/kk-rental-dashboard.js หรือคืนเวอร์ชันก่อนหน้า แล้ว Deploy ใหม่
