# KK Phone Rental Frontend v14.7 STABLE LEAN

เวอร์ชันนี้เป็น **stable lean**: ยึด frontend เดิมที่ใช้งานได้จริง แล้วลีนเฉพาะไฟล์รก/ไฟล์เอกสาร/ไฟล์ Apps Script ที่ไม่ควรอยู่ในโปรเจกต์ frontend ออก

## ไฟล์ที่ต้องอัปขึ้น Vercel

- `index.html`
- `style.css`
- `script.js`
- `config.js`
- `manifest.json`
- `package.json`
- `vercel.json`
- `api/kk-data.js`
- รูป icon ทั้งหมด

## Environment Variable แนะนำบน Vercel

```text
GOOGLE_SHEET_ID=12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU
```

ใน `config.js` ก็ใส่ Sheet ID นี้เป็น fallback แล้ว ถ้าลืมตั้ง ENV เว็บยังพยายามอ่านจาก fallback ได้

## Backend contract

- `08_Web_Ready!A4:K`
- `09_Web_Packages!A4:M`
- คอลัมน์ M = `raw_available_count`

## Note

ห้ามใช้ `v14.6_LEAN` เป็นฐานต่อ เพราะเวอร์ชันนั้นลีนแรงเกินไปและ rewrite DOM/script เยอะ ทำให้หน้าบ้านเสี่ยงล่ม
