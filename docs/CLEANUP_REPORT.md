# Cleanup Report — v16.6.2_LINE_AUDITED

## ทำแล้ว

1. จัดโครงสร้าง package ให้ชัดเจน: root static, `/admin`, `/api`, `/apps-script`, `/docs`
2. เพิ่ม `README.md`, `.env.example`, `.gitignore`, และเอกสารโครงสร้างโปรเจกต์
3. อัปเดต version label ให้สอดคล้องกันใน frontend, admin, API proxy
4. แยก expected version ของ Vercel Proxy กับ Apps Script Backend ใน Admin Health Check
5. ปรับ Admin Overview ให้ใช้ `current_bookings` จาก backend v16.6 ถ้ามี เพื่อช่วยซ่อน booking ที่ cancelled/เลยวันจากหน้าปัจจุบัน
6. เพิ่ม `npm run check` สำหรับตรวจ syntax ของ JS หลักทุกไฟล์
7. ปรับ `api/kk-admin.js` ให้ตอบ error ชัดขึ้นเมื่อ JSON body ผิดรูปแบบ และหยุดอ่าน body เมื่อ request ใหญ่เกินกำหนด
8. รวม backend Apps Script ล่าสุดไว้ที่ `/apps-script/Code.gs` ถ้ามีใน workspace

## ไม่ได้เปลี่ยนเพื่อกันระบบพัง

- ไม่เปลี่ยนชื่อ API route เดิม
- ไม่ย้าย favicon/manifest/icons ออกจาก root
- ไม่ตัด fallback Sheet ID ออก เพราะเป็น emergency fallback ของเว็บเดิม
- ไม่ minify โค้ด เพื่อให้แก้ไขต่อในอนาคตง่าย

## คะแนนหลังจัดระเบียบ

- โครงสร้างไฟล์: 9/10
- ความพร้อม deploy: 9/10
- ความเสถียร Admin + Backend contract: 9/10
- สิ่งที่ควรทำต่อ: แยก `script.js` และ `admin.js` เป็น modules ในรอบใหญ่ถัดไป ถ้าจะ refactor แบบลึก
