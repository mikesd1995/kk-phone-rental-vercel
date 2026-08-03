# KK Phone Rental — Phase 3.9.5.7 Bulk Event Package Visibility Audit

## Purpose
เพิ่มการจัดการการแสดงแพ็กเกจแบบทั้งงานในหน้า Admin เพื่อไม่ต้องเลือกและบันทึกทีละแพ็กเกจ

## Changed files
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `apps-script/Code.gs`
- `api/kk-admin.js`

## New workflow
เมื่อเลือกงานในส่วน **แก้ราคาเฉพาะงาน** จะมี 3 ปุ่ม:
1. **ซ่อนทุกแพ็กเกจ** — ตั้ง `active_override = false` ให้ทุกแพ็กเกจหลักที่เปิดใช้งานของงานนั้น
2. **เปิดทุกแพ็กเกจ** — ตั้ง `active_override = true`
3. **ใช้สถานะจากแพ็กเกจหลัก** — ล้างเฉพาะ `active_override` ให้กลับไปใช้สถานะ Master

## Data safety
- ไม่ลบหรือแก้ `override_price`
- ไม่ลบ `override_note`
- ไม่ลบ `sort_order_override`
- ไม่ลบ `use_case_override`
- ไม่แก้ราคา/สถานะของงานอื่น
- ข้ามแพ็กเกจ G2 ที่เลิกใช้งาน
- ทำผ่าน API ครั้งเดียวเพื่อลดการกดซ้ำและลดโอกาส timeout

## Validation
- `node --check admin/admin.js` ผ่าน
- `node --check api/kk-admin.js` ผ่าน
- `Code.gs` คัดลอกเป็น `.js` แล้ว `node --check` ผ่าน
- ไม่พบ HTML id ซ้ำ
- ตรวจพบ route, backend function และ client action ครบ

## Deployment
### Google Apps Script
แทนที่ `apps-script/Code.gs` แล้ว Save → Deploy → Manage deployments → Edit → New version → Deploy

### Vercel
แทนที่:
- `admin/index.html`
- `admin/admin.js`
- `admin/admin.css`
- `api/kk-admin.js`

จากนั้น Redeploy และ Hard Refresh หน้า `/admin`
