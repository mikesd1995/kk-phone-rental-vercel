# KK Phone Rental v7.2 — Frontend for Backend v10.1 Clean Final

Static frontend สำหรับอัปโหลดขึ้น GitHub และ deploy ผ่าน Vercel

## ใช้กับ Google Sheet ตัวนี้

- Sheet ID: `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`
- แท็บที่หน้าเว็บอ่าน: `08_Web_Ready และ fallback จาก 01_Events`
- ช่วงข้อมูลที่อ่าน: `A4:AA`

ไฟล์ backend มีแถวหัวข้อ/คำอธิบายอยู่ด้านบน ดังนั้น frontend เวอร์ชันนี้จะอ่านผ่าน Google Visualization CSV โดยกำหนด `range=A4:AA` เพื่อให้เริ่มอ่านจากแถว header จริงของ `08_Web_Ready และ fallback จาก 01_Events` โดยตรง

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

เปิดไฟล์ `config.js` แล้วแก้ค่าหลักได้ เช่น Google Sheet, LINE OA, รูปหัวเว็บ

```js
window.KK_CONFIG = {
  siteUrl: "https://kk-phone-rental.vercel.app/",
  sheetId: "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU",
  webSheetName: "08_Web_Ready และ fallback จาก 01_Events",
  webRange: "A4:AA",
  lineOAId: "@827blnmo",
  lineDirectUrl: "https://line.me/R/ti/p/%40827blnmo",
  xUrl: "https://x.com/KK_PhoneRental",
  headerImage: "https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600"
};
```

## คอลัมน์หลักที่หน้าเว็บใช้จาก `08_Web_Ready และ fallback จาก 01_Events`

- `event_id`
- `event_name`
- `event_date_text` / `event_date`
- `venue`
- `active_on_web`
- `poster_image_url`
- `phone_model_display`
- `phone_price`
- `lens_price`
- `bundle_price`
- `available_phone_count`
- `available_lens_count`
- `phone_only_available`
- `lens_only_available`
- `phone_lens_available`
- `booking_status_for_web`
- `action_for_web`
- `line_message_template`
- `web_note`
- `data_health`

## หมายเหตุสำคัญก่อน deploy

1. Google Sheet ต้องเปิดแชร์แบบ Anyone with the link / Viewer
2. รูปใน `poster_image_url` ต้องเป็น URL ที่เข้าถึงได้ และไฟล์ Google Drive ต้องแชร์แบบ Anyone with the link / Viewer
3. ถ้าโดเมน Vercel เปลี่ยน ให้แก้ `siteUrl` ใน `config.js` และ meta/canonical ใน `index.html` ให้ตรงกัน
4. หลังแก้ข้อมูลใน Google Sheet อาจต้องรอ cache ของ Google สั้น ๆ แล้ว refresh หน้าเว็บ


## v7.3 image fallback update
- หน้าเว็บอ่าน 08_Web_Ready เป็นหลัก และอ่าน 01_Events เป็น fallback ตาม event_id
- ถ้า poster_image_url ใน 08_Web_Ready ว่าง แต่ 01_Events มีรูป เว็บจะยังดึงรูปได้
- รองรับ Google Drive URL ทั้งแบบ /file/d/..., thumbnail?id=..., uc?id=... และ lh3.googleusercontent.com/d/...
- ระบบลองโหลดรูปสำรอง 3 แบบอัตโนมัติ: drive thumbnail, lh3, และ uc export view
