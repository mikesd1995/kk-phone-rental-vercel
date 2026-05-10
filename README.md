# KK Phone Rental v7 — Frontend Optimized

Static frontend สำหรับอัปโหลดขึ้น GitHub และ deploy ผ่าน Vercel

## สิ่งที่ปรับใน v7

- เปลี่ยน Google Sheet หลังบ้านเป็นชีตใหม่: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`
- แยกค่าหลักไว้ใน `config.js`
- เพิ่ม filter หน้าเว็บ: ทั้งหมด / ว่าง / เต็ม / ใกล้ถึง
- เพิ่ม badge บนการ์ดงาน: ว่างกี่รุ่น / เต็มแล้ว / ใกล้ถึงวันงาน
- ปรับ empty state และ error state ให้ลูกค้าเข้าใจง่ายขึ้น
- Optimize รูปภาพ: header eager load, poster lazy load + async decode
- เพิ่ม canonical และปรับ social preview URL เป็น Vercel
- คง FAQ เวอร์ชันล่าสุดไว้แล้ว
- ลบหัวข้อยาวหน้า hero ตามคำขอล่าสุด เหลือเฉพาะขั้นตอนจอง + หมายเหตุ LINE OA

## โครงสร้างไฟล์

```text
index.html
style.css
script.js
config.js
favicon.png
apple-touch-icon.png
README.md
```

## วิธีใช้กับ GitHub + Vercel

1. แตกไฟล์ ZIP
2. อัปโหลดไฟล์ทั้งหมดเข้า GitHub repository
3. เชื่อม repo กับ Vercel
4. Deploy ได้เลย เพราะเป็น static site ไม่ต้อง build command

## การแก้ config หลัก

เปิดไฟล์ `config.js` แล้วแก้ค่าตามต้องการ เช่น Google Sheet, LINE OA, รูปหัวเว็บ

```js
window.KK_CONFIG = {
  sheetId: "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU",
  lineOAId: "@827blnmo",
  lineDirectUrl: "https://line.me/R/ti/p/%40827blnmo"
};
```

## หมายเหตุ Google Sheet

ต้องแชร์ Google Sheet เป็น Anyone with the link และมีชีตชื่อ:

- `concerts`
- `phones`


## สิ่งที่ตรวจและแก้เพิ่มในไฟล์ audited

- ลบ `README.txt` เดิมที่ยังพูดถึง Netlify เพื่อไม่ให้สับสนกับ GitHub/Vercel
- ปรับข้อความ visible ทั้งหมดจาก `Line OA` เป็น `LINE OA` ให้สม่ำเสมอ
- เพิ่มการอ่านค่า `headerImage`, `xUrl`, และลิงก์ LINE จาก `config.js` เพื่อให้แก้ข้อมูลหลักได้จากจุดเดียวมากขึ้น
- ตรวจ syntax ของ `script.js` และ `config.js` แล้วไม่พบ syntax error

## หมายเหตุสำคัญก่อน deploy

1. Google Sheet ต้องเปิดแชร์แบบ Anyone with the link/viewer
2. ต้องมี tab ชื่อ `concerts` และ `phones`
3. รูปจาก Google Drive ต้องเปิดสิทธิ์ให้ดูได้เช่นกัน ไม่อย่างนั้น header/poster อาจไม่ขึ้น
4. ถ้าโดเมน Vercel เปลี่ยน ให้แก้ `siteUrl` ใน `config.js` และ meta/canonical ใน `index.html` ให้ตรงกัน
