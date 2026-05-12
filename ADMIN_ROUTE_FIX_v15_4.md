# v15.4 Admin Route Fix

Fixed Admin CRM route so both URLs work:

- `/admin`
- `/admin/`

Changes:
- Added Vercel rewrite: `/admin` -> `/admin/index.html`.
- Added `<base href="/admin/">` to admin HTML.
- Kept admin CSS/JS as absolute paths: `/admin/admin.css`, `/admin/admin.js`.
- Added no-store cache header for admin HTML routes.

Backend is unchanged from v15.3.
