# Changelog — Frontend v11

## แก้ไขจาก v10

### index.html
- เพิ่ม `rel="noopener noreferrer"` ครบทุก external link (v10 มีเฉพาะ `noopener`)
- ย้าย `role="dialog"` และ `aria-modal="true"` ไปอยู่บน `.booking-modal` div แทน `.booking-panel` section ที่ถูกต้อง
- เปลี่ยน `<form id="bookingForm">` → `<div id="bookingForm">` + `<button type="button" id="bookingSubmitBtn">` เพื่อป้องกัน Enter key trigger submit โดยไม่ตั้งใจ
- เพิ่ม `inputmode="numeric"` บน phone field (ก่อนหน้า `inputmode="tel"`) เพื่อให้ keyboard มือถือขึ้นตัวเลขล้วน
- เพิ่ม `aria-live="assertive"` บน `#bookingFormError`

### script.js
- **Retry logic**: หาก fetch ล้มเหลวครั้งแรก จะ retry อีก 1 ครั้งใน 3 วินาที ก่อนแสดง error
- **waitlist button**: แสดงปุ่ม "ถามรอบหลุด" สำหรับ `show_full` ด้วย (v10 แสดงเฉพาะ `show_phone_only` / `show_lens_only`)
- **Phone validation**: normalize `+66` → `0xx` ก่อน count digits
- **safeUrl**: รับทั้ง `https:` และ `http:` แทนที่จะปฏิเสธ `http:` (future-proofing สำหรับ local dev)
- **escapeHTML**: ย้ายเป็น top-level constant (minor perf)
- **lensLabel**: เพิ่ม alias `ZEISS_3_2X`
- **DOM**: ใช้ `DocumentFragment` ใน render() เพื่อลด reflow
- **img**: เพิ่ม `width` / `height` attribute เพื่อลด CLS
- **error box focus**: เมื่อ validation error ให้ focus `#bookingFormError` เพื่อ accessibility
- **closeBookingModal**: reset `selectedBooking = null` ก่อน `modal.hidden = true`
- **statusBadge**: ใช้ object map แทน if-chain

### style.css
- `*, *::before, *::after` แทน `*` เพื่อ box-sizing ครบ pseudo-elements
- `.btn`: เพิ่ม `font-family: inherit` และ `font-size: 1rem` ป้องกัน browser default
- `.btn:active`: เพิ่ม transform reset
- `.poster`: เพิ่ม `contain: layout` ลด CLS
- `.booking-backdrop`: เพิ่ม `cursor: pointer` ให้ชัดเจน
- `.booking-summary span`: เพิ่ม `flex-shrink: 0` ป้องกัน label ถูก shrink
- ลบ `.btn-danger` ที่ไม่ได้ใช้แล้ว

## ไม่มีการเปลี่ยน config.js, vercel.json, favicon, icons
## Compatible กับ Backend v10 เหมือนเดิม
