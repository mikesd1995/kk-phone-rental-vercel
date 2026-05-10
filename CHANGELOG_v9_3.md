# Changelog — Frontend v9.3 Booking Form

## Added from v9.2

- เพิ่ม modal/form ก่อน redirect ไป LINE OA
- เพิ่มช่อง `ชื่อเล่น`, `เบอร์โทร`, `เวลาที่สะดวกรับเครื่อง`
- เปลี่ยนปุ่มจองจาก direct LINE link เป็นปุ่มเปิดฟอร์ม เพื่อกันลูกค้าส่งข้อความไม่ครบ
- เพิ่ม validation เบื้องต้นก่อนส่งไป LINE OA
- เพิ่มข้อความ LINE ที่ใส่ข้อมูลลูกค้าและแพ็กเกจให้อัตโนมัติ
- รองรับทั้ง `จองเครื่อง + Lens`, `จองเฉพาะเครื่อง`, และ `waitlist`
- เพิ่ม CSS สำหรับ booking modal ทั้ง desktop และ mobile

## Kept from v9.2

- Normalize `action_for_web`
- Fetch timeout 10 วินาที
- Fallback จาก OpenSheet ไป Google CSV
- Lazy load poster images
- Poster fallback เมื่อรูปเสีย
- Security headers ใน `vercel.json`
- Compatibility กับ Backend v9 / `08_Web_Ready`
