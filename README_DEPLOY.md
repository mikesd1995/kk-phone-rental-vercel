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
- `09_Web_Packages!A4:N`
- คอลัมน์ M = `raw_available_count`

## Note

ห้ามใช้ `v14.6_LEAN` เป็นฐานต่อ เพราะเวอร์ชันนั้นลีนแรงเกินไปและ rewrite DOM/script เยอะ ทำให้หน้าบ้านเสี่ยงล่ม


## v14.9 BACKEND DRIVEN PATCH
- Frontend ไม่เดาข้อความ `เหมาะกับ:` เองแล้ว
- ถ้าต้องการแสดงข้อความ use case ให้กรอกที่ Backend: `03_Packages!J:J use_case` หรือ override เฉพาะงานที่ `04_Event_Overrides!G:G use_case_override`
- `09_Web_Packages` ใช้ช่วง `A4:N` โดยคอลัมน์ N = `use_case`
- ถ้า use_case ว่าง หน้าเว็บจะไม่แสดงบรรทัดนี้เลย
- แก้ปุ่มปิด modal / FAQ ให้กดปิดได้ชัวร์ขึ้น
- ปรับ font หลักเป็น Noto Sans Thai + Kanit fallback เพื่อให้ตัวหนังสือไทยอ่านง่ายขึ้น


## v14.9 Stable Fix

- เพิ่มปุ่มปิดแบบ X ด้านบนให้ modal และ FAQ
- แก้ event ปิด modal ให้จับแบบ capture-phase เพื่อกันเคสคลิกแล้วไม่ปิดบนมือถือ/LINE browser
- ปรับ font rendering ให้ไทยอ่านง่ายขึ้น และลดการ synthesize น้ำหนักฟอนต์
- ข้อความ `เหมาะกับ` ยังดึงจาก backend `09_Web_Packages!N` เท่านั้น ถ้าช่องว่างจะไม่แสดง
