# KK Phone Rental — Frontend v11

Static frontend สำหรับ deploy ผ่าน Vercel และใช้งานกับ Backend v11 / Backend v9 structure โดยอ่านข้อมูลจากชีต `08_Web_Ready`

## จุดสำคัญของ V10

- รองรับเช่า **เฉพาะ Lens**
- รองรับเช่า **เฉพาะเครื่อง**
- รองรับเช่า **เครื่อง + Lens**
- รองรับ **waitlist / ถามรอบหลุด**
- ฟอร์มก่อน redirect ไป LINE OA มี:
  - ชื่อเล่น
  - เบอร์โทร
  - เวลาที่สะดวกรับอุปกรณ์

## ตั้งค่า Google Sheet

เปิด `config.js` แล้วแก้เฉพาะจุดนี้ ถ้าใช้ชีตใหม่:

```js
SHEET_ID: "ใส่ Google Sheet ID ใหม่"
```

Google Sheet ต้องแชร์เป็น `Anyone with the link` และมีชีตชื่อ `08_Web_Ready`

## Backend fields ที่ frontend ใช้

Frontend อ่านคอลัมน์หลักจาก `08_Web_Ready` เช่น:

- `event_id`
- `event_name`
- `event_date` / `event_date_text`
- `venue`
- `poster_image_url`
- `phone_model_display`
- `allowed_lens_group`
- `phone_price`, `lens_price`, `bundle_price`
- `show_lens_option`
- `available_phone_count`, `available_lens_count`
- `booking_status_for_web`
- `action_for_web`
- `line_message_template`
- `phone_only_available`, `phone_lens_available`, `lens_only_available`
- `web_note`

ถ้า backend ยังไม่มี `lens_only_available` หน้าเว็บจะ infer จาก `show_lens_option` และ `available_lens_count` ให้เอง

## action_for_web ที่รองรับ

```text
show
show_phone_only
show_lens_only
show_full
hide
```

## Deploy บน Vercel

1. แตก zip
2. อัปโหลดไฟล์ทั้งหมดเข้า GitHub repo
3. Deploy ผ่าน Vercel ได้เลย ไม่ต้องตั้ง build command

## หมายเหตุ

- V10 ชุดนี้ไม่ต้องใช้ Apps Script เพราะ frontend ยังอ่านจาก Google Sheet โดยตรงผ่าน OpenSheet + Google CSV fallback
- ถ้ารูปโปสเตอร์เป็น Google Drive share link ระบบจะแปลงเป็น thumbnail URL ให้อัตโนมัติ
- ข้อความ error ฝั่งลูกค้าไม่พูดถึงหลังบ้าน/Google Sheet setup
