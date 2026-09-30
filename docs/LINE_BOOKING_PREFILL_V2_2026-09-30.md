# LINE booking prefill template v2 — 2026-09-30

Storefront booking deep links now prefill:
สนใจเช่ามือถือ
🎫 งาน: <event>
📅 วันที่: <date>
📍 สถานที่: <venue>
📱 รุ่น: <model>
💰 ราคา: <display price>
⏰ เวลาที่สะดวกรับอุปกรณ์:
👤 ชื่อเล่น:
📞 เบอร์โทร:

Price is included for customer clarity when multiple models/packages have different prices. It is display/reference data only; canonical price remains backend/SOT responsibility and must be revalidated before any booking write. Webhook parsing remains backward-compatible with the prior package-first message and old pickup label. No Booking, inventory, pricing, or Sheet write path is changed.
