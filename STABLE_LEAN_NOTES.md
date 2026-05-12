# Stable Lean Notes

สิ่งที่แก้จาก v14.6:

- rollback โครงสร้าง `index.html`, `style.css`, `script.js` กลับไปใช้ฐาน v14.5 ที่ตรงกับ frontend เดิมของผู้ใช้
- ไม่ rewrite DOM id ใหม่
- ไม่ตัด block UI/FAQ/modal ที่ script เดิมอ้างอยู่
- คง Vercel proxy `api/kk-data.js`
- คง mapping `09_Web_Packages!A4:N` สำหรับ backend v14.9
- ลีนเฉพาะไฟล์ที่ไม่เกี่ยวกับการ deploy เช่น audit/changelog/apps script archive
