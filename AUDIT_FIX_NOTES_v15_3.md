# KK Phone Rental v15.3 AUDITED OPTIMIZED

Static audit pass over frontend, admin CRM proxy, Apps Script backend and workbook contract.

## Main fixes
- Admin API route is no-store and no longer accepts PIN via query string.
- Vercel cache headers are now targeted: /api/kk-admin no-store, /api/kk-data short public cache.
- Frontend cache key bumped and TTL reduced to 90 seconds.
- Card availability now prioritizes package-level available_count so hidden/unavailable package types do not inflate counts.
- No-price package fallback shows “สอบถามราคา” instead of “ไม่ระบุ บาท/วัน”.
- Admin booking table prefers package_display if backend supplies it.
- Apps Script respects explicit rentable=FALSE even when asset status is available.
- Cleanup now archives event override rows for archived events to avoid orphan rows.
- Removed Apps Script Logger output of secret API key.
