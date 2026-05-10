# Changelog — Frontend v10 + Backend v10 Compatibility

## Updated from v9.3

- เพิ่ม flow สำหรับ `lens_only` / `show_lens_only`
- เพิ่มตัวกรองหน้าเว็บ “เหลือ Lens อย่างเดียว”
- ปุ่มจองรองรับ 4 กรณี: เครื่อง + Lens, เฉพาะเครื่อง, เฉพาะ Lens, waitlist
- แก้ข้อความ LINE ไม่ให้ซ้ำ `งาน/วันที่/แพ็กเกจ` จาก template หลังบ้าน
- เพิ่มการแปลงลิงก์รูปจาก Google Drive เป็น thumbnail URL ที่โหลดง่ายขึ้น
- เพิ่มการอ่านวันที่ พ.ศ. เช่น `17/05/2569` ให้แปลงเป็น `2026-05-17`
- เพิ่ม label รุ่น/อุปกรณ์ เพื่อแสดงทั้งมือถือและ Lens
- เพิ่ม fallback สำหรับ Backend v9 เดิม หากยังไม่มี column `lens_only_available` หน้าเว็บจะ infer จาก `show_lens_option + available_lens_count`

## Kept from v9.3

- อ่านข้อมูลจาก `08_Web_Ready`
- OpenSheet + Google CSV fallback
- Timeout 10 วินาที
- Lazy loading poster
- Booking modal ก่อน redirect LINE OA
- ฟอร์มชื่อเล่น / เบอร์โทร / เวลาที่สะดวกรับ
- ซ่อนงานที่วันผ่านมาแล้ว
