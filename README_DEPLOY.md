# KK Phone Rental Frontend v14.6 LEAN

ชุดนี้ลีนจาก frontend เดิมของร้าน และปรับให้เข้ากับ Google Sheet Backend v14.4/v14.6 contract

## ไฟล์ที่ต้องใช้จริงบน Vercel

- `index.html`
- `style.css`
- `script.js`
- `config.js`
- `api/kk-data.js`
- `package.json`
- `vercel.json`
- `manifest.json`
- icon files

## Google Sheet ID ที่ตั้งไว้แล้ว

```txt
12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU
```

## แนะนำตอนอัป Vercel

ตั้ง Environment Variable เพิ่มด้วย เพื่อให้ proxy ใช้ ID จากฝั่ง server:

```txt
GOOGLE_SHEET_ID=12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU
```

ถ้าไม่ตั้ง ENV ระบบยังใช้ default Sheet ID ใน `api/kk-data.js` และ `config.js` ได้

## Backend ranges

- `08_Web_Ready!A4:K`
- `09_Web_Packages!A4:M`

คอลัมน์ M คือ `raw_available_count` สำหรับตรวจ overbooking/stock ติดลบ โดย frontend จะไม่เปิดให้จอง package ที่ raw count ติดลบ

## Debug URL

- `?debug=1` ไม่ใช้ session cache
- `?direct=1` bypass Vercel API แล้วอ่าน Google Sheet ตรง
- `?showPast=1` แสดงงานย้อนหลัง
- `?event=EVENT_ID` เปิด modal งานนั้นอัตโนมัติ
