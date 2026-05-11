# Lean Change Log v13.4

## Backend

- `01_Events` ลดจาก 16 คอลัมน์เหลือ 9 คอลัมน์
- `02_Assets` ลดข้อมูลซ้ำ เหลือ asset-level fields เท่านั้น
- `03_Packages` เปลี่ยนเป็น package template กลาง
- เพิ่ม `04_Event_Overrides` สำหรับกรณีราคา/โน้ต/เปิดปิดต่างจากมาตรฐาน
- `08_Web_Ready` ลดเหลือ event output 11 คอลัมน์
- เพิ่ม `09_Web_Packages` เป็น package output ที่ frontend อ่าน

## Frontend

- เปลี่ยน `webRange` เป็น `A4:K`
- เปลี่ยน `pkgSheetName` เป็น `09_Web_Packages`
- เปลี่ยน `pkgRange` เป็น `A4:L`
- `script.js` รองรับ header ใหม่ เช่น `price`, `package_status`, `model_display`, `lens_display`
