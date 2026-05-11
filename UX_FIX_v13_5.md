# v13.5 UX Fix

แก้ปัญหา modal รายละเอียดงานใหญ่เกินไปและแสดงรูปโปสเตอร์ซ้ำเมื่อกดการ์ดงาน

## Changes
- Removed modal poster from `index.html`
- Removed modal poster injection logic from `script.js`
- Added compact modal override CSS in `style.css`
- Bumped frontend cache key from `v13_4` to `v13_5`

## Result
- Poster remains visible on event cards only
- Event detail modal is narrower and shorter on desktop
- Modal layout is more compact on mobile
