# KK Phone Rental V10 UI-Locked Audit

ชุดนี้แก้จาก V10 ก่อนหน้าให้คงหน้าตา Frontend v9.3 เดิมมากที่สุด

## สิ่งที่ตั้งใจคงเดิม
- `index.html` ใช้จาก v9.3 เดิม
- `style.css` ใช้จาก v9.3 เดิม
- layout, hero text, filter dropdown, FAQ, modal wording หลัก คงเดิม

## สิ่งที่อัปเกรดเฉพาะ logic
- รองรับ `lens_only_available` และปุ่ม “จองเฉพาะ Lens” เมื่อหลังบ้านส่งข้อมูลมา
- รองรับ `action_for_web = show_lens_only / lens_only`
- รองรับวันที่ พ.ศ. เช่น 17/05/2569
- แปลง Google Drive image URL เป็น thumbnail URL ให้อัตโนมัติ
- ปรับ LINE message ไม่ให้ซ้ำข้อมูลจาก template
- คง fallback OpenSheet → Google CSV เหมือนเดิม

## หมายเหตุ
ถ้าต้องการให้มีตัวกรอง “เหลือ Lens อย่างเดียว” จะต้องเพิ่ม option ใน `index.html` ซึ่งจะทำให้หน้าตาไม่เหมือน v9.3 เดิม 100% จึงยังไม่ใส่ไว้ในชุดนี้
