# Changelog v9

## Backend compatibility
- Reads `08_Web_Ready` only.
- Supports `action_for_web` values: show, show_phone_only, show_full, hide.
- Supports phone/lens availability counts from Backend v9.

## Customer UX
- Shows "เหลือเครื่องอย่างเดียว" when lens is unavailable but phone is still available.
- Provides separate LINE buttons for:
  - เครื่อง + Lens
  - เฉพาะเครื่อง
  - waitlist / รอบหลุด

## Reliability
- Uses OpenSheet first.
- Falls back to Google Visualization CSV if OpenSheet fails.
- Shows customer-safe error text: "ลองรีเฟรชอีกครั้ง หรือสอบถามผ่าน LINE OA".
