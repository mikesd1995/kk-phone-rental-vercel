# KK Phone Rental Frontend v14.12 AUDITED FIX

## Deploy บน Vercel
1. อัปโหลดทั้งโฟลเดอร์นี้ขึ้น Vercel
2. ตั้ง Environment Variable แนะนำ:
   `GOOGLE_SHEET_ID=12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`
3. Deploy ใหม่

## สิ่งที่แก้ใน v14.12
- ปิด event modal แล้ว reset URL + title/meta/OG กลับหน้าแรก
- แก้ `eventUrl()` ไม่ให้พ่วง query/debug เดิมเข้า OG URL
- API proxy ไม่รับ `sheetId` จาก query แล้ว เพื่อลดโอกาสถูกใช้กับชีตอื่น
- API proxy มี default Sheet ID ทำให้เว็บไม่ล่มถ้ายังไม่ได้ตั้ง ENV
- เพิ่ม `X-Content-Type-Options: nosniff` ใน response API
- คงข้อความ LINE OA แบบสั้นตามที่กำหนด
- ยังดึง `use_case` จาก backend เท่านั้น ไม่มี `getSuitability()` hardcode ใน frontend
