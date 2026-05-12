# KK Phone Rental v15.7 LINK + BOOKING AUDIT FIX

วันที่แพตช์: 2026-05-13

## แก้หลัก
- แก้เคสสร้างงานใหม่แล้ววาง Google Drive link เอง: Admin และ Apps Script จะ normalize เป็น `https://drive.google.com/thumbnail?id=...&sz=w1200` ก่อนบันทึกลง `01_Events!E`
- ถ้าเผลอวางลิงก์โฟลเดอร์ Google Drive ระบบจะแจ้ง error ชัดเจน ไม่บันทึกแบบเงียบ ๆ
- หน้าเว็บลูกค้าอ่าน Drive link ได้ robust ขึ้น ทั้ง `/file/d/`, `open?id=`, `uc?id=`, `thumbnail?id=`, `lh3.googleusercontent.com/d/` และ raw file ID
- ลด cache หน้าเว็บจาก 90s เป็น 30s และเปลี่ยน cache key เป็น v15.7 เพื่อให้ event ใหม่เห็นไวขึ้นหลัง deploy
- ปรับ Booking ล่าสุดตามลำดับคอลัมน์: วันที่งาน, ชื่อลูกค้า, เบอร์โทร, ชื่องาน, แพ็กเกจ, Phone, Lens, สถานะ, วันที่บันทึก
- Backend snapshot คืนค่า `package_display` เป็นชื่อแพ็กเกจจาก `03_Packages` แทนการโชว์แค่ `package_type` เมื่อ match ได้

## ต้องอัปเดต
1. อัป frontend v15.7 ขึ้น GitHub/Vercel
2. วางไฟล์ Apps Script v15.7 ทับใน Apps Script
3. วาง `appsscript.json` ตามแพ็กเกจเดิม ถ้ายังไม่ได้ตั้ง Drive scope
4. Deploy Apps Script เป็น New version
5. Redeploy Vercel
