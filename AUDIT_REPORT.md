# KK Phone Rental v13.2 Audit Report

## Fixed immediately

1. **Backend package event_id typo** — `03_Packages` rows for ANNYEONG used `EVT-20260517-ANNYE`, which did not match any row in `01_Events`. Fixed to `EVT-20260517-ANNYEONG`.
2. **Frontend package parser bug** — `script.js` expected machine headers (`pkg_type`, `phone_model_display`), but the workbook exports Thai/newline headers. Added `normalizePkgRow()` with aliases and positional fallback.
3. **Wrong “available unit” count** — frontend counted package choices instead of actual phone units, so 1 phone with 2 package options could show “2 เครื่อง”. Fixed to use `available_phone_count` first.
4. **Dashboard row limit bug** — formulas only scanned rows 5:154. Expanded to 5:1000.
5. **Asset availability bug** — `reserved` and `rented` assets were still counted as rentable. `rentable_now` now requires status `available`, and stock formulas use the helper.
6. **Archive automation safety** — old script deleted Master rows and appended after formula placeholder rows. New script copies values to archive and clears only editable input columns `B:T`.
7. **PWA shortcut bug** — manifest used `?filter=available`, but script ignored filter URL param. Fixed.
8. **Site URL mismatch** — updated static canonical/OG/config URL to Netlify production URL.

## Needs owner confirmation

- `01_Events` row for ANNYEONG has `event_id` containing `20260517` while `event_date_text` is `16/05/2026`. I did not change this business date because it may be intentional or copied from a future campaign. Confirm before publishing.

## Not done because Phase 2

- Server-side booking lock / Apps Script API layer / online booking form with LockService.
- LINE Messaging API automation.
