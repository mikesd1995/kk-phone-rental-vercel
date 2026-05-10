KK Phone Rental — Vercel Upload Package (v5 Backend Ready)

ไฟล์นี้ปรับหน้าบ้านให้ใช้หลังบ้าน Google Sheet v5 แล้ว

Google Sheet ID ที่ใช้:
1-kFC6v0cRmLnGAq3J0FRVQ3Ua65fXwrFvr_BYGBLVbQ

เว็บ Vercel ที่ตั้งค่าใน meta preview:
https://kk-phone-rental.vercel.app/

โครงสร้างที่โค้ดอ่าน:
1) ชีต Web_Ready
   - ใช้เป็นข้อมูลหลักสำหรับหน้าเว็บ
   - โค้ดอ่านช่วง A4:U เพราะไฟล์ v5 มีหัวตารางจริงอยู่แถว 4
   - คอลัมน์สำคัญ: event_id, event_name, event_date, venue, active_on_web, phone_model, phone_price, lens_price, bundle_price, available_phone_count, booking_status_for_web, action_for_web, line_message_template

2) ชีต Events
   - ใช้เสริมสำหรับรูป poster_image_url, hashtag, venue และข้อมูล metadata
   - โค้ดอ่านช่วง A4:P

สิ่งที่ต้องตั้งค่าใน Google Sheet:
- Share เป็น Anyone with the link = Viewer
- อย่าเปลี่ยนชื่อชีต Web_Ready และ Events
- อย่าเปลี่ยนหัวคอลัมน์แถว 4 ถ้าไม่จำเป็น
- งานที่ต้องการให้เว็บแสดง ให้ตั้ง active_on_web = TRUE และ action_for_web = show
- ถ้าไม่อยากให้แสดง ให้ action_for_web = hide

วิธีอัปเดต Vercel:
1) แตก ZIP นี้
2) อัปโหลดไฟล์ทั้งหมดทับของเดิมใน GitHub repo
3) กด Commit changes
4) Vercel จะ deploy ใหม่ให้อัตโนมัติ

ไฟล์หลัก:
- index.html
- style.css
- script.js
- favicon.png
- apple-touch-icon.png
