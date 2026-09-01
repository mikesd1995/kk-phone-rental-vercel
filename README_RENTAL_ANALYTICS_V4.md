# KK Phone Rental — Rental Analytics V4: Talent Affiliation Primary

Owner clarification implemented: “ค่าย/ผู้จัด” ในเชิง Business Focus หมายถึง **สังกัดของนักแสดง/ศิลปินเป็นหลัก** ไม่ใช่ promoter ที่จัดงาน

Examples:
- GMMTV cast/event -> GMMTV
- DMD / FirstOne / NuNew -> Domundi / Mandee
- NCT / JNJM -> SM Entertainment
- BIGBANG / BABYMONSTER -> YG Entertainment
- TRINITY -> 4NOLOGUE

## Runtime files in this patch
- `admin/index.html`
- `admin/admin.js`
- `api/kk-rental-dashboard.js`

`admin/admin.css` is unchanged from V3 and is included only if present in the patch baseline; no public-site file is changed.

## Data priority
1. explicit talent affiliation field/note if present
2. `_Artist_Registry` from Machine SOT when accessible
3. conservative event-name mapping
4. Unknown

Event organizer/promoter is intentionally NOT used as primary affiliation.

## No Apps Script change
No Apps Script or public `/api/kk-data` changes are required.

## Rollback
Restore the previous three runtime files from the V3 commit.
