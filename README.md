# KK Phone Rental — Frontend v9.3 Booking Form

Static frontend สำหรับ deploy ผ่าน Vercel และใช้งานกับ Backend v9 โดยอ่านข้อมูลจากชีต `08_Web_Ready`

## สรุปเวอร์ชันนี้

v9.3 คือเวอร์ชันที่ต่อจาก v9.2 โดยเพิ่มฟอร์มก่อน redirect ไป LINE OA เพื่อให้ข้อความจองมีข้อมูลครบขึ้น:

- ชื่อเล่น
- เบอร์โทร
- เวลาที่สะดวกรับเครื่อง

ลูกค้าจะกดปุ่มจอง → กรอกข้อมูลสั้น ๆ → ระบบพาไป LINE OA พร้อมข้อความที่จัดรูปแบบให้อัตโนมัติ

## ไฟล์หลัก

```text
index.html
style.css
script.js
config.js
favicon.png
apple-touch-icon.png
vercel.json
```

## ตั้งค่า Google Sheet

เปิด `config.js` แล้วแก้เฉพาะจุดนี้ ถ้าใช้ชีตใหม่:

```js
SHEET_ID: "ใส่ Google Sheet ID ใหม่"
```

Google Sheet ต้องแชร์เป็น `Anyone with the link` และมีชีตชื่อ `08_Web_Ready`

## Backend v9 fields ที่ frontend ใช้

Frontend อ่านคอลัมน์หลักจาก `08_Web_Ready` เช่น:

- `event_id`
- `event_name`
- `event_date` / `event_date_text`
- `venue`
- `poster_image_url`
- `phone_model_display`
- `phone_price`, `lens_price`, `bundle_price`
- `show_lens_option`
- `available_phone_count`, `available_lens_count`
- `booking_status_for_web`
- `action_for_web`
- `line_message_template`
- `phone_only_available`, `phone_lens_available`
- `web_note`

## action_for_web ที่รองรับ

```text
show
show_phone_only
show_full
hide
```

## ข้อความ LINE ที่ระบบสร้าง

ข้อความจะมีข้อมูลประมาณนี้:

```text
สวัสดีค่ะ สนใจจองเช่ามือถือกับ KK Phone Rental
แพ็กเกจ: เครื่อง + Lens
ชื่องาน: ...
วันที่: ...
สถานที่: ...
รุ่น: ...
ชื่อเล่น: ...
เบอร์โทร: ...
เวลาที่สะดวกรับเครื่อง: ...

รบกวนคอนเฟิร์มคิวให้หน่อยค่ะ
```

## Deploy บน Vercel

1. แตก zip
2. อัปโหลดไฟล์ทั้งหมดเข้า GitHub repo
3. Deploy ผ่าน Vercel ได้เลย ไม่ต้องตั้ง build command

## หมายเหตุ

- `config.js` เป็นจุดแก้ Sheet ID / LINE OA / X เพียงจุดเดียว
- ค่า `HIDE_PAST_EVENTS: true` จะช่วยซ่อนงานที่เลยวันไปแล้วอีกชั้น
- ถ้ารูปโปสเตอร์โหลดไม่ได้ เว็บจะ fallback เป็นพื้นหลังสีแบรนด์และชื่อ event โดยไม่ทำให้ card พัง
- ฟอร์มจองตรวจชื่อเล่น เบอร์โทร และเวลารับเครื่องก่อนเด้งไป LINE OA


## V10 UI-Locked Note
ไฟล์ชุดนี้ล็อกหน้าตา/ข้อความหลักให้เหมือน Frontend v9.3 เดิม แต่เพิ่ม logic หลังบ้านสำหรับ Backend v10 เช่น lens-only, พ.ศ., Google Drive image fallback และ LINE message ที่สะอาดขึ้น
