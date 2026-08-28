# KK Phone Rental — SAFE Rental Analytics V2

เวอร์ชันนี้ออกแบบจากไฟล์ production ZIP ที่ผู้ใช้ส่งมาโดยตรง และตั้งใจให้ “ไม่ชนของเก่า” มากที่สุด

## หลักการ
- เพิ่มไฟล์ใหม่ 4 ไฟล์เท่านั้น
- ไม่แก้ `index.html`, `script.js`, `style.css`, `config.js`
- ไม่แก้ `admin/index.html`, `admin/admin.js`, `admin/admin.css`
- ไม่แก้ `api/kk-admin.js` หรือ `api/kk-data.js`
- ไม่แก้ `apps-script/Code.gs`
- ไม่เปลี่ยน Google Sheet schema / สูตร / Booking / Asset / Price
- API ใหม่เป็น READ ONLY และคืนเฉพาะ aggregate metrics ไม่มี PII ลูกค้ารายบุคคล

## อัปโหลดไฟล์เหล่านี้โดยรักษา path
- `admin/rental-analytics.html`
- `admin/rental-analytics.css`
- `admin/rental-analytics.js`
- `api/kk-rental-dashboard.js`

จากนั้น Deploy Vercel ตามปกติ แล้วเปิด:
`https://kk-phone-rental.vercel.app/admin/rental-analytics.html`

ใช้ Admin PIN เดียวกับ DCRM เดิม

## ไม่ต้องทำ
- ไม่ต้องแก้ Apps Script
- ไม่ต้อง Deploy Apps Script
- ไม่ต้องแก้ Vercel ENV ถ้าระบบ Admin เดิมใช้งานอยู่แล้ว (`KK_ADMIN_PIN`, `GOOGLE_SHEET_ID` มีอยู่แล้ว)
- ไม่ต้องแก้หน้า public

## ทำไมไม่กระทบหน้า public
หน้า public ปัจจุบันอ่าน `/api/kk-data` + `08_Web_Ready/09_Web_Packages` ส่วนไฟล์ชุดนี้ใช้ endpoint ใหม่ `/api/kk-rental-dashboard` เท่านั้น จึงไม่เปลี่ยน request path หรือ logic ของ public site

## Rollback
ลบ 4 ไฟล์ข้างต้นแล้ว Deploy ใหม่ ระบบเดิมจะกลับเหมือนก่อนติดตั้งทันที เพราะไม่มีไฟล์เดิมถูกแทนที่

## Optional: ปุ่มใน DCRM
ยังไม่รวม patch เมนูไว้ใน SAFE package เพื่อให้ deployment แรกเป็น zero-overwrite จริง หากหน้า analytics ทำงานแล้ว ค่อยเพิ่มปุ่ม sidebar ภายหลังได้
