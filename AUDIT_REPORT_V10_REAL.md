# Audit Report — KK Phone Rental V10 from Real Files

ตรวจจากไฟล์จริงที่ส่งมา:

- Backend: `KK Phone rental backend v9.xlsx`
- Frontend: `KK_Frontend_v9_3_Booking_Form_Backend_v9.zip`

## สิ่งที่เจอและแก้แล้ว

| Area | Issue Found | Fix in V10 | Risk Removed |
|---|---|---|---|
| Lens-only rental | Frontend v9.3 ยังไม่มีปุ่ม `จองเฉพาะ Lens` แม้ backend มี `lens_only` ใน Settings | เพิ่ม `show_lens_only`, `lens_only_available`, ปุ่มจองเฉพาะ Lens | ไม่พลาดรายได้กรณีปล่อย Lens อย่างเดียว |
| Backend model warning | `04_Bookings!AB` เดิมมองว่าถ้าไม่มี phone = warning เสมอ ทำให้ lens_only โดน `No phone selected` | แก้ formula ให้ lens_only ไม่ต้องมี phone และเช็ก lens mismatch แยก | ลด false warning ใน booking |
| Web status logic | `08_Web_Ready` เดิมถ้า phone หมดจะขึ้นเต็ม แม้ Lens ยังว่าง | เพิ่มสถานะ “เหลือ Lens อย่างเดียว” | หน้าเว็บไม่ซ่อน Lens ที่ยังปล่อยเช่าได้ |
| LINE message | `line_message_template` เดิมมีงาน/วันที่อยู่แล้ว ทำให้ frontend ใส่ซ้ำ | Backend template เหลือ greeting, frontend build message กลาง | ข้อความ LINE อ่านง่ายขึ้น |
| Today work sheet | `09_Today_Work` มี `Excel/Sheets conversion wrapper` ทำให้เห็น `formula-name error` ใน Excel บางกรณี | เขียนสูตรใหม่โดยตรง | ลดปัญหาสูตรเสียตอนแปลงไฟล์ |
| Date parsing | Frontend ไม่แปลงปี พ.ศ. | เพิ่ม BE year conversion | ซ่อน/เรียงวันไม่ผิด |
| Google Drive image | รูป Drive share link อาจไม่แสดงใน `<img>` | แปลงเป็น Drive thumbnail URL | รูปโปสเตอร์ขึ้นง่ายขึ้น |
| Customer-facing error | ตรวจแล้วไม่มีข้อความบอกลูกค้าเรื่อง Google Sheet/backend setup | คง copy ที่ให้ทัก LINE OA | ไม่เปิดเผยหลังบ้านให้ลูกค้าเห็น |

## Deployment note

ใช้ไฟล์ Frontend v10 กับ Backend v10 นี้คู่กันได้เลย โดยยังอ่านจากชีต `08_Web_Ready` เหมือนเดิม ไม่ต้องสร้าง Apps Script เพิ่ม
