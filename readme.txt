KK Phone Rental — Netlify Upload Package

วิธีอัปโหลดขึ้น Netlify
1) แตกไฟล์ ZIP นี้
2) ลากไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น Netlify Deploy
3) ไฟล์หลักต้องอยู่ระดับเดียวกัน:
   - index.html
   - style.css
   - script.js
   - favicon.png
   - apple-touch-icon.png

ปรับปรุงที่ทำให้แล้ว
- แยกไฟล์ HTML / CSS / JS พร้อมอัปโหลด Netlify
- เพิ่ม meta description ภาษาไทย
- เพิ่ม Open Graph สำหรับ LINE/Facebook
- เพิ่ม Twitter Card สำหรับ X
- ใช้รูปแบรนด์เดิมเป็น og:image
- เพิ่ม favicon และ apple-touch-icon
- เพิ่ม preconnect ให้ Google Fonts
- ปรับ title และ wording ให้ตรงกับหน้าเช็กคิว
- เอา inline onclick หลักออก และใช้ addEventListener ใน script.js
- เพิ่ม date validation กันวันที่ผิด เช่น 32/13/2026

หมายเหตุ
- ถ้า Netlify domain จริงไม่ใช่ https://kk-phone-rental.netlify.app/ ให้แก้ og:url ใน index.html เป็น URL จริงของเว็บ
- ถ้ามีรูป brand-image.png บน Netlify เอง แนะนำเปลี่ยน og:image/twitter:image เป็น URL เต็มของรูปนั้น
