# KK Phone Rental — Phase 3.9.5.5 Prepared Asset Reservation Fix

## Root cause
Public stock reservation and physical asset assignment are separate layers. Phase 3.9.5.4 correctly reduced public stock by active booking/package count, but older bookings could still have blank `phone_asset_id` / `lens_asset_id`. The quick action **เตรียมแล้ว** only changed `booking_status` to `prepared`; it did not backfill the missing physical Asset ID. The Asset master status therefore remained `available`, which means “equipment condition is rentable”, not “not booked on any date”.

## Fix
- When a booking moves to `prepared` or `picked_up`, Apps Script automatically assigns any required missing phone/lens Asset ID based on `package_type` and event date.
- Existing prepared/picked-up bookings with blank IDs get a **จัด Asset** action in Admin.
- Asset Center now shows a separate date-specific reservation column.
- Asset status is relabeled **สภาพอุปกรณ์** so `available` is not confused with date availability.
- Dashboard distinguishes “พร้อมใช้งาน” from “ถูกจัดให้ Booking”.

## Files changed
- `apps-script/Code.gs`
- `admin/admin.js`
- `admin/index.html`

## Deployment
1. Replace and deploy `apps-script/Code.gs` as a new Apps Script Web App version.
2. Replace `admin/admin.js` and `admin/index.html`, then redeploy Vercel.
3. For a booking already in `prepared` with blank Asset IDs, click **จัด Asset** once.
