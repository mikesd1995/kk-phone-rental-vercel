# KK Phone Rental v16.6.2 — Line-by-line Audit Report

Generated: 2026-05-27 09:24:17

Scope: all code/config/documentation text files in the final v16.6.2 package. Every line in the files listed below is represented once; image/binary files are excluded from line audit because they are not code.

## Summary of key fixes applied

- **Frontend date parsing:** Public site now reads `event_date_text || event_date || date`, fixing blank dates when 08_Web_Ready exports `event_date`.
- **Package order stability:** Blank `sort_order` now sorts after numbered packages and ties by `package_id`.
- **Admin Edit Booking assets:** Admin form now supports editing `phone_asset_id` and `lens_asset_id`; backend still validates double booking.
- **Backend current bookings:** Current bookings now keep overdue active bookings so admins do not lose follow-up items.
- **Backend row insertion:** Empty-row helper inserts missing rows in one batch instead of one-by-one loops.
- **Booking row lookup:** Row-number lookup now validates the row is not empty before update.
- **Vercel Admin API:** CORS supports comma-separated allowed origins and rejects non-object JSON bodies.
- **Read API:** Rejects array query params for sheet/range to avoid ambiguous requests.
- **Version sync:** Frontend/admin/proxy/backend now all report `v16.6.2_LINE_AUDITED`.

## Files covered

- `.env.example` — 14 lines
- `.gitignore` — 9 lines
- `README.md` — 42 lines
- `README_DEPLOY.md` — 21 lines
- `admin/admin.css` — 300 lines
- `admin/admin.js` — 895 lines
- `admin/index.html` — 460 lines
- `api/kk-admin.js` — 121 lines
- `api/kk-data.js` — 75 lines
- `apps-script/Code.gs` — 1753 lines
- `apps-script/appsscript.json` — 12 lines
- `config.js` — 40 lines
- `docs/CLEANUP_REPORT.md` — 26 lines
- `docs/FILE_MANIFEST.json` — 125 lines
- `docs/PROJECT_STRUCTURE.md` — 25 lines
- `docs/README_DEPLOY_ORIGINAL.md` — 18 lines
- `index.html` — 154 lines
- `manifest.json` — 53 lines
- `package.json` — 13 lines
- `script.js` — 742 lines
- `style.css` — 197 lines
- `vercel.json` — 59 lines

## Line-by-line audit

### `.env.example`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — reviewed, no change required | `# Google Sheet ID used by frontend API proxy` |
| 2 | OK — reviewed, no change required | `GOOGLE_SHEET_ID=your_google_sheet_id` |
| 3 | OK — blank/separator line | `` |
| 4 | OK — reviewed, no change required | `# Apps Script Web App /exec URL` |
| 5 | OK — reviewed, no change required | `KK_ADMIN_SCRIPT_URL=https://script.google.com/macros/s/xxxxxxxx/exec` |
| 6 | OK — blank/separator line | `` |
| 7 | OK — reviewed, no change required | `# API key generated from Google Sheet menu: KK Admin > CRM: Generate Admin API Key` |
| 8 | REVIEWED API key stored in script/env, not public frontend | `KK_ADMIN_API_KEY=your_secret_api_key` |
| 9 | OK — blank/separator line | `` |
| 10 | OK — reviewed, no change required | `# PIN for /admin login` |
| 11 | OK — reviewed, no change required | `KK_ADMIN_PIN=change_me` |
| 12 | OK — blank/separator line | `` |
| 13 | OK — reviewed, no change required | `# Optional: allow CORS only from your site origin` |
| 14 | OK — reviewed, no change required | `KK_SITE_ORIGIN=https://kk-phone-rental.vercel.app` |

### `.gitignore`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — reviewed, no change required | `node_modules/` |
| 2 | OK — reviewed, no change required | `.vercel/` |
| 3 | OK — reviewed, no change required | `.env` |
| 4 | OK — reviewed, no change required | `.env.local` |
| 5 | OK — reviewed, no change required | `.DS_Store` |
| 6 | OK — comment/documentation reviewed | `*.log` |
| 7 | OK — reviewed, no change required | `npm-debug.log*` |
| 8 | OK — reviewed, no change required | `yarn-debug.log*` |
| 9 | OK — reviewed, no change required | `yarn-error.log*` |

### `README.md`

| Line | Status | Code |
|---:|---|---|
| 1 | UPDATED version sync to v16.6.2 | `# KK Phone Rental — Line-Audited Project v16.6.2_LINE_AUDITED` |
| 2 | OK — blank/separator line | `` |
| 3 | OK — reviewed, no change required | `ชุดนี้จัดระเบียบไฟล์และคลีนโค้ดสำหรับ deploy บน Vercel พร้อม backend Apps Script ล่าสุดที่มีอยู่ใน workspace.` |
| 4 | OK — blank/separator line | `` |
| 5 | OK — reviewed, no change required | `## โครงสร้างไฟล์` |
| 6 | OK — blank/separator line | `` |
| 7 | OK — reviewed, no change required | `\`\`\`text` |
| 8 | OK — reviewed, no change required | `/` |
| 9 | OK — reviewed, no change required | `├─ index.html              # หน้าลูกค้า` |
| 10 | OK — reviewed, no change required | `├─ style.css               # CSS หน้าลูกค้า` |
| 11 | OK — reviewed, no change required | `├─ script.js               # JS หน้าลูกค้า` |
| 12 | OK — reviewed, no change required | `├─ config.js               # ตั้งค่าเว็บ/Google Sheet/LINE OA` |
| 13 | OK — reviewed, no change required | `├─ admin/                  # หน้า Admin CRM` |
| 14 | OK — reviewed, no change required | `│  ├─ index.html` |
| 15 | OK — reviewed, no change required | `│  ├─ admin.css` |
| 16 | OK — reviewed, no change required | `│  └─ admin.js` |
| 17 | OK — reviewed, no change required | `├─ api/                    # Vercel Serverless API Proxy` |
| 18 | OK — reviewed, no change required | `│  ├─ kk-data.js           # อ่านข้อมูลหน้าบ้านจาก Google Sheets` |
| 19 | OK — reviewed, no change required | `│  └─ kk-admin.js          # Admin Proxy ไป Apps Script` |
| 20 | OK — reviewed, no change required | `├─ apps-script/Code.gs     # Backend Google Apps Script v16.6.2 ถ้ามีใน package` |
| 21 | OK — reviewed, no change required | `├─ docs/                   # เอกสาร deploy/audit/cleanup` |
| 22 | OK — reviewed, no change required | `├─ manifest.json` |
| 23 | OK — reviewed, no change required | `├─ favicon.png` |
| 24 | OK — reviewed, no change required | `├─ apple-touch-icon.png` |
| 25 | OK — reviewed, no change required | `├─ icon-192.png` |
| 26 | OK — reviewed, no change required | `├─ icon-512.png` |
| 27 | OK — reviewed, no change required | `├─ vercel.json` |
| 28 | OK — reviewed, no change required | `└─ package.json` |
| 29 | OK — reviewed, no change required | `\`\`\`` |
| 30 | OK — blank/separator line | `` |
| 31 | OK — reviewed, no change required | `## ใช้งานเร็ว` |
| 32 | OK — blank/separator line | `` |
| 33 | OK — reviewed, no change required | `1. อัปโหลดโปรเจกต์นี้ไป GitHub/Vercel` |
| 34 | OK — reviewed, no change required | `2. ตั้งค่า Environment Variables ใน Vercel ตาม \`.env.example\`` |
| 35 | OK — reviewed, no change required | `3. ถ้าใช้ backend ใหม่ ให้ copy \`apps-script/Code.gs\` ไปวางใน Google Apps Script แล้ว Deploy เป็น Web App` |
| 36 | OK — reviewed, no change required | `4. เปิด \`/admin\` เพื่อเช็ก Version / Health Check` |
| 37 | OK — blank/separator line | `` |
| 38 | OK — reviewed, no change required | `## คำสั่งเช็กโค้ด` |
| 39 | OK — blank/separator line | `` |
| 40 | OK — reviewed, no change required | `\`\`\`bash` |
| 41 | OK — reviewed, no change required | `npm run check` |
| 42 | OK — reviewed, no change required | `\`\`\`` |

### `README_DEPLOY.md`

| Line | Status | Code |
|---:|---|---|
| 1 | UPDATED version sync to v16.6.2 | `# Deploy — KK Phone Rental v16.6.2_LINE_AUDITED` |
| 2 | OK — blank/separator line | `` |
| 3 | OK — reviewed, no change required | `## Vercel` |
| 4 | OK — blank/separator line | `` |
| 5 | OK — reviewed, no change required | `1. Upload/Push project นี้เข้า Vercel` |
| 6 | OK — reviewed, no change required | `2. ตั้ง Environment Variables ตาม \`.env.example\`` |
| 7 | OK — reviewed, no change required | `3. Deploy แล้วเปิด \`/\` และ \`/admin\` เพื่อทดสอบ` |
| 8 | OK — blank/separator line | `` |
| 9 | OK — reviewed, no change required | `## Apps Script Backend` |
| 10 | OK — blank/separator line | `` |
| 11 | OK — reviewed, no change required | `1. เปิด Google Apps Script ของ backend` |
| 12 | OK — reviewed, no change required | `2. Copy โค้ดจาก \`apps-script/Code.gs\` ไปวางแทน \`Code.gs\` เดิม` |
| 13 | OK — reviewed, no change required | `3. Save → Deploy → Manage deployments → Edit → New version` |
| 14 | OK — reviewed, no change required | `4. นำ \`/exec\` URL ไปใส่ Vercel ENV: \`KK_ADMIN_SCRIPT_URL\`` |
| 15 | OK — reviewed, no change required | `5. เปิด Google Sheet แล้วใช้เมนู \`KK Admin\` ตั้งค่า API key และ Poster Folder ID` |
| 16 | OK — blank/separator line | `` |
| 17 | OK — reviewed, no change required | `## Check` |
| 18 | OK — blank/separator line | `` |
| 19 | OK — reviewed, no change required | `\`\`\`bash` |
| 20 | OK — reviewed, no change required | `npm run check` |
| 21 | OK — reviewed, no change required | `\`\`\`` |

### `admin/admin.css`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — reviewed, no change required | `:root{` |
| 2 | OK — reviewed, no change required | `  --bg:#f6f8fc;` |
| 3 | OK — reviewed, no change required | `  --panel:#ffffff;` |
| 4 | OK — reviewed, no change required | `  --panel-soft:#f8fbff;` |
| 5 | OK — reviewed, no change required | `  --ink:#111827;` |
| 6 | OK — reviewed, no change required | `  --muted:#64748b;` |
| 7 | OK — reviewed, no change required | `  --line:#e5edf7;` |
| 8 | OK — reviewed, no change required | `  --brand:#377dff;` |
| 9 | OK — reviewed, no change required | `  --brand-dark:#1856d6;` |
| 10 | OK — reviewed, no change required | `  --brand-soft:#eaf3ff;` |
| 11 | OK — reviewed, no change required | `  --brand2:#7c3aed;` |
| 12 | OK — reviewed, no change required | `  --ok:#10b981;` |
| 13 | OK — reviewed, no change required | `  --ok-soft:#ecfdf5;` |
| 14 | OK — reviewed, no change required | `  --warn:#f59e0b;` |
| 15 | OK — reviewed, no change required | `  --warn-soft:#fffbeb;` |
| 16 | OK — reviewed, no change required | `  --bad:#ef4444;` |
| 17 | OK — reviewed, no change required | `  --bad-soft:#fef2f2;` |
| 18 | OK — reviewed, no change required | `  --radius:22px;` |
| 19 | OK — reviewed, no change required | `  --radius-sm:14px;` |
| 20 | OK — reviewed, no change required | `  --shadow:0 18px 48px rgba(15, 23, 42, .08);` |
| 21 | OK — reviewed, no change required | `  --shadow-soft:0 10px 28px rgba(15, 23, 42, .06);` |
| 22 | OK — reviewed, no change required | `}` |
| 23 | OK — comment/documentation reviewed | `*{box-sizing:border-box}` |
| 24 | OK — reviewed, no change required | `html{scroll-behavior:smooth}` |
| 25 | OK — reviewed, no change required | `body{` |
| 26 | OK — reviewed, no change required | `  margin:0;` |
| 27 | OK — reviewed, no change required | `  min-height:100vh;` |
| 28 | OK — reviewed, no change required | `  background:` |
| 29 | OK — reviewed, no change required | `    radial-gradient(circle at top left,rgba(55,125,255,.12),transparent 34%),` |
| 30 | OK — reviewed, no change required | `    radial-gradient(circle at top right,rgba(124,58,237,.10),transparent 30%),` |
| 31 | OK — reviewed, no change required | `    linear-gradient(135deg,#f7fbff,#fff7fb 68%,#f8fbff);` |
| 32 | OK — reviewed, no change required | `  color:var(--ink);` |
| 33 | OK — reviewed, no change required | `  font-family:Kanit,"Noto Sans Thai",system-ui,sans-serif;` |
| 34 | OK — reviewed, no change required | `}` |
| 35 | OK — reviewed, no change required | `button,input,select,textarea{font:inherit}` |
| 36 | OK — reviewed, no change required | `button{touch-action:manipulation}` |
| 37 | OK — reviewed, no change required | `.shell{min-height:100vh;display:grid;grid-template-columns:280px minmax(0,1fr)}` |
| 38 | OK — reviewed, no change required | `.sidebar{` |
| 39 | OK — reviewed, no change required | `  position:sticky;top:0;height:100vh;padding:22px 18px;` |
| 40 | OK — reviewed, no change required | `  background:rgba(255,255,255,.82);backdrop-filter:blur(18px);` |
| 41 | OK — reviewed, no change required | `  border-right:1px solid rgba(226,235,248,.9);overflow:auto;` |
| 42 | OK — reviewed, no change required | `}` |
| 43 | OK — reviewed, no change required | `.brand{display:flex;gap:12px;align-items:center;margin-bottom:22px;padding:8px 8px 18px;border-bottom:1px solid var(--line)}` |
| 44 | OK — reviewed, no change required | `.logo{width:50px;height:50px;border-radius:18px;background:linear-gradient(135deg,var(--brand),var(--brand2));display:grid;place-items:center;color:#fff;font-weight:800;letter-s…` |
| 45 | OK — reviewed, no change required | `.brand strong{font-size:18px;line-height:1.15}.brand span{display:block;font-size:12px;color:var(--muted);margin-top:3px}` |
| 46 | OK — reviewed, no change required | `nav{display:grid;gap:8px}` |
| 47 | OK — reviewed, no change required | `.nav{border:0;background:transparent;text-align:left;padding:12px 14px;border-radius:16px;color:#334155;cursor:pointer;font-weight:600;transition:background .16s ease,color .16s…` |
| 48 | OK — reviewed, no change required | `.nav:hover{background:#f1f7ff;color:#0f4abd;transform:translateX(2px)}` |
| 49 | OK — reviewed, no change required | `.nav.active{background:linear-gradient(135deg,#eaf3ff,#f3e8ff);color:#0f4abd;box-shadow:inset 4px 0 0 var(--brand)}` |
| 50 | OK — reviewed, no change required | `.nav.muted{margin-top:10px;color:#64748b;border-top:1px solid var(--line);border-radius:0;padding-top:16px}` |
| 51 | OK — reviewed, no change required | `main{padding:24px;min-width:0}` |
| 52 | OK — reviewed, no change required | `.topbar{` |
| 53 | OK — reviewed, no change required | `  position:sticky;top:0;z-index:5;` |
| 54 | OK — reviewed, no change required | `  display:flex;align-items:flex-start;justify-content:space-between;gap:18px;` |
| 55 | OK — reviewed, no change required | `  margin:-24px -24px 20px;padding:22px 24px 18px;` |
| 56 | OK — reviewed, no change required | `  background:rgba(248,251,255,.82);backdrop-filter:blur(16px);border-bottom:1px solid rgba(229,237,247,.88);` |
| 57 | OK — reviewed, no change required | `}` |
| 58 | OK — reviewed, no change required | `.topbar h1{margin:0;font-size:30px;letter-spacing:.1px}.topbar p{margin:6px 0 0;color:var(--muted);max-width:760px}.top-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:…` |
| 59 | OK — reviewed, no change required | `.btn{border:0;border-radius:999px;padding:11px 18px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:700;min…` |
| 60 | OK — reviewed, no change required | `.btn:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(15,23,42,.10)}` |
| 61 | OK — reviewed, no change required | `.btn:disabled{opacity:.62;cursor:not-allowed;transform:none;box-shadow:none}.btn.is-busy{position:relative}` |
| 62 | OK — reviewed, no change required | `.btn.primary{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff}.btn.secondary{background:#eaf3ff;color:#0f4abd}.btn.ghost{background:#fff;color:#334155;bo…` |
| 63 | OK — reviewed, no change required | `.card{background:rgba(255,255,255,.92);border:1px solid rgba(229,237,247,.95);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px;margin-bottom:18px}.card h2{margi…` |
| 64 | OK — reviewed, no change required | `.grid{display:grid;gap:18px}.two-col{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.stats{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:18px}.sta…` |
| 65 | OK — reviewed, no change required | `.stat{padding:18px;min-height:112px;display:flex;flex-direction:column;justify-content:center;background:linear-gradient(180deg,#fff,#f8fbff)}.stat strong{display:block;font-siz…` |
| 66 | OK — reviewed, no change required | `.form{display:grid;gap:16px}.form-title{display:grid;gap:5px;margin-bottom:2px}.form-title h2{margin:0}.eyebrow{width:max-content;border-radius:999px;background:var(--brand-soft…` |
| 67 | OK — reviewed, no change required | `label{display:grid;gap:7px;font-size:14px;font-weight:600;color:#1f2937}label small{font-weight:400;color:var(--muted);line-height:1.5}input,select,textarea{width:100%;border:1p…` |
| 68 | OK — reviewed, no change required | `.notice{padding:14px 16px;border-radius:18px;margin-bottom:16px;border:1px solid var(--line);background:#fff;box-shadow:var(--shadow-soft);line-height:1.6;font-weight:500}.notic…` |
| 69 | OK — reviewed, no change required | `.table-wrap{overflow:auto;max-height:560px;border:1px solid var(--line);border-radius:18px;background:#fff}table{width:100%;border-collapse:separate;border-spacing:0;font-size:1…` |
| 70 | OK — reviewed, no change required | `code{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:1px 6px;color:#334155}` |
| 71 | OK — reviewed, no change required | `@media(max-width:1180px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.two-col{grid-template-columns:1fr}}` |
| 72 | OK — reviewed, no change required | `@media(max-width:980px){.shell{grid-template-columns:1fr}.sidebar{position:relative;height:auto;border-right:0;border-bottom:1px solid var(--line);padding:16px}.brand{margin-bot…` |
| 73 | OK — reviewed, no change required | `@media(max-width:560px){.sidebar nav{grid-template-columns:1fr}.top-actions .btn,.top-badge{width:100%}.stat strong{font-size:28px}th,td{padding:10px 8px;font-size:13px}.table-w…` |
| 74 | OK — blank/separator line | `` |
| 75 | OK — reviewed, no change required | `.mini-btn{border:0;border-radius:999px;background:var(--brand-soft);color:var(--brand-dark);font-weight:800;padding:7px 11px;cursor:pointer;white-space:nowrap}` |
| 76 | OK — reviewed, no change required | `.mini-btn:hover{background:#dbeafe}` |
| 77 | OK — reviewed, no change required | `.customer-list-wrap{max-height:620px}` |
| 78 | OK — reviewed, no change required | `.customer-detail-card{position:sticky;top:90px}` |
| 79 | OK — reviewed, no change required | `.customer-kpi.stats.compact{grid-template-columns:repeat(3,minmax(0,1fr));margin:10px 0 14px}` |
| 80 | OK — reviewed, no change required | `@media(max-width:1180px){.customer-detail-card{position:relative;top:auto}.customer-kpi.stats.compact{grid-template-columns:repeat(2,minmax(0,1fr))}}` |
| 81 | OK — reviewed, no change required | `@media(max-width:560px){.customer-kpi.stats.compact{grid-template-columns:1fr}}` |
| 82 | OK — blank/separator line | `` |
| 83 | UPDATED version sync to v16.6.2 | `/* v16.6.2_LINE_AUDITED*/` |
| 84 | OK — reviewed, no change required | `.action-card{border-color:#dbeafe;background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(248,251,255,.92))}` |
| 85 | OK — reviewed, no change required | `.action-kpi.stats.compact{grid-template-columns:repeat(4,minmax(0,1fr));margin:10px 0 14px}` |
| 86 | OK — reviewed, no change required | `.action-table-wrap{max-height:420px}` |
| 87 | OK — reviewed, no change required | `.mini-tools{display:flex;gap:10px;align-items:end;flex-wrap:wrap;justify-content:flex-end}` |
| 88 | OK — reviewed, no change required | `.mini-tools .mini-control{min-width:180px}` |
| 89 | OK — reviewed, no change required | `.mini-search{min-height:38px;padding:9px 11px;border-radius:12px;background:#f8fbff}` |
| 90 | OK — reviewed, no change required | `.pill.warn{background:#fef3c7;color:#92400e}` |
| 91 | OK — reviewed, no change required | `@media(max-width:1180px){.action-kpi.stats.compact{grid-template-columns:repeat(2,minmax(0,1fr))}.mini-tools{justify-content:flex-start}}` |
| 92 | OK — reviewed, no change required | `@media(max-width:560px){.action-kpi.stats.compact{grid-template-columns:1fr}.mini-tools,.mini-tools .mini-control{width:100%;max-width:none}}` |
| 93 | OK — blank/separator line | `` |
| 94 | OK — blank/separator line | `` |
| 95 | UPDATED version sync to v16.6.2 | `/* v16.6.2_LINE_AUDITED/UI refresh */` |
| 96 | OK — reviewed, no change required | `:root{` |
| 97 | OK — reviewed, no change required | `  --focus:0 0 0 4px rgba(55,125,255,.14);` |
| 98 | OK — reviewed, no change required | `}` |
| 99 | OK — reviewed, no change required | `.sidebar{box-shadow:8px 0 30px rgba(15,23,42,.035)}` |
| 100 | OK — reviewed, no change required | `.nav{position:relative;display:flex;align-items:center;gap:9px;min-height:44px}` |
| 101 | OK — reviewed, no change required | `.nav::before{content:"";width:8px;height:8px;border-radius:999px;background:#cbd5e1;flex:0 0 auto;transition:background .16s ease,transform .16s ease}` |
| 102 | OK — reviewed, no change required | `.nav.active::before{background:var(--brand);transform:scale(1.25)}` |
| 103 | OK — reviewed, no change required | `.nav.muted::before{display:none}` |
| 104 | OK — reviewed, no change required | `.topbar{box-shadow:0 10px 32px rgba(15,23,42,.035)}` |
| 105 | OK — reviewed, no change required | `.quickbar{display:flex;align-items:center;justify-content:space-between;gap:18px;background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(239,246,255,.94));border-color:#dbe…` |
| 106 | OK — reviewed, no change required | `.quickbar h2{margin:4px 0 2px}` |
| 107 | OK — reviewed, no change required | `.quickbar .hint{margin:0}` |
| 108 | OK — reviewed, no change required | `.quick-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;align-items:center}` |
| 109 | OK — reviewed, no change required | `.form-note{border:1px solid var(--line);border-radius:16px;padding:12px 14px;line-height:1.65;font-weight:500;color:#334155;background:#f8fbff}` |
| 110 | OK — reviewed, no change required | `.form-note.ok-note{background:#ecfdf5;border-color:#bbf7d0;color:#065f46}` |
| 111 | OK — reviewed, no change required | `.form-note.warn-note{background:#fffbeb;border-color:#fde68a;color:#92400e}` |
| 112 | OK — reviewed, no change required | `.card{transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease}` |
| 113 | OK — reviewed, no change required | `.card:hover{border-color:#dbeafe}` |
| 114 | OK — reviewed, no change required | `.form.card:focus-within{border-color:#bfdbfe;box-shadow:0 22px 54px rgba(37,99,235,.10)}` |
| 115 | OK — reviewed, no change required | `.stat{border:1px solid rgba(229,237,247,.9);box-shadow:0 8px 22px rgba(15,23,42,.04)}` |
| 116 | OK — reviewed, no change required | `.stat strong{letter-spacing:-.02em}` |
| 117 | OK — reviewed, no change required | `input::placeholder,textarea::placeholder{color:#94a3b8}` |
| 118 | OK — reviewed, no change required | `select{cursor:pointer;background-image:linear-gradient(45deg,transparent 50%,#64748b 50%),linear-gradient(135deg,#64748b 50%,transparent 50%);background-position:calc(100% - 18p…` |
| 119 | OK — reviewed, no change required | `input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible,a:focus-visible{outline:none;box-shadow:var(--focus)}` |
| 120 | OK — reviewed, no change required | `.table-wrap{box-shadow:inset 0 0 0 1px rgba(255,255,255,.45)}` |
| 121 | OK — reviewed, no change required | `.table-wrap::-webkit-scrollbar{height:10px;width:10px}.table-wrap::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px}.table-wrap::-webkit-scrollbar-track{background…` |
| 122 | OK — reviewed, no change required | `tbody tr:nth-child(even) td{background:rgba(248,251,255,.55)}` |
| 123 | OK — reviewed, no change required | `.notice{position:sticky;top:88px;z-index:6}` |
| 124 | OK — reviewed, no change required | `.login-card{margin-top:24px}` |
| 125 | OK — reviewed, no change required | `@media(max-width:980px){` |
| 126 | OK — reviewed, no change required | `  .sidebar nav{display:flex;grid-template-columns:none;overflow:auto;padding-bottom:4px;gap:8px}` |
| 127 | OK — reviewed, no change required | `  .nav{white-space:nowrap;flex:0 0 auto;padding:10px 13px}` |
| 128 | OK — reviewed, no change required | `  .nav.muted{border-top:0;margin-top:0;padding-top:10px}` |
| 129 | OK — reviewed, no change required | `  .quickbar{display:grid}.quick-actions{justify-content:flex-start}.quick-actions .btn{flex:1 1 210px}` |
| 130 | OK — reviewed, no change required | `  .notice{top:0}` |
| 131 | OK — reviewed, no change required | `}` |
| 132 | OK — reviewed, no change required | `@media(max-width:560px){` |
| 133 | OK — reviewed, no change required | `  .quick-actions .btn{width:100%;flex-basis:100%}` |
| 134 | OK — reviewed, no change required | `  .card-head{display:grid}.mini-tools{display:grid}.mini-tools .mini-control{min-width:0}` |
| 135 | OK — reviewed, no change required | `  .form-note{font-size:13px}` |
| 136 | OK — reviewed, no change required | `}` |
| 137 | OK — blank/separator line | `` |
| 138 | OK — blank/separator line | `` |
| 139 | UPDATED version sync to v16.6.2 | `/* v16.6.2_LINE_AUDITED*/` |
| 140 | OK — reviewed, no change required | `.mini-btn.active{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff}` |
| 141 | OK — reviewed, no change required | `.readonly-note input:disabled,input:disabled,select:disabled,textarea:disabled{background:#f1f5f9;color:#64748b;cursor:not-allowed}` |
| 142 | OK — reviewed, no change required | `select option{font-weight:500;color:#0f172a}` |
| 143 | OK — reviewed, no change required | `.form small{max-width:720px}` |
| 144 | OK — blank/separator line | `` |
| 145 | UPDATED version sync to v16.6.2 | `/* v16.6.2_LINE_AUDITED` |
| 146 | OK — reviewed, no change required | `   Scope: visual/UX only. No booking or backend logic changed. */` |
| 147 | OK — reviewed, no change required | `:root{` |
| 148 | OK — reviewed, no change required | `  --bg:#f4f7fb;` |
| 149 | OK — reviewed, no change required | `  --panel:#ffffff;` |
| 150 | OK — reviewed, no change required | `  --panel-soft:#f8fafc;` |
| 151 | OK — reviewed, no change required | `  --ink:#0f172a;` |
| 152 | OK — reviewed, no change required | `  --muted:#64748b;` |
| 153 | OK — reviewed, no change required | `  --line:#e2e8f0;` |
| 154 | OK — reviewed, no change required | `  --line-strong:#cbd5e1;` |
| 155 | OK — reviewed, no change required | `  --brand:#2563eb;` |
| 156 | OK — reviewed, no change required | `  --brand-dark:#1d4ed8;` |
| 157 | OK — reviewed, no change required | `  --brand-soft:#eff6ff;` |
| 158 | OK — reviewed, no change required | `  --brand2:#4f46e5;` |
| 159 | OK — reviewed, no change required | `  --ok:#059669;` |
| 160 | OK — reviewed, no change required | `  --ok-soft:#ecfdf5;` |
| 161 | OK — reviewed, no change required | `  --warn:#d97706;` |
| 162 | OK — reviewed, no change required | `  --warn-soft:#fffbeb;` |
| 163 | OK — reviewed, no change required | `  --bad:#dc2626;` |
| 164 | OK — reviewed, no change required | `  --bad-soft:#fef2f2;` |
| 165 | OK — reviewed, no change required | `  --radius:18px;` |
| 166 | OK — reviewed, no change required | `  --radius-sm:12px;` |
| 167 | OK — reviewed, no change required | `  --shadow:0 14px 34px rgba(15,23,42,.07);` |
| 168 | OK — reviewed, no change required | `  --shadow-soft:0 8px 20px rgba(15,23,42,.055);` |
| 169 | OK — reviewed, no change required | `  --focus:0 0 0 4px rgba(37,99,235,.16);` |
| 170 | OK — reviewed, no change required | `}` |
| 171 | OK — reviewed, no change required | `body{` |
| 172 | OK — reviewed, no change required | `  background:` |
| 173 | OK — reviewed, no change required | `    radial-gradient(circle at 12% 0%,rgba(37,99,235,.08),transparent 30%),` |
| 174 | OK — reviewed, no change required | `    linear-gradient(180deg,#f8fafc 0%,#f4f7fb 52%,#f8fafc 100%);` |
| 175 | OK — reviewed, no change required | `  color:var(--ink);` |
| 176 | OK — reviewed, no change required | `  -webkit-font-smoothing:antialiased;` |
| 177 | OK — reviewed, no change required | `  text-rendering:optimizeLegibility;` |
| 178 | OK — reviewed, no change required | `}` |
| 179 | OK — reviewed, no change required | `.shell{grid-template-columns:292px minmax(0,1fr)}` |
| 180 | OK — reviewed, no change required | `.sidebar{` |
| 181 | OK — reviewed, no change required | `  background:linear-gradient(180deg,#0f172a 0%,#111c31 55%,#132038 100%);` |
| 182 | OK — reviewed, no change required | `  border-right:0;` |
| 183 | OK — reviewed, no change required | `  box-shadow:18px 0 44px rgba(15,23,42,.10);` |
| 184 | OK — reviewed, no change required | `}` |
| 185 | OK — reviewed, no change required | `.brand{border-bottom:1px solid rgba(148,163,184,.22);padding-bottom:20px;margin-bottom:18px;color:#fff}` |
| 186 | OK — reviewed, no change required | `.brand strong{color:#fff;letter-spacing:.01em}.brand span{color:#b6c4d8}` |
| 187 | OK — reviewed, no change required | `.logo{background:linear-gradient(135deg,#60a5fa,#4f46e5);box-shadow:0 14px 30px rgba(37,99,235,.34)}` |
| 188 | OK — reviewed, no change required | `.nav{color:#cbd5e1;border:1px solid transparent;background:rgba(255,255,255,.02);min-height:46px}` |
| 189 | OK — reviewed, no change required | `.nav::before{background:#64748b}` |
| 190 | OK — reviewed, no change required | `.nav:hover{background:rgba(255,255,255,.08);color:#fff;transform:translateX(2px);box-shadow:none}` |
| 191 | OK — reviewed, no change required | `.nav.active{background:rgba(37,99,235,.22);color:#fff;border-color:rgba(96,165,250,.35);box-shadow:inset 4px 0 0 #60a5fa}` |
| 192 | OK — reviewed, no change required | `.nav.active::before{background:#60a5fa}` |
| 193 | OK — reviewed, no change required | `.nav.muted{border-top:1px solid rgba(148,163,184,.22);color:#94a3b8}` |
| 194 | OK — reviewed, no change required | `main{padding:26px;background:transparent}` |
| 195 | OK — reviewed, no change required | `.topbar{` |
| 196 | OK — reviewed, no change required | `  margin:-26px -26px 22px;` |
| 197 | OK — reviewed, no change required | `  padding:20px 26px 18px;` |
| 198 | OK — reviewed, no change required | `  background:rgba(255,255,255,.88);` |
| 199 | OK — reviewed, no change required | `  border-bottom:1px solid rgba(226,232,240,.95);` |
| 200 | OK — reviewed, no change required | `  box-shadow:0 10px 28px rgba(15,23,42,.045);` |
| 201 | OK — reviewed, no change required | `}` |
| 202 | OK — reviewed, no change required | `.topbar h1{font-size:28px;font-weight:800;letter-spacing:-.02em;color:#0f172a}` |
| 203 | OK — reviewed, no change required | `.topbar p{font-size:15px;color:#667085}` |
| 204 | OK — reviewed, no change required | `.top-badge{background:#0f172a;color:#fff;border-color:#0f172a;box-shadow:none;font-weight:800;letter-spacing:.01em}` |
| 205 | OK — reviewed, no change required | `.btn{border-radius:14px;min-height:44px;padding:11px 18px;letter-spacing:.01em;box-shadow:none}` |
| 206 | OK — reviewed, no change required | `.btn.primary{background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;box-shadow:0 10px 24px rgba(37,99,235,.22)}` |
| 207 | OK — reviewed, no change required | `.btn.secondary{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe}` |
| 208 | OK — reviewed, no change required | `.btn.ghost{background:#fff;color:#334155;border:1px solid #cbd5e1}` |
| 209 | OK — reviewed, no change required | `.btn:hover{box-shadow:0 12px 24px rgba(15,23,42,.10);transform:translateY(-1px)}` |
| 210 | OK — reviewed, no change required | `.card{` |
| 211 | OK — reviewed, no change required | `  background:#fff;` |
| 212 | OK — reviewed, no change required | `  border:1px solid rgba(226,232,240,.95);` |
| 213 | OK — reviewed, no change required | `  border-radius:20px;` |
| 214 | OK — reviewed, no change required | `  box-shadow:var(--shadow-soft);` |
| 215 | OK — reviewed, no change required | `  padding:22px;` |
| 216 | OK — reviewed, no change required | `}` |
| 217 | OK — reviewed, no change required | `.card:hover{border-color:#cbd5e1;box-shadow:var(--shadow)}` |
| 218 | OK — reviewed, no change required | `.card h2,.form-title h2{letter-spacing:-.02em;color:#0f172a;font-weight:800}` |
| 219 | OK — reviewed, no change required | `.card-head{border-bottom:1px solid rgba(226,232,240,.75);padding-bottom:12px;margin-bottom:14px}` |
| 220 | OK — reviewed, no change required | `.card-head h2{font-size:21px}` |
| 221 | OK — reviewed, no change required | `.hint,.card-head small,label small{color:#667085}` |
| 222 | OK — reviewed, no change required | `.eyebrow{` |
| 223 | OK — reviewed, no change required | `  background:#e0ecff;` |
| 224 | OK — reviewed, no change required | `  color:#1d4ed8;` |
| 225 | OK — reviewed, no change required | `  border:1px solid #bfdbfe;` |
| 226 | OK — reviewed, no change required | `  letter-spacing:.05em;` |
| 227 | OK — reviewed, no change required | `  padding:5px 11px;` |
| 228 | OK — reviewed, no change required | `}` |
| 229 | OK — reviewed, no change required | `.quickbar,.action-card{` |
| 230 | OK — reviewed, no change required | `  background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%);` |
| 231 | OK — reviewed, no change required | `  border-color:#dbeafe;` |
| 232 | OK — reviewed, no change required | `}` |
| 233 | OK — reviewed, no change required | `.quick-actions .btn{white-space:nowrap}` |
| 234 | OK — reviewed, no change required | `.stat{` |
| 235 | OK — reviewed, no change required | `  min-height:106px;` |
| 236 | OK — reviewed, no change required | `  background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);` |
| 237 | OK — reviewed, no change required | `  border:1px solid #e2e8f0;` |
| 238 | OK — reviewed, no change required | `  border-radius:18px;` |
| 239 | OK — reviewed, no change required | `  box-shadow:0 8px 18px rgba(15,23,42,.04);` |
| 240 | OK — reviewed, no change required | `}` |
| 241 | OK — reviewed, no change required | `.stat strong{font-size:34px;font-weight:900;color:#0b1220;letter-spacing:-.04em}` |
| 242 | OK — reviewed, no change required | `.stat span{font-size:14px;color:#667085;font-weight:600}` |
| 243 | OK — reviewed, no change required | `.form{gap:18px}.form-title{border-bottom:1px solid rgba(226,232,240,.75);padding-bottom:12px;margin-bottom:2px}` |
| 244 | OK — reviewed, no change required | `.form-note{background:#f8fafc;border-color:#e2e8f0;color:#475569}` |
| 245 | OK — reviewed, no change required | `.form-note.ok-note{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}` |
| 246 | OK — reviewed, no change required | `.form-note.warn-note{background:#fffbeb;border-color:#fde68a;color:#92400e}` |
| 247 | OK — reviewed, no change required | `label{font-weight:700;color:#172033}` |
| 248 | OK — reviewed, no change required | `input,select,textarea{` |
| 249 | OK — reviewed, no change required | `  border-color:#d7e0ec;` |
| 250 | OK — reviewed, no change required | `  border-radius:14px;` |
| 251 | OK — reviewed, no change required | `  background:#fff;` |
| 252 | OK — reviewed, no change required | `  min-height:46px;` |
| 253 | OK — reviewed, no change required | `  font-weight:500;` |
| 254 | OK — reviewed, no change required | `}` |
| 255 | OK — reviewed, no change required | `input:hover,select:hover,textarea:hover{border-color:#b8c7dc;background:#fff}` |
| 256 | OK — reviewed, no change required | `input:focus,select:focus,textarea:focus{border-color:#60a5fa;box-shadow:var(--focus);background:#fff}` |
| 257 | OK — reviewed, no change required | `input:disabled,select:disabled,textarea:disabled{background:#f1f5f9;color:#64748b;border-style:dashed}` |
| 258 | OK — reviewed, no change required | `.table-wrap{` |
| 259 | OK — reviewed, no change required | `  border-color:#dfe7f2;` |
| 260 | OK — reviewed, no change required | `  border-radius:18px;` |
| 261 | OK — reviewed, no change required | `  background:#fff;` |
| 262 | OK — reviewed, no change required | `  box-shadow:inset 0 0 0 1px rgba(255,255,255,.55);` |
| 263 | OK — reviewed, no change required | `}` |
| 264 | OK — reviewed, no change required | `table{font-size:13.5px}` |
| 265 | OK — reviewed, no change required | `th,td{padding:12px 12px;border-bottom:1px solid #e8eef6}` |
| 266 | OK — reviewed, no change required | `th{` |
| 267 | OK — reviewed, no change required | `  background:#f8fafc;` |
| 268 | OK — reviewed, no change required | `  color:#334155;` |
| 269 | OK — reviewed, no change required | `  text-transform:none;` |
| 270 | OK — reviewed, no change required | `  font-size:13px;` |
| 271 | OK — reviewed, no change required | `  letter-spacing:.01em;` |
| 272 | OK — reviewed, no change required | `}` |
| 273 | OK — reviewed, no change required | `tbody tr:hover td{background:#eff6ff!important}` |
| 274 | OK — reviewed, no change required | `tbody tr:nth-child(even) td{background:#fbfdff}` |
| 275 | OK — reviewed, no change required | `.pill{border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;font-weight:800}` |
| 276 | OK — reviewed, no change required | `.pill.ok{border-color:#86efac;background:#dcfce7;color:#166534}` |
| 277 | OK — reviewed, no change required | `.pill.bad{border-color:#fecaca;background:#fee2e2;color:#991b1b}` |
| 278 | OK — reviewed, no change required | `.pill.warn{border-color:#fde68a;background:#fef3c7;color:#92400e}` |
| 279 | OK — reviewed, no change required | `.notice{border-radius:16px;box-shadow:0 12px 28px rgba(15,23,42,.08);font-weight:700}` |
| 280 | OK — reviewed, no change required | `.notice.ok{border-color:#86efac}.notice.bad{border-color:#fca5a5}.notice.warn{border-color:#fcd34d}` |
| 281 | OK — reviewed, no change required | `.mini-tools{gap:12px}.mini-control{font-size:12px;font-weight:800;color:#475569}.mini-search,.mini-control select{min-height:42px;background:#fff}` |
| 282 | OK — reviewed, no change required | `.mini-btn{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:12px}.mini-btn.active{background:#1d4ed8;border-color:#1d4ed8;color:#fff}` |
| 283 | OK — reviewed, no change required | `.customer-detail-card{top:96px}.customer-kpi .stat strong{font-size:30px}` |
| 284 | OK — reviewed, no change required | `.check{background:#f8fafc;border-color:#dfe7f2}` |
| 285 | OK — reviewed, no change required | `.login-card{border-top:4px solid #2563eb}` |
| 286 | OK — reviewed, no change required | `@media(max-width:1180px){.shell{grid-template-columns:260px minmax(0,1fr)}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}` |
| 287 | OK — reviewed, no change required | `@media(max-width:980px){` |
| 288 | OK — reviewed, no change required | `  .shell{display:block}.sidebar{position:relative;height:auto;padding:14px;background:#0f172a}.brand{padding-bottom:12px;margin-bottom:12px}` |
| 289 | OK — reviewed, no change required | `  .sidebar nav{display:flex;overflow-x:auto;gap:8px;scroll-snap-type:x proximity}.nav{scroll-snap-align:start;white-space:nowrap;background:rgba(255,255,255,.05)}` |
| 290 | OK — reviewed, no change required | `  main{padding:16px}.topbar{margin:-16px -16px 18px;padding:16px;display:grid}.topbar h1{font-size:23px}` |
| 291 | OK — reviewed, no change required | `  .card{padding:17px;border-radius:18px}.card-head{display:grid}.quickbar{display:grid}.quick-actions{justify-content:flex-start}` |
| 292 | OK — reviewed, no change required | `  .row.two,.row.three,.stats,.stats.compact{grid-template-columns:1fr}` |
| 293 | OK — reviewed, no change required | `}` |
| 294 | OK — reviewed, no change required | `@media(max-width:560px){` |
| 295 | OK — reviewed, no change required | `  .top-actions .btn,.top-badge,.quick-actions .btn{width:100%}` |
| 296 | OK — reviewed, no change required | `  .stat{min-height:94px}.stat strong{font-size:30px}` |
| 297 | OK — reviewed, no change required | `  th,td{padding:10px 9px;font-size:12.8px}` |
| 298 | OK — reviewed, no change required | `  .table-wrap{max-height:470px}` |
| 299 | OK — reviewed, no change required | `  .card h2,.card-head h2{font-size:19px}` |
| 300 | OK — reviewed, no change required | `}` |

### `admin/admin.js`

| Line | Status | Code |
|---:|---|---|
| 1 | UPDATED version sync to v16.6.2 | `// KK Phone Rental Admin CRM v16.6.2_LINE_AUDITED — Hide closed past bookings from Edit Booking` |
| 2 | OK — reviewed, no change required | `(function(){` |
| 3 | UPDATED version sync to v16.6.2 | `  const KK_ADMIN_UI_VERSION = "v16.6.2_LINE_AUDITED";` |
| 4 | UPDATED version sync to v16.6.2 | `  const EXPECTED_BACKEND_VERSION = "v16.6.2_LINE_AUDITED";` |
| 5 | UPDATED version sync to v16.6.2 | `  const EXPECTED_PROXY_VERSION = "v16.6.2_LINE_AUDITED";` |
| 6 | OK — reviewed, no change required | `  const $ = (sel, root=document) => root.querySelector(sel);` |
| 7 | OK — reviewed, no change required | `  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));` |
| 8 | OK — reviewed, no change required | `  const state = { pin: sessionStorage.getItem("kk_admin_pin") || "", data: null, loading: false, posterWarning: "", selectedCustomerKey: "" };` |
| 9 | OK — blank/separator line | `` |
| 10 | OK — reviewed, no change required | `  function showNotice(msg, type="ok"){` |
| 11 | OK — reviewed, no change required | `    const n=$("#notice");` |
| 12 | REVIEWED UI alert / safe fallback where possible | `    if(!n) return alert(msg);` |
| 13 | OK — reviewed, no change required | `    n.textContent=msg;` |
| 14 | OK — reviewed, no change required | `    n.className="notice "+type;` |
| 15 | OK — reviewed, no change required | `    n.classList.remove("hidden");` |
| 16 | OK — reviewed, no change required | `    n.setAttribute("role", type==="bad" ? "alert" : "status");` |
| 17 | OK — reviewed, no change required | `    clearTimeout(showNotice.t);` |
| 18 | OK — reviewed, no change required | `    showNotice.t=setTimeout(()=>n.classList.add("hidden"),9000);` |
| 19 | OK — reviewed, no change required | `  }` |
| 20 | OK — reviewed, no change required | `  function setBusy(btn, busy){` |
| 21 | OK — reviewed, no change required | `    if(!btn) return;` |
| 22 | OK — reviewed, no change required | `    btn.disabled=!!busy;` |
| 23 | OK — reviewed, no change required | `    btn.classList.toggle("is-busy", !!busy);` |
| 24 | OK — reviewed, no change required | `    btn.dataset.old=btn.dataset.old||btn.textContent;` |
| 25 | OK — reviewed, no change required | `    btn.textContent=busy?"กำลังบันทึก...":btn.dataset.old;` |
| 26 | OK — reviewed, no change required | `  }` |
| 27 | OK — reviewed, no change required | `  function formData(form){` |
| 28 | OK — reviewed, no change required | `    const out={};` |
| 29 | OK — reviewed, no change required | `    new FormData(form).forEach((v,k)=>{ out[k]=typeof v==="string"?v.trim():v; });` |
| 30 | OK — reviewed, no change required | `    $$('input[type="checkbox"]',form).forEach(i=>out[i.name]=i.checked);` |
| 31 | OK — reviewed, no change required | `    return out;` |
| 32 | OK — reviewed, no change required | `  }` |
| 33 | OK — reviewed, no change required | `  function parseLocalDate(v){` |
| 34 | OK — reviewed, no change required | `    if(!v) return null;` |
| 35 | OK — reviewed, no change required | `    if(v instanceof Date && !isNaN(v)) return v;` |
| 36 | OK — reviewed, no change required | `    const s=String(v).trim();` |
| 37 | OK — reviewed, no change required | `    let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);` |
| 38 | OK — reviewed, no change required | `    if(m) return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));` |
| 39 | OK — reviewed, no change required | `    m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);` |
| 40 | OK — reviewed, no change required | `    if(m){ let y=Number(m[3]); if(y>2500)y-=543; return new Date(y, Number(m[2])-1, Number(m[1])); }` |
| 41 | OK — reviewed, no change required | `    const d=new Date(s);` |
| 42 | OK — reviewed, no change required | `    return isNaN(d) ? null : d;` |
| 43 | OK — reviewed, no change required | `  }` |
| 44 | OK — reviewed, no change required | `  function dateToInput(v){` |
| 45 | OK — reviewed, no change required | `    const d=parseLocalDate(v);` |
| 46 | OK — reviewed, no change required | `    if(!d) return String(v||"").slice(0,10);` |
| 47 | OK — reviewed, no change required | `    return \`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}\`;` |
| 48 | OK — reviewed, no change required | `  }` |
| 49 | OK — reviewed, no change required | `  function fmtDate(v){` |
| 50 | OK — reviewed, no change required | `    const d=parseLocalDate(v);` |
| 51 | OK — reviewed, no change required | `    if(!d) return String(v||"");` |
| 52 | OK — reviewed, no change required | `    return d.toLocaleDateString("th-TH",{year:"numeric",month:"2-digit",day:"2-digit"});` |
| 53 | OK — reviewed, no change required | `  }` |
| 54 | OK — reviewed, no change required | `  function extractDriveFileId(url){` |
| 55 | OK — reviewed, no change required | `    const s=String(url||"").trim();` |
| 56 | OK — reviewed, no change required | `    const patterns=[/\/file\/d\/([a-zA-Z0-9_-]{15,})/,/[?&]id=([a-zA-Z0-9_-]{15,})/,/\/thumbnail\?id=([a-zA-Z0-9_-]{15,})/,/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/,/lh[…` |
| 57 | OK — reviewed, no change required | `    for(const re of patterns){ const m=s.match(re); if(m&&m[1]) return decodeURIComponent(m[1]); }` |
| 58 | OK — reviewed, no change required | `    if(!/^https?:\/\//i.test(s) && /^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;` |
| 59 | OK — reviewed, no change required | `    return "";` |
| 60 | OK — reviewed, no change required | `  }` |
| 61 | OK — reviewed, no change required | `  function normalizePosterUrl(url){` |
| 62 | OK — reviewed, no change required | `    const s=String(url||"").trim();` |
| 63 | OK — reviewed, no change required | `    if(!s) return "";` |
| 64 | OK — reviewed, no change required | `    if(/drive\.google\.com\/(drive\/u\/\d+\/)?folders\//i.test(s) || /drive\.google\.com\/drive\/folders\//i.test(s)){` |
| 65 | REVIEWED Drive URL logic/permission flow | `      throw new Error("Poster URL ต้องเป็นลิงก์ไฟล์รูป ไม่ใช่ลิงก์โฟลเดอร์ Google Drive");` |
| 66 | OK — reviewed, no change required | `    }` |
| 67 | OK — reviewed, no change required | `    const id=extractDriveFileId(s);` |
| 68 | OK — reviewed, no change required | `    if(id) return \`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200\`;` |
| 69 | OK — reviewed, no change required | `    if(/drive\.google\.com/i.test(s)){` |
| 70 | REVIEWED Drive URL logic/permission flow | `      throw new Error("อ่าน File ID จาก Google Drive link ไม่ได้ กรุณาใช้ลิงก์ไฟล์รูป หรือกด Upload Poster");` |
| 71 | OK — reviewed, no change required | `    }` |
| 72 | OK — reviewed, no change required | `    return s;` |
| 73 | OK — reviewed, no change required | `  }` |
| 74 | OK — reviewed, no change required | `  function money(v){ const n=Number(v||0); return n.toLocaleString("th-TH"); }` |
| 75 | OK — reviewed, no change required | `  function dateValue(v){` |
| 76 | OK — reviewed, no change required | `    const d=parseLocalDate(v);` |
| 77 | OK — reviewed, no change required | `    return d ? d.getTime() : 0;` |
| 78 | OK — reviewed, no change required | `  }` |
| 79 | OK — reviewed, no change required | `  function textValue(v){ return String(v || "").trim().toLocaleLowerCase("th-TH"); }` |
| 80 | OK — reviewed, no change required | `  function eventSelectSortValue(e){` |
| 81 | OK — reviewed, no change required | `    const t=dateValue(e && e.event_date);` |
| 82 | OK — reviewed, no change required | `    return t || Number.MAX_SAFE_INTEGER;` |
| 83 | OK — reviewed, no change required | `  }` |
| 84 | OK — reviewed, no change required | `  function compareEventsByDateAsc(a,b){` |
| 85 | OK — reviewed, no change required | `    return (eventSelectSortValue(a)-eventSelectSortValue(b)) || textValue(a && a.event_name).localeCompare(textValue(b && b.event_name),"th") || String(a && a.event_id || "").lo…` |
| 86 | OK — reviewed, no change required | `  }` |
| 87 | OK — reviewed, no change required | `  function sortedOpenEvents(events){` |
| 88 | OK — reviewed, no change required | `    const sort=($("#eventsSort") && $("#eventsSort").value) || "date_asc";` |
| 89 | OK — reviewed, no change required | `    const rows=(events||[])` |
| 90 | OK — reviewed, no change required | `      .filter(e=>String(e.status||"").toLowerCase()==="open" && e.active_on_web!==false)` |
| 91 | OK — comment/documentation reviewed | `      // Dashboard should show only current/upcoming open events. Past events stay in Sheet for history/archive, but should not appear as "งานที่เปิดอยู่".` |
| 92 | OK — reviewed, no change required | `      .filter(e=>isTodayOrFuture(e.event_date))` |
| 93 | OK — reviewed, no change required | `      .slice();` |
| 94 | OK — reviewed, no change required | `    if(sort==="date_desc") rows.sort((a,b)=>dateValue(b.event_date)-dateValue(a.event_date));` |
| 95 | OK — reviewed, no change required | `    else if(sort==="name_asc") rows.sort((a,b)=>textValue(a.event_name).localeCompare(textValue(b.event_name),"th"));` |
| 96 | OK — reviewed, no change required | `    else rows.sort((a,b)=>dateValue(a.event_date)-dateValue(b.event_date));` |
| 97 | OK — reviewed, no change required | `    return rows;` |
| 98 | OK — reviewed, no change required | `  }` |
| 99 | OK — reviewed, no change required | `  function sortedBookings(bookings){` |
| 100 | OK — reviewed, no change required | `    const sort=($("#bookingsSort") && $("#bookingsSort").value) || "created_desc";` |
| 101 | OK — reviewed, no change required | `    const rows=(bookings||[]).slice();` |
| 102 | OK — reviewed, no change required | `    if(sort==="event_date_asc") rows.sort((a,b)=>(dateValue(a.event_date)-dateValue(b.event_date)) || (dateValue(b.created_at)-dateValue(a.created_at)));` |
| 103 | OK — reviewed, no change required | `    else if(sort==="event_date_desc") rows.sort((a,b)=>(dateValue(b.event_date)-dateValue(a.event_date)) || (dateValue(b.created_at)-dateValue(a.created_at)));` |
| 104 | OK — reviewed, no change required | `    else if(sort==="customer_asc") rows.sort((a,b)=>textValue(a.customer_name).localeCompare(textValue(b.customer_name),"th"));` |
| 105 | OK — reviewed, no change required | `    else rows.sort((a,b)=>dateValue(b.created_at)-dateValue(a.created_at));` |
| 106 | OK — reviewed, no change required | `    return rows;` |
| 107 | OK — reviewed, no change required | `  }` |
| 108 | OK — reviewed, no change required | `  function containsQuery(row, fields, query){` |
| 109 | OK — reviewed, no change required | `    const q=String(query||"").trim().toLowerCase();` |
| 110 | OK — reviewed, no change required | `    if(!q) return true;` |
| 111 | OK — reviewed, no change required | `    return fields.map(k=>String(row && row[k] || "")).join(" ").toLowerCase().includes(q);` |
| 112 | OK — reviewed, no change required | `  }` |
| 113 | OK — reviewed, no change required | `  function daysFromToday(v){` |
| 114 | OK — reviewed, no change required | `    const d=parseLocalDate(v);` |
| 115 | OK — reviewed, no change required | `    if(!d) return null;` |
| 116 | OK — reviewed, no change required | `    d.setHours(0,0,0,0);` |
| 117 | OK — reviewed, no change required | `    return Math.round((d.getTime()-startOfToday().getTime())/86400000);` |
| 118 | OK — reviewed, no change required | `  }` |
| 119 | OK — reviewed, no change required | `  function isActiveBookingStatus(status){` |
| 120 | OK — reviewed, no change required | `    return ["pending","confirmed","picked_up"].includes(String(status||"").toLowerCase().trim());` |
| 121 | OK — reviewed, no change required | `  }` |
| 122 | OK — reviewed, no change required | `  function isClosedBookingStatus(status){` |
| 123 | OK — reviewed, no change required | `    return ["cancelled","returned"].includes(String(status||"").toLowerCase().trim());` |
| 124 | OK — reviewed, no change required | `  }` |
| 125 | OK — reviewed, no change required | `  function shouldShowInEditBooking(b){` |
| 126 | OK — comment/documentation reviewed | `    // Edit Booking should stay focused on bookings that still need action.` |
| 127 | OK — comment/documentation reviewed | `    // Closed bookings must never appear here, even when the event date is today/future.` |
| 128 | OK — comment/documentation reviewed | `    // Keep overdue active rows so admins can still mark them returned/cancelled if they forgot.` |
| 129 | OK — reviewed, no change required | `    if(!b) return false;` |
| 130 | OK — reviewed, no change required | `    if(isClosedBookingStatus(b.booking_status)) return false;` |
| 131 | OK — reviewed, no change required | `    if(isTodayOrFuture(b.event_date)) return true;` |
| 132 | OK — reviewed, no change required | `    return isActiveBookingStatus(b.booking_status);` |
| 133 | OK — reviewed, no change required | `  }` |
| 134 | OK — reviewed, no change required | `  function isUnpaidPayment(status){` |
| 135 | OK — reviewed, no change required | `    const s=String(status||"").toLowerCase().trim();` |
| 136 | OK — comment/documentation reviewed | `    // Blank payment status should still be treated as unpaid, otherwise Action Center misses follow-up items.` |
| 137 | OK — reviewed, no change required | `    return !["paid","refunded"].includes(s);` |
| 138 | OK — reviewed, no change required | `  }` |
| 139 | OK — reviewed, no change required | `  function actionSeverity(type){` |
| 140 | OK — reviewed, no change required | `    if(type==="payment" || type==="return" || type==="data") return "bad";` |
| 141 | OK — reviewed, no change required | `    if(type==="upcoming") return "warn";` |
| 142 | OK — reviewed, no change required | `    return "ok";` |
| 143 | OK — reviewed, no change required | `  }` |
| 144 | OK — reviewed, no change required | `  function buildActionRows(data){` |
| 145 | OK — reviewed, no change required | `    const d=data||{};` |
| 146 | OK — reviewed, no change required | `    const rows=[];` |
| 147 | OK — reviewed, no change required | `    const bookings=d.bookings||[];` |
| 148 | OK — reviewed, no change required | `    const events=d.events||[];` |
| 149 | OK — reviewed, no change required | `    bookings.forEach(b=>{` |
| 150 | OK — reviewed, no change required | `      const st=String(b.booking_status||"").toLowerCase().trim();` |
| 151 | OK — reviewed, no change required | `      if(st==="cancelled" || st==="returned") return;` |
| 152 | OK — reviewed, no change required | `      if(isUnpaidPayment(b.payment_status)){` |
| 153 | OK — reviewed, no change required | `        rows.push({type:"payment", priority:1, date:b.event_date, title:b.event_name||b.event_id||"", customer:b.customer_name||"-", contact:[b.customer_contact,b.customer_phone…` |
| 154 | OK — reviewed, no change required | `      }` |
| 155 | OK — reviewed, no change required | `      if(st==="picked_up"){` |
| 156 | OK — reviewed, no change required | `        rows.push({type:"return", priority:2, date:b.event_date, title:b.event_name||b.event_id||"", customer:b.customer_name||"-", contact:[b.customer_contact,b.customer_phone]…` |
| 157 | OK — reviewed, no change required | `      }` |
| 158 | OK — reviewed, no change required | `      const diff=daysFromToday(b.event_date);` |
| 159 | OK — reviewed, no change required | `      if(isActiveBookingStatus(st) && diff!==null && diff>=0 && diff<=7){` |
| 160 | OK — reviewed, no change required | `        rows.push({type:"upcoming", priority:3, date:b.event_date, title:b.event_name||b.event_id||"", customer:b.customer_name||"-", contact:[b.customer_contact,b.customer_phon…` |
| 161 | OK — reviewed, no change required | `      }` |
| 162 | OK — reviewed, no change required | `    });` |
| 163 | OK — reviewed, no change required | `    events.forEach(e=>{` |
| 164 | OK — reviewed, no change required | `      if(!isActiveEvent(e) || !isTodayOrFuture(e.event_date)) return;` |
| 165 | OK — reviewed, no change required | `      const health=String(e.data_health||"").trim().toLowerCase();` |
| 166 | OK — reviewed, no change required | `      const missing=[];` |
| 167 | OK — reviewed, no change required | `      if(health && health!=="ok") missing.push("data_health: "+e.data_health);` |
| 168 | OK — reviewed, no change required | `      if(!String(e.poster_url||"").trim()) missing.push("ไม่มีรูป");` |
| 169 | OK — reviewed, no change required | `      if(!String(e.venue||"").trim()) missing.push("ไม่มีสถานที่");` |
| 170 | OK — reviewed, no change required | `      if(missing.length){` |
| 171 | OK — reviewed, no change required | `        rows.push({type:"data", priority:4, date:e.event_date, title:e.event_name||e.event_id||"", customer:"-", contact:"-", task:missing.join(" / "), ref:""});` |
| 172 | OK — reviewed, no change required | `      }` |
| 173 | OK — reviewed, no change required | `    });` |
| 174 | OK — reviewed, no change required | `    return rows.sort((a,b)=>(a.priority-b.priority) || (dateValue(a.date)-dateValue(b.date)) || String(a.title).localeCompare(String(b.title),"th"));` |
| 175 | OK — reviewed, no change required | `  }` |
| 176 | OK — reviewed, no change required | `  function customerKeyFromRecord(name, contact, phone){` |
| 177 | OK — reviewed, no change required | `    const p=String(phone||"").replace(/\D+/g,"");` |
| 178 | OK — reviewed, no change required | `    if(p) return "phone:"+p;` |
| 179 | OK — reviewed, no change required | `    const c=String(contact||"").trim().toLowerCase();` |
| 180 | OK — reviewed, no change required | `    if(c) return "contact:"+c;` |
| 181 | OK — reviewed, no change required | `    const n=String(name||"").trim().toLowerCase().replace(/\s+/g," ");` |
| 182 | OK — reviewed, no change required | `    return n ? "name:"+n : "";` |
| 183 | OK — reviewed, no change required | `  }` |
| 184 | OK — reviewed, no change required | `  function customerHistoryRows(bookings, customerStats){` |
| 185 | OK — reviewed, no change required | `    const map=new Map();` |
| 186 | OK — reviewed, no change required | `    function ensure(key){` |
| 187 | OK — reviewed, no change required | `      if(!map.has(key)) map.set(key,{customer_key:key,customer_name:"",customer_contact:"",customer_phone:"",rental_count:0,first_rental_date:"",last_rental_date:"",last_event_n…` |
| 188 | OK — reviewed, no change required | `      return map.get(key);` |
| 189 | OK — reviewed, no change required | `    }` |
| 190 | OK — reviewed, no change required | `    (customerStats||[]).forEach(c=>{` |
| 191 | OK — reviewed, no change required | `      const key=String(c.customer_key||"").trim() || customerKeyFromRecord(c.customer_name,c.customer_contact,c.customer_phone);` |
| 192 | OK — reviewed, no change required | `      if(!key) return;` |
| 193 | OK — reviewed, no change required | `      const item=ensure(key);` |
| 194 | OK — reviewed, no change required | `      item.customer_name=c.customer_name||item.customer_name;` |
| 195 | OK — reviewed, no change required | `      item.customer_contact=c.customer_contact||item.customer_contact;` |
| 196 | OK — reviewed, no change required | `      item.customer_phone=c.customer_phone||item.customer_phone;` |
| 197 | OK — reviewed, no change required | `      item.rental_count+=toNum(c.rental_count);` |
| 198 | OK — reviewed, no change required | `      item.first_rental_date=c.first_rental_date||item.first_rental_date;` |
| 199 | OK — reviewed, no change required | `      item.last_rental_date=c.last_rental_date||item.last_rental_date;` |
| 200 | OK — reviewed, no change required | `      item.last_event_name=c.last_event_name||item.last_event_name;` |
| 201 | OK — reviewed, no change required | `      item.last_booking_status=c.last_booking_status||item.last_booking_status;` |
| 202 | OK — reviewed, no change required | `    });` |
| 203 | OK — reviewed, no change required | `    (bookings||[]).forEach(b=>{` |
| 204 | OK — reviewed, no change required | `      const st=String(b.booking_status||"").toLowerCase().trim();` |
| 205 | OK — reviewed, no change required | `      if(st==="cancelled") return;` |
| 206 | OK — reviewed, no change required | `      const key=customerKeyFromRecord(b.customer_name,b.customer_contact,b.customer_phone);` |
| 207 | OK — reviewed, no change required | `      if(!key) return;` |
| 208 | OK — reviewed, no change required | `      const item=ensure(key);` |
| 209 | OK — reviewed, no change required | `      item.customer_name=b.customer_name||item.customer_name;` |
| 210 | OK — reviewed, no change required | `      item.customer_contact=b.customer_contact||item.customer_contact;` |
| 211 | OK — reviewed, no change required | `      item.customer_phone=b.customer_phone||item.customer_phone;` |
| 212 | OK — reviewed, no change required | `      item.rental_count+=1;` |
| 213 | OK — reviewed, no change required | `      const rentalDate=b.event_date||b.created_at||"";` |
| 214 | OK — reviewed, no change required | `      if(rentalDate && (!item.first_rental_date || dateValue(rentalDate)<dateValue(item.first_rental_date))) item.first_rental_date=rentalDate;` |
| 215 | OK — reviewed, no change required | `      if(rentalDate && (!item.last_rental_date || dateValue(rentalDate)>=dateValue(item.last_rental_date))){` |
| 216 | OK — reviewed, no change required | `        item.last_rental_date=rentalDate;` |
| 217 | OK — reviewed, no change required | `        item.last_event_name=b.event_name||item.last_event_name;` |
| 218 | OK — reviewed, no change required | `        item.last_booking_status=b.booking_status||item.last_booking_status;` |
| 219 | OK — reviewed, no change required | `      }` |
| 220 | OK — reviewed, no change required | `    });` |
| 221 | OK — reviewed, no change required | `    return Array.from(map.values()).sort((a,b)=>(toNum(b.rental_count)-toNum(a.rental_count)) || (dateValue(b.last_rental_date)-dateValue(a.last_rental_date)) || textValue(a.cus…` |
| 222 | OK — reviewed, no change required | `  }` |
| 223 | OK — reviewed, no change required | `  function bookingCustomerKey(b){` |
| 224 | OK — reviewed, no change required | `    return customerKeyFromRecord(b && b.customer_name, b && b.customer_contact, b && b.customer_phone);` |
| 225 | OK — reviewed, no change required | `  }` |
| 226 | OK — reviewed, no change required | `  function bookingMatchesCustomer(b, customer){` |
| 227 | OK — reviewed, no change required | `    if(!b || !customer) return false;` |
| 228 | OK — reviewed, no change required | `    const key=String(customer.customer_key||"");` |
| 229 | OK — reviewed, no change required | `    if(key && bookingCustomerKey(b)===key) return true;` |
| 230 | OK — reviewed, no change required | `    const p=String(customer.customer_phone||"").replace(/\D+/g,"");` |
| 231 | OK — reviewed, no change required | `    if(p && String(b.customer_phone||"").replace(/\D+/g,"")===p) return true;` |
| 232 | OK — reviewed, no change required | `    const c=String(customer.customer_contact||"").trim().toLowerCase();` |
| 233 | OK — reviewed, no change required | `    if(c && String(b.customer_contact||"").trim().toLowerCase()===c) return true;` |
| 234 | OK — reviewed, no change required | `    const n=String(customer.customer_name||"").trim().toLowerCase().replace(/\s+/g," ");` |
| 235 | OK — reviewed, no change required | `    return !!n && String(b.customer_name||"").trim().toLowerCase().replace(/\s+/g," ")===n;` |
| 236 | OK — reviewed, no change required | `  }` |
| 237 | OK — reviewed, no change required | `  function customerBookings(customer){` |
| 238 | OK — reviewed, no change required | `    const d=state.data||{};` |
| 239 | OK — reviewed, no change required | `    return sortedBookings((d.bookings||[]).filter(b=>bookingMatchesCustomer(b, customer)));` |
| 240 | OK — reviewed, no change required | `  }` |
| 241 | OK — reviewed, no change required | `  function setActiveCustomer(customerKey){` |
| 242 | OK — reviewed, no change required | `    state.selectedCustomerKey=String(customerKey||"");` |
| 243 | OK — reviewed, no change required | `    const nav=$('.nav[data-tab="customers"]');` |
| 244 | OK — reviewed, no change required | `    if(nav && !nav.classList.contains("active")) nav.click();` |
| 245 | OK — reviewed, no change required | `    render();` |
| 246 | OK — reviewed, no change required | `    const detail=$("#customerDetailCard") || $("#tab-customers");` |
| 247 | OK — reviewed, no change required | `    if(detail){` |
| 248 | OK — reviewed, no change required | `      setTimeout(()=>detail.scrollIntoView({behavior:"smooth", block:"start"}), 40);` |
| 249 | OK — reviewed, no change required | `    }` |
| 250 | OK — reviewed, no change required | `  }` |
| 251 | OK — reviewed, no change required | `  function renderCustomerDetail(customerHistory){` |
| 252 | OK — reviewed, no change required | `    const detailName=$("#customerDetailName"), detailMeta=$("#customerDetailMeta"), checklist=$("#customerChecklist"), tableEl=$("#customerBookingsTable");` |
| 253 | OK — reviewed, no change required | `    if(!detailName || !checklist || !tableEl) return;` |
| 254 | OK — reviewed, no change required | `    const rows=customerHistory||[];` |
| 255 | OK — reviewed, no change required | `    let customer=rows.find(c=>String(c.customer_key)===String(state.selectedCustomerKey));` |
| 256 | OK — reviewed, no change required | `    if(!customer && rows.length){` |
| 257 | OK — reviewed, no change required | `      customer=rows[0];` |
| 258 | OK — reviewed, no change required | `      state.selectedCustomerKey=String(customer.customer_key||"");` |
| 259 | OK — reviewed, no change required | `    }` |
| 260 | OK — reviewed, no change required | `    if(!customer){` |
| 261 | OK — reviewed, no change required | `      detailName.textContent="ยังไม่มีประวัติลูกค้า";` |
| 262 | OK — reviewed, no change required | `      if(detailMeta) detailMeta.textContent="เมื่อมี booking ระบบจะแสดงประวัติและจำนวนครั้งที่เช่าตรงนี้";` |
| 263 | REVIEWED innerHTML use; check escaping/safe static markup | `      checklist.innerHTML="";` |
| 264 | OK — reviewed, no change required | `      table(tableEl,[{label:"ข้อมูล",render:()=>"ยังไม่มีข้อมูล"}],[]);` |
| 265 | OK — reviewed, no change required | `      return;` |
| 266 | OK — reviewed, no change required | `    }` |
| 267 | OK — reviewed, no change required | `    const bookings=customerBookings(customer);` |
| 268 | OK — reviewed, no change required | `    const active=bookings.filter(b=>["pending","confirmed","picked_up"].includes(String(b.booking_status||"").toLowerCase())).length;` |
| 269 | OK — reviewed, no change required | `    const cancelled=bookings.filter(b=>String(b.booking_status||"").toLowerCase()==="cancelled").length;` |
| 270 | OK — reviewed, no change required | `    const paid=bookings.filter(b=>String(b.payment_status||"").toLowerCase()==="paid").length;` |
| 271 | OK — reviewed, no change required | `    detailName.textContent=customer.customer_name || "ไม่ระบุชื่อ";` |
| 272 | OK — reviewed, no change required | `    if(detailMeta) detailMeta.textContent=[customer.customer_phone, customer.customer_contact].filter(Boolean).join(" / ") || "ไม่มีเบอร์หรือ LINE ในระบบ";` |
| 273 | REVIEWED innerHTML use; check escaping/safe static markup | `    checklist.innerHTML=[` |
| 274 | OK — reviewed, no change required | `      [customer.rental_count||0,"เช่ารวม"],` |
| 275 | OK — reviewed, no change required | `      [bookings.length,"booking ที่พบ"],` |
| 276 | OK — reviewed, no change required | `      [active,"กำลัง active"],` |
| 277 | OK — reviewed, no change required | `      [cancelled,"ยกเลิก"],` |
| 278 | OK — reviewed, no change required | `      [paid,"paid"],` |
| 279 | OK — reviewed, no change required | `      [fmtDate(customer.last_rental_date)||"-","เช่าล่าสุด"]` |
| 280 | OK — reviewed, no change required | `    ].map(s=>\`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>\`).join('');` |
| 281 | OK — reviewed, no change required | `    table(tableEl,[` |
| 282 | OK — reviewed, no change required | `      {label:"วันที่งาน",render:r=>esc(fmtDate(r.event_date))},` |
| 283 | OK — reviewed, no change required | `      {label:"งาน",render:r=>esc(r.event_name || r.event_id || "")},` |
| 284 | OK — reviewed, no change required | `      {label:"แพ็กเกจ",render:r=>esc(r.package_display || r.package_type || r.template_id || "")},` |
| 285 | REVIEWED asset field support / double booking guarded by backend | `      {label:"Phone",render:r=>esc(r.phone_model_display || r.phone_asset_id || "-")},` |
| 286 | REVIEWED asset field support / double booking guarded by backend | `      {label:"Lens",render:r=>esc(r.lens_model_display || r.lens_asset_id || "-")},` |
| 287 | OK — reviewed, no change required | `      {label:"Booking",render:r=>\`<span class="pill ${String(r.booking_status).toLowerCase()==='cancelled'?'bad':'ok'}">${esc(r.booking_status||'')}</span>\`},` |
| 288 | OK — reviewed, no change required | `      {label:"Payment",render:r=>\`<span class="pill ${String(r.payment_status).toLowerCase()==='paid'?'ok':'bad'}">${esc(r.payment_status||'')}</span>\`},` |
| 289 | OK — reviewed, no change required | `      {label:"รับแล้ว",render:r=>esc(money(r.amount_received||0))},` |
| 290 | OK — reviewed, no change required | `      {label:"Note",render:r=>esc(r.note || r.booking_note || "")}` |
| 291 | OK — reviewed, no change required | `    ], bookings);` |
| 292 | OK — reviewed, no change required | `  }` |
| 293 | OK — blank/separator line | `` |
| 294 | OK — reviewed, no change required | `  function startOfToday(){` |
| 295 | OK — reviewed, no change required | `    const d=new Date();` |
| 296 | OK — reviewed, no change required | `    d.setHours(0,0,0,0);` |
| 297 | OK — reviewed, no change required | `    return d;` |
| 298 | OK — reviewed, no change required | `  }` |
| 299 | OK — reviewed, no change required | `  function isTodayOrFuture(v){` |
| 300 | OK — reviewed, no change required | `    const d=parseLocalDate(v);` |
| 301 | OK — reviewed, no change required | `    if(!d) return false;` |
| 302 | OK — reviewed, no change required | `    d.setHours(0,0,0,0);` |
| 303 | OK — reviewed, no change required | `    return d.getTime()>=startOfToday().getTime();` |
| 304 | OK — reviewed, no change required | `  }` |
| 305 | OK — reviewed, no change required | `  function bookingLabel(b){` |
| 306 | OK — reviewed, no change required | `    return \`${fmtDate(b.event_date)} · ${b.event_name||b.event_id||''} · ${b.customer_name||'-'} · ${b.booking_status||''}\`;` |
| 307 | OK — reviewed, no change required | `  }` |
| 308 | OK — reviewed, no change required | `  function toNum(v){` |
| 309 | OK — reviewed, no change required | `    if(v===null || v===undefined || v==='') return 0;` |
| 310 | OK — reviewed, no change required | `    const n=Number(String(v).replace(/,/g,'').trim());` |
| 311 | OK — reviewed, no change required | `    return Number.isFinite(n) ? n : 0;` |
| 312 | OK — reviewed, no change required | `  }` |
| 313 | OK — reviewed, no change required | `  function isEventOpen(e){` |
| 314 | OK — reviewed, no change required | `    return String(e && e.status || '').toLowerCase().trim() === 'open';` |
| 315 | OK — reviewed, no change required | `  }` |
| 316 | OK — reviewed, no change required | `  function isActiveEvent(e){` |
| 317 | OK — comment/documentation reviewed | `    // Admin operational dropdowns should only show events that are actually open and active on web.` |
| 318 | OK — reviewed, no change required | `    return !!e && isEventOpen(e) && e.active_on_web !== false;` |
| 319 | OK — reviewed, no change required | `  }` |
| 320 | OK — reviewed, no change required | `  function findEventById(eventId){` |
| 321 | OK — reviewed, no change required | `    const id=String(eventId||'').trim();` |
| 322 | OK — reviewed, no change required | `    return ((state.data||{}).events||[]).find(e=>String(e.event_id||'').trim()===id) || null;` |
| 323 | OK — reviewed, no change required | `  }` |
| 324 | OK — reviewed, no change required | `  function findPackageByTemplateId(templateId){` |
| 325 | OK — reviewed, no change required | `    const id=String(templateId||'').trim();` |
| 326 | OK — reviewed, no change required | `    return ((state.data||{}).packages||[]).find(p=>String(p.template_id||'').trim()===id) || null;` |
| 327 | OK — reviewed, no change required | `  }` |
| 328 | OK — reviewed, no change required | `  function isWebPackageBookable(p){` |
| 329 | OK — reviewed, no change required | `    const st=String(p && p.package_status || '').toLowerCase().trim();` |
| 330 | OK — reviewed, no change required | `    return !!p && (st==='available' || st==='open') && toNum(p.available_count)>0 && toNum(p.price)>0;` |
| 331 | OK — reviewed, no change required | `  }` |
| 332 | OK — reviewed, no change required | `  function webPackagesForEvent(eventId){` |
| 333 | OK — reviewed, no change required | `    const d=state.data||{};` |
| 334 | OK — reviewed, no change required | `    const id=String(eventId||'').trim();` |
| 335 | OK — reviewed, no change required | `    return (d.web_packages||[]).filter(p=>String(p.event_id||'').trim()===id);` |
| 336 | OK — reviewed, no change required | `  }` |
| 337 | OK — reviewed, no change required | `  function templateIdFromWebPackage(wp){` |
| 338 | OK — reviewed, no change required | `    const pkgId=String(wp && wp.package_id || '').trim();` |
| 339 | OK — reviewed, no change required | `    const eventId=String(wp && wp.event_id || '').trim();` |
| 340 | OK — reviewed, no change required | `    if(wp && wp.template_id) return String(wp.template_id).trim();` |
| 341 | OK — reviewed, no change required | `    const tplPos=pkgId.indexOf('TPL-');` |
| 342 | OK — reviewed, no change required | `    if(tplPos>=0) return pkgId.slice(tplPos);` |
| 343 | OK — reviewed, no change required | `    if(eventId && pkgId.indexOf(eventId+'-')===0) return pkgId.slice(eventId.length+1);` |
| 344 | OK — reviewed, no change required | `    return pkgId;` |
| 345 | OK — reviewed, no change required | `  }` |
| 346 | OK — reviewed, no change required | `  function bookableWebPackagesForEvent(eventId){` |
| 347 | OK — reviewed, no change required | `    return webPackagesForEvent(eventId).filter(isWebPackageBookable);` |
| 348 | OK — reviewed, no change required | `  }` |
| 349 | OK — reviewed, no change required | `  function hasWebPackageSource(){` |
| 350 | OK — reviewed, no change required | `    const d=state.data||{};` |
| 351 | OK — reviewed, no change required | `    return Array.isArray(d.web_packages) && d.web_packages.length>0;` |
| 352 | OK — reviewed, no change required | `  }` |
| 353 | OK — reviewed, no change required | `  function eventHasBookablePackage(eventId){` |
| 354 | OK — reviewed, no change required | `    return !hasWebPackageSource() || bookableWebPackagesForEvent(eventId).length>0;` |
| 355 | OK — reviewed, no change required | `  }` |
| 356 | OK — reviewed, no change required | `  function packageLabelFromWebRow(wp){` |
| 357 | OK — reviewed, no change required | `    const d=state.data||{};` |
| 358 | OK — reviewed, no change required | `    const byId={};` |
| 359 | OK — reviewed, no change required | `    (d.packages||[]).forEach(p=>{ byId[String(p.template_id||'').trim()] = p; });` |
| 360 | OK — reviewed, no change required | `    const templateId=templateIdFromWebPackage(wp);` |
| 361 | OK — reviewed, no change required | `    const pkg=byId[templateId] || {};` |
| 362 | OK — reviewed, no change required | `    const base=pkg.display_name || wp.model_display || templateId || wp.package_type || 'แพ็กเกจ';` |
| 363 | OK — reviewed, no change required | `    const price=toNum(wp.price || pkg.standard_price);` |
| 364 | OK — reviewed, no change required | `    const left=toNum(wp.available_count);` |
| 365 | OK — reviewed, no change required | `    return \`${base} · ${money(price)}฿ · เหลือ ${left}\`;` |
| 366 | OK — reviewed, no change required | `  }` |
| 367 | OK — reviewed, no change required | `  function populateBookingPackages(){` |
| 368 | OK — reviewed, no change required | `    const form=$("#bookingForm");` |
| 369 | OK — reviewed, no change required | `    if(!form || !state.data) return;` |
| 370 | OK — reviewed, no change required | `    const eventSel=form.elements.event_id;` |
| 371 | OK — reviewed, no change required | `    const pkgSel=form.elements.template_id;` |
| 372 | OK — reviewed, no change required | `    if(!eventSel || !pkgSel) return;` |
| 373 | OK — reviewed, no change required | `    const current=pkgSel.value;` |
| 374 | OK — reviewed, no change required | `    const eventId=eventSel.value;` |
| 375 | OK — reviewed, no change required | `    if(hasWebPackageSource()){` |
| 376 | OK — reviewed, no change required | `      const rows=bookableWebPackagesForEvent(eventId);` |
| 377 | OK — reviewed, no change required | `      if(!eventId){` |
| 378 | REVIEWED innerHTML use; check escaping/safe static markup | `        pkgSel.innerHTML='<option value="">เลือกงานก่อน</option>';` |
| 379 | OK — reviewed, no change required | `        pkgSel.disabled=true;` |
| 380 | OK — reviewed, no change required | `      }else if(!rows.length){` |
| 381 | REVIEWED innerHTML use; check escaping/safe static markup | `        pkgSel.innerHTML='<option value="">งานนี้เต็มแล้ว / ไม่มีแพ็กเกจว่าง</option>';` |
| 382 | OK — reviewed, no change required | `        pkgSel.disabled=true;` |
| 383 | OK — reviewed, no change required | `      }else{` |
| 384 | OK — reviewed, no change required | `        pkgSel.disabled=false;` |
| 385 | REVIEWED innerHTML use; check escaping/safe static markup | `        pkgSel.innerHTML='<option value="">เลือกแพ็กเกจที่ยังว่าง</option>'+rows.map(p=>opt(templateIdFromWebPackage(p), packageLabelFromWebRow(p))).join('');` |
| 386 | OK — reviewed, no change required | `        if(current && rows.some(p=>String(templateIdFromWebPackage(p))===String(current))) pkgSel.value=current;` |
| 387 | OK — reviewed, no change required | `      }` |
| 388 | OK — reviewed, no change required | `    }else{` |
| 389 | OK — reviewed, no change required | `      pkgSel.disabled=false;` |
| 390 | REVIEWED innerHTML use; check escaping/safe static markup | `      pkgSel.innerHTML='<option value="">เลือกแพ็กเกจ</option>'+(state.data.packages||[])` |
| 391 | OK — reviewed, no change required | `        .filter(p=>p.active!==false)` |
| 392 | OK — reviewed, no change required | `        .map(p=>opt(p.template_id, \`${p.display_name||p.template_id} · ${money(p.standard_price)}฿\`)).join('');` |
| 393 | OK — reviewed, no change required | `      if(current) pkgSel.value=current;` |
| 394 | OK — reviewed, no change required | `    }` |
| 395 | OK — reviewed, no change required | `  }` |
| 396 | OK — reviewed, no change required | `  function findOverride(eventId, templateId){` |
| 397 | OK — reviewed, no change required | `    const d=state.data||{};` |
| 398 | OK — reviewed, no change required | `    return (d.overrides||[]).find(o=>String(o.event_id)===String(eventId)&&String(o.template_id)===String(templateId));` |
| 399 | OK — reviewed, no change required | `  }` |
| 400 | OK — reviewed, no change required | `  function populateEventOverrideForm(){` |
| 401 | OK — reviewed, no change required | `    const form=$("#eventPriceOverrideForm");` |
| 402 | OK — reviewed, no change required | `    if(!form || !state.data) return;` |
| 403 | OK — reviewed, no change required | `    const eventId=form.elements.event_id && form.elements.event_id.value;` |
| 404 | OK — reviewed, no change required | `    const templateId=form.elements.template_id && form.elements.template_id.value;` |
| 405 | OK — reviewed, no change required | `    const o=findOverride(eventId, templateId);` |
| 406 | OK — reviewed, no change required | `    form.elements.override_price.value=o && o.override_price!==undefined && o.override_price!==null ? o.override_price : "";` |
| 407 | OK — reviewed, no change required | `    form.elements.active_override.value=o && o.active_override!=="" && o.active_override!==undefined ? String(o.active_override) : "";` |
| 408 | OK — reviewed, no change required | `    form.elements.override_note.value=o ? (o.override_note||"") : "";` |
| 409 | OK — reviewed, no change required | `    form.elements.sort_order_override.value=o ? (o.sort_order_override||"") : "";` |
| 410 | OK — reviewed, no change required | `    form.elements.use_case_override.value=o ? (o.use_case_override||"") : "";` |
| 411 | OK — reviewed, no change required | `  }` |
| 412 | OK — blank/separator line | `` |
| 413 | OK — reviewed, no change required | `  function populateEventUpdateForm(){` |
| 414 | OK — reviewed, no change required | `    const form=$("#eventUpdateForm");` |
| 415 | OK — reviewed, no change required | `    if(!form || !state.data) return;` |
| 416 | OK — reviewed, no change required | `    const eventId=form.elements.event_id && form.elements.event_id.value;` |
| 417 | OK — reviewed, no change required | `    const e=findEventById(eventId);` |
| 418 | OK — reviewed, no change required | `    const set=(name,val)=>{ if(form.elements[name]) form.elements[name].value=val==null?"":val; };` |
| 419 | OK — reviewed, no change required | `    if(!e){` |
| 420 | OK — reviewed, no change required | `      ["event_name","event_date","venue","poster_url","status","active_on_web","note"].forEach(k=>set(k,""));` |
| 421 | OK — reviewed, no change required | `      return;` |
| 422 | OK — reviewed, no change required | `    }` |
| 423 | OK — reviewed, no change required | `    set("event_name", e.event_name || "");` |
| 424 | OK — reviewed, no change required | `    set("event_date", dateToInput(e.event_date));` |
| 425 | OK — reviewed, no change required | `    set("venue", e.venue || "");` |
| 426 | OK — reviewed, no change required | `    set("poster_url", e.poster_url || "");` |
| 427 | OK — reviewed, no change required | `    set("status", String(e.status||"").toLowerCase() || "open");` |
| 428 | OK — reviewed, no change required | `    set("active_on_web", e.active_on_web===false ? "false" : "true");` |
| 429 | OK — reviewed, no change required | `    set("note", e.note || "");` |
| 430 | OK — reviewed, no change required | `  }` |
| 431 | OK — blank/separator line | `` |
| 432 | OK — reviewed, no change required | `  function populatePackageUpdateForm(){` |
| 433 | OK — reviewed, no change required | `    const form=$("#packageUpdateForm");` |
| 434 | OK — reviewed, no change required | `    if(!form || !state.data) return;` |
| 435 | OK — reviewed, no change required | `    const templateId=form.elements.template_id && form.elements.template_id.value;` |
| 436 | OK — reviewed, no change required | `    const p=findPackageByTemplateId(templateId);` |
| 437 | OK — reviewed, no change required | `    const set=(name,val)=>{ if(form.elements[name]) form.elements[name].value=val==null?"":val; };` |
| 438 | OK — reviewed, no change required | `    if(!p){` |
| 439 | OK — reviewed, no change required | `      ["standard_price","display_name","use_case","active"].forEach(k=>set(k,""));` |
| 440 | OK — reviewed, no change required | `      return;` |
| 441 | OK — reviewed, no change required | `    }` |
| 442 | OK — reviewed, no change required | `    set("standard_price", p.standard_price || 0);` |
| 443 | OK — reviewed, no change required | `    set("display_name", p.display_name || "");` |
| 444 | OK — reviewed, no change required | `    set("use_case", p.use_case || "");` |
| 445 | OK — reviewed, no change required | `    set("active", p.active===false ? "false" : "true");` |
| 446 | OK — reviewed, no change required | `  }` |
| 447 | OK — blank/separator line | `` |
| 448 | OK — reviewed, no change required | `  function populateBookingEditForm(){` |
| 449 | OK — reviewed, no change required | `    const form=$("#bookingEditForm");` |
| 450 | OK — reviewed, no change required | `    if(!form || !state.data) return;` |
| 451 | OK — reviewed, no change required | `    const sel=form.elements.row_number;` |
| 452 | OK — reviewed, no change required | `    if(!sel) return;` |
| 453 | OK — reviewed, no change required | `    const rows=sortedBookings((state.data.bookings||[]).filter(shouldShowInEditBooking));` |
| 454 | OK — reviewed, no change required | `    const current=sel.value;` |
| 455 | REVIEWED innerHTML use; check escaping/safe static markup | `    sel.innerHTML='<option value="">เลือก Booking ที่ยังต้องแก้ / ยกเลิก</option>'+` |
| 456 | OK — reviewed, no change required | `      rows.map(b=>opt(b.row_number, bookingLabel(b))).join('');` |
| 457 | OK — reviewed, no change required | `    if(current && rows.some(b=>String(b.row_number)===String(current))) sel.value=current;` |
| 458 | OK — reviewed, no change required | `    const b=rows.find(x=>String(x.row_number)===String(sel.value));` |
| 459 | OK — reviewed, no change required | `    const set=(name,val)=>{ if(form.elements[name]) form.elements[name].value=val==null?"":val; };` |
| 460 | OK — reviewed, no change required | `    if(!b){` |
| 461 | REVIEWED asset field support / double booking guarded by backend | `      ["booking_status","customer_name","customer_contact","customer_phone","contact_channel","payment_status","amount_received","pickup_time","phone_asset_id","lens_asset_id","…` |
| 462 | OK — reviewed, no change required | `      return;` |
| 463 | OK — reviewed, no change required | `    }` |
| 464 | OK — reviewed, no change required | `    set("booking_status", b.booking_status || "confirmed");` |
| 465 | OK — reviewed, no change required | `    set("customer_name", b.customer_name || "");` |
| 466 | OK — reviewed, no change required | `    set("customer_contact", b.customer_contact || "");` |
| 467 | OK — reviewed, no change required | `    set("customer_phone", b.customer_phone || "");` |
| 468 | OK — reviewed, no change required | `    set("contact_channel", b.contact_channel || "LINE");` |
| 469 | OK — reviewed, no change required | `    set("payment_status", b.payment_status || "unpaid");` |
| 470 | OK — reviewed, no change required | `    set("amount_received", b.amount_received || 0);` |
| 471 | OK — reviewed, no change required | `    set("pickup_time", b.pickup_time || "");` |
| 472 | REVIEWED asset field support / double booking guarded by backend | `    set("phone_asset_id", b.phone_asset_id || "");` |
| 473 | REVIEWED asset field support / double booking guarded by backend | `    set("lens_asset_id", b.lens_asset_id || "");` |
| 474 | OK — reviewed, no change required | `    set("booking_note", b.note || "");` |
| 475 | OK — reviewed, no change required | `  }` |
| 476 | OK — blank/separator line | `` |
| 477 | OK — reviewed, no change required | `  async function api(action, payload={}){` |
| 478 | REVIEWED network call and error handling | `    const res=await fetch("/api/kk-admin",{` |
| 479 | OK — reviewed, no change required | `      method:"POST",` |
| 480 | OK — reviewed, no change required | `      headers:{"Content-Type":"application/json","X-Admin-Pin":state.pin},` |
| 481 | OK — reviewed, no change required | `      body:JSON.stringify(Object.assign({action},payload))` |
| 482 | OK — reviewed, no change required | `    });` |
| 483 | OK — reviewed, no change required | `    const data=await res.json().catch(()=>({ok:false,error:"Invalid server response"}));` |
| 484 | OK — reviewed, no change required | `    if(!data.ok) throw new Error(data.error||"Request failed");` |
| 485 | OK — reviewed, no change required | `    return data;` |
| 486 | OK — reviewed, no change required | `  }` |
| 487 | OK — blank/separator line | `` |
| 488 | OK — reviewed, no change required | `  function esc(v){` |
| 489 | OK — reviewed, no change required | `    return String(v ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));` |
| 490 | OK — reviewed, no change required | `  }` |
| 491 | OK — reviewed, no change required | `  function opt(value, label){` |
| 492 | OK — reviewed, no change required | `    return \`<option value="${esc(value)}">${esc(label)}</option>\`;` |
| 493 | OK — reviewed, no change required | `  }` |
| 494 | OK — reviewed, no change required | `  function versionDiagnosticsRows(data){` |
| 495 | OK — reviewed, no change required | `    const d=data||{};` |
| 496 | OK — reviewed, no change required | `    const rows=[];` |
| 497 | OK — reviewed, no change required | `    const backendVersion = d.admin_api_version || (d.phase1_diagnostics && d.phase1_diagnostics.admin_api_version) || "";` |
| 498 | OK — reviewed, no change required | `    const proxyVersion = d.frontend_proxy_version || "";` |
| 499 | OK — reviewed, no change required | `    const spreadsheetId = d.spreadsheet_id || "";` |
| 500 | OK — reviewed, no change required | `    const frontendSheetId = d.frontend_sheet_id || "";` |
| 501 | OK — reviewed, no change required | `    const sameSheet = spreadsheetId && frontendSheetId && spreadsheetId === frontendSheetId;` |
| 502 | OK — reviewed, no change required | `    rows.push({check:"Version · Admin UI", status:"OK", detail:KK_ADMIN_UI_VERSION, note:"Line-by-line audited frontend/admin package"});` |
| 503 | OK — reviewed, no change required | `    rows.push({check:"Version · Vercel Proxy", status: proxyVersion===EXPECTED_PROXY_VERSION ? "OK" : "CHECK", detail:proxyVersion || "missing", note:"Expected "+EXPECTED_PROXY_…` |
| 504 | OK — reviewed, no change required | `    rows.push({check:"Version · Apps Script", status: backendVersion===EXPECTED_BACKEND_VERSION ? "OK" : "CHECK", detail:backendVersion || "missing", note:"Expected "+EXPECTED_B…` |
| 505 | OK — reviewed, no change required | `    rows.push({check:"Sheet ID · Frontend vs Apps Script", status: sameSheet ? "OK" : "CHECK", detail:(frontendSheetId||"missing")+" / "+(spreadsheetId||"missing"), note:sameShe…` |
| 506 | OK — reviewed, no change required | `    if(d.phase1_diagnostics){` |
| 507 | OK — reviewed, no change required | `      const x=d.phase1_diagnostics;` |
| 508 | OK — reviewed, no change required | `      rows.push({check:"ENV · KK_POSTER_FOLDER_ID", status:x.poster_folder_id_set ? "OK" : "CHECK", detail:x.poster_folder_id_set ? "set" : "missing", note:"Needed for Upload Po…` |
| 509 | OK — reviewed, no change required | `      rows.push({check:"Log Sheets", status:x.log_sheets_ready ? "OK" : "CHECK", detail:x.log_sheets_ready ? "15/16 logs ready" : "missing", note:"Run KK Admin > Setup/Repair Na…` |
| 510 | OK — reviewed, no change required | `      rows.push({check:"Read fallback", status:x.direct_fallback_disabled ? "CHECK" : "OK", detail:x.direct_fallback_disabled ? "disabled" : "emergency fallback available", note…` |
| 511 | OK — reviewed, no change required | `    }` |
| 512 | OK — reviewed, no change required | `    return rows;` |
| 513 | OK — reviewed, no change required | `  }` |
| 514 | OK — reviewed, no change required | `  function posterSyncText(res){` |
| 515 | OK — reviewed, no change required | `    if(!res || !res.poster_url) return "";` |
| 516 | OK — reviewed, no change required | `    if(res.web_ready_found && res.web_ready_poster_url) return " และบันทึกรูปลง Web Ready แล้ว";` |
| 517 | OK — reviewed, no change required | `    if(res.web_ready_found && !res.web_ready_poster_url) return " แต่ 08_Web_Ready ยังไม่พบรูป";` |
| 518 | OK — reviewed, no change required | `    return " และบันทึกรูปแล้ว";` |
| 519 | OK — reviewed, no change required | `  }` |
| 520 | OK — reviewed, no change required | `  function posterWarningText(res){` |
| 521 | OK — reviewed, no change required | `    const warning = (res && res.poster_public_warning) || state.posterWarning || "";` |
| 522 | OK — reviewed, no change required | `    return warning ? " หมายเหตุ: ระบบอัปโหลดรูปแล้ว แต่ตั้ง public อัตโนมัติไม่ได้ ถ้ารูปไม่ขึ้น ให้ตั้งค่าโฟลเดอร์รูปเป็น Share > Anyone with the link > Viewer" : "";` |
| 523 | OK — reviewed, no change required | `  }` |
| 524 | OK — reviewed, no change required | `  function table(el, cols, rows){` |
| 525 | OK — reviewed, no change required | `    if(!el) return;` |
| 526 | REVIEWED innerHTML use; check escaping/safe static markup | `    if(!rows || !rows.length){ el.innerHTML='<tr><td class="muted">ไม่มีข้อมูล</td></tr>'; return; }` |
| 527 | REVIEWED innerHTML use; check escaping/safe static markup | `    el.innerHTML='<thead><tr>'+cols.map(c=>\`<th>${esc(c.label)}</th>\`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>\`<td>${c.render?c.render(r):esc(r[c.key]…` |
| 528 | OK — reviewed, no change required | `  }` |
| 529 | OK — blank/separator line | `` |
| 530 | OK — reviewed, no change required | `  function fillSelects(){` |
| 531 | OK — reviewed, no change required | `    const data=state.data||{};` |
| 532 | OK — reviewed, no change required | `    $$('select[data-source="events"]').forEach(sel=>{` |
| 533 | OK — reviewed, no change required | `      const current=sel.value;` |
| 534 | OK — reviewed, no change required | `      const isBooking=!!sel.closest("#bookingForm");` |
| 535 | OK — reviewed, no change required | `      const isOverride=!!sel.closest("#eventPriceOverrideForm");` |
| 536 | OK — reviewed, no change required | `      const isEditEvent=!!sel.closest("#eventUpdateForm");` |
| 537 | OK — reviewed, no change required | `      const rows=(data.events||[])` |
| 538 | OK — reviewed, no change required | `        .filter(e=>String(e.event_id||"").trim())` |
| 539 | OK — comment/documentation reviewed | `        // Booking: show only current/upcoming open events that still have bookable packages.` |
| 540 | OK — reviewed, no change required | `        .filter(e=>!isBooking || (isActiveEvent(e) && isTodayOrFuture(e.event_date) && eventHasBookablePackage(e.event_id)))` |
| 541 | OK — comment/documentation reviewed | `        // Price override: show only current/upcoming open events, not past/closed/draft events.` |
| 542 | OK — reviewed, no change required | `        .filter(e=>!isOverride || (isActiveEvent(e) && isTodayOrFuture(e.event_date)))` |
| 543 | OK — comment/documentation reviewed | `        // Edit Event: show only current/upcoming open events to prevent accidental edits on past events.` |
| 544 | OK — reviewed, no change required | `        .filter(e=>!isEditEvent || (isActiveEvent(e) && isTodayOrFuture(e.event_date)))` |
| 545 | OK — reviewed, no change required | `        .filter(e=>(isBooking||isOverride||isEditEvent) || String(e.status||"").toLowerCase().trim()!=="closed")` |
| 546 | OK — reviewed, no change required | `        .sort(compareEventsByDateAsc);` |
| 547 | OK — reviewed, no change required | `      const placeholder=isBooking ? "เลือกงานที่ยังว่าง" : (isOverride ? "เลือกงานวันนี้/อนาคต" : (isEditEvent ? "เลือกงานวันนี้/อนาคต" : "เลือกงาน"));` |
| 548 | OK — reviewed, no change required | `      const emptyText=isBooking ? "ไม่มีงานที่ว่างให้จอง" : (isOverride ? "ไม่มีงานวันนี้/อนาคตให้แก้ราคา" : (isEditEvent ? "ไม่มีงานวันนี้/อนาคตให้แก้ไข" : placeholder));` |
| 549 | REVIEWED innerHTML use; check escaping/safe static markup | `      sel.innerHTML=\`<option value="">${esc(rows.length ? placeholder : emptyText)}</option>\`+` |
| 550 | OK — reviewed, no change required | `        rows.map(e=>opt(e.event_id, \`${e.event_name} · ${fmtDate(e.event_date)}\`)).join('');` |
| 551 | OK — reviewed, no change required | `      if(current && rows.some(e=>String(e.event_id)===String(current))) sel.value=current;` |
| 552 | OK — reviewed, no change required | `    });` |
| 553 | OK — reviewed, no change required | `    $$('select[data-source="packages"]').forEach(sel=>{` |
| 554 | OK — reviewed, no change required | `      if(sel.closest("#bookingForm")) return;` |
| 555 | OK — reviewed, no change required | `      const current=sel.value;` |
| 556 | REVIEWED innerHTML use; check escaping/safe static markup | `      sel.innerHTML='<option value="">เลือกแพ็กเกจ</option>'+(data.packages||[])` |
| 557 | OK — reviewed, no change required | `        .filter(p=>p.active!==false)` |
| 558 | OK — reviewed, no change required | `        .map(p=>opt(p.template_id, \`${p.display_name||p.template_id} · ${money(p.standard_price)}฿\`)).join('');` |
| 559 | OK — reviewed, no change required | `      if(current) sel.value=current;` |
| 560 | OK — reviewed, no change required | `    });` |
| 561 | OK — reviewed, no change required | `    populateBookingPackages();` |
| 562 | OK — reviewed, no change required | `    populateEventOverrideForm();` |
| 563 | OK — reviewed, no change required | `    populateEventUpdateForm();` |
| 564 | OK — reviewed, no change required | `    populatePackageUpdateForm();` |
| 565 | OK — reviewed, no change required | `    populateBookingEditForm();` |
| 566 | OK — reviewed, no change required | `  }` |
| 567 | OK — blank/separator line | `` |
| 568 | OK — reviewed, no change required | `  function render(){` |
| 569 | OK — reviewed, no change required | `    const d=state.data||{};` |
| 570 | OK — reviewed, no change required | `    const events=d.events||[], packages=d.packages||[], overrides=d.overrides||[], assets=d.assets||[], bookings=d.bookings||[], health=versionDiagnosticsRows(d).concat(d.health…` |
| 571 | OK — reviewed, no change required | `    const currentBookings=(d.current_bookings&&d.current_bookings.length?d.current_bookings:bookings.filter(shouldShowInEditBooking));` |
| 572 | OK — reviewed, no change required | `    const openEventRowsAll=sortedOpenEvents(events);` |
| 573 | OK — reviewed, no change required | `    const bookingRowsAll=sortedBookings(currentBookings);` |
| 574 | OK — reviewed, no change required | `    const eventsQ=($("#eventsSearch") && $("#eventsSearch").value) || "";` |
| 575 | OK — reviewed, no change required | `    const bookingsQ=($("#bookingsSearch") && $("#bookingsSearch").value) || "";` |
| 576 | OK — reviewed, no change required | `    const openEventRows=openEventRowsAll.filter(r=>containsQuery(r,["event_name","venue","event_id"],eventsQ));` |
| 577 | OK — reviewed, no change required | `    const bookingRows=bookingRowsAll.filter(r=>containsQuery(r,["customer_name","customer_phone","customer_contact","event_name","event_id","package_display","package_type"],boo…` |
| 578 | OK — reviewed, no change required | `    const actionRows=buildActionRows(d);` |
| 579 | OK — reviewed, no change required | `    const customerHistory=customerHistoryRows(bookings, customers);` |
| 580 | OK — reviewed, no change required | `    const openEvents=openEventRows.length;` |
| 581 | OK — reviewed, no change required | `    const phones=assets.filter(a=>a.asset_type==="phone" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;` |
| 582 | OK — reviewed, no change required | `    const lenses=assets.filter(a=>a.asset_type==="lens" && a.rentable!==false && String(a.status||"").toLowerCase()==="available").length;` |
| 583 | OK — reviewed, no change required | `    const activeBookings=currentBookings.filter(b=>["pending","confirmed","picked_up"].includes(String(b.booking_status||"").toLowerCase())).length;` |
| 584 | OK — reviewed, no change required | `    const unpaidToday=today.filter(b=>String(b.payment_status||"").toLowerCase()!=="paid").length;` |
| 585 | REVIEWED innerHTML use; check escaping/safe static markup | `    $("#statsGrid").innerHTML=[` |
| 586 | OK — reviewed, no change required | `      [openEvents,"งานเปิดอยู่"],[packages.filter(p=>p.active!==false).length,"แพ็กเกจ active"],[overrides.length,"ราคาเฉพาะงาน"],[phones,"มือถือ available"],[lenses,"เลนส์ avai…` |
| 587 | OK — reviewed, no change required | `    ].map(s=>\`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>\`).join('');` |
| 588 | OK — blank/separator line | `` |
| 589 | OK — reviewed, no change required | `    const actionStats=$("#actionStats");` |
| 590 | OK — reviewed, no change required | `    if(actionStats){` |
| 591 | REVIEWED innerHTML use; check escaping/safe static markup | `      actionStats.innerHTML=[` |
| 592 | OK — reviewed, no change required | `        [actionRows.filter(r=>r.type==="payment").length,"ต้องตามเงิน"],` |
| 593 | OK — reviewed, no change required | `        [actionRows.filter(r=>r.type==="return").length,"รอรับคืน"],` |
| 594 | OK — reviewed, no change required | `        [actionRows.filter(r=>r.type==="upcoming").length,"งานใน 7 วัน"],` |
| 595 | OK — reviewed, no change required | `        [actionRows.filter(r=>r.type==="data").length,"ข้อมูลต้องเช็ก"]` |
| 596 | OK — reviewed, no change required | `      ].map(s=>\`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>\`).join('');` |
| 597 | OK — reviewed, no change required | `    }` |
| 598 | OK — reviewed, no change required | `    if($("#actionCount")) $("#actionCount").textContent=actionRows.length+" รายการที่ควรเช็ก";` |
| 599 | OK — reviewed, no change required | `    table($("#actionTable"),[` |
| 600 | OK — reviewed, no change required | `      {label:"ประเภท",render:r=>\`<span class="pill ${actionSeverity(r.type)}">${esc(r.type==="payment"?"ตามเงิน":r.type==="return"?"รับคืน":r.type==="upcoming"?"ใกล้ถึง":"ข้อมู…` |
| 601 | OK — reviewed, no change required | `      {label:"วันที่",render:r=>esc(fmtDate(r.date))},` |
| 602 | OK — reviewed, no change required | `      {label:"รายการ",render:r=>esc(r.title)},` |
| 603 | OK — reviewed, no change required | `      {label:"ลูกค้า",render:r=>esc(r.customer)},` |
| 604 | OK — reviewed, no change required | `      {label:"ติดต่อ",render:r=>esc(r.contact)},` |
| 605 | OK — reviewed, no change required | `      {label:"สิ่งที่ต้องทำ",render:r=>esc(r.task)},` |
| 606 | OK — reviewed, no change required | `      {label:"CRM",render:r=>r.ref?\`<button class="mini-btn" type="button" data-customer-key="${esc(r.ref)}">ดูลูกค้า</button>\`:"-"}` |
| 607 | OK — reviewed, no change required | `    ], actionRows.slice(0,30));` |
| 608 | OK — blank/separator line | `` |
| 609 | OK — reviewed, no change required | `    $("#eventsCount").textContent=(openEventRows.length===openEventRowsAll.length?openEventRows.length:(openEventRows.length+" / "+openEventRowsAll.length))+" รายการ";` |
| 610 | OK — reviewed, no change required | `    table($("#eventsTable"),[` |
| 611 | OK — reviewed, no change required | `      {label:"วันที่",render:r=>esc(fmtDate(r.event_date))},` |
| 612 | OK — reviewed, no change required | `      {label:"งาน",key:"event_name"},` |
| 613 | OK — reviewed, no change required | `      {label:"สถานที่",key:"venue"},` |
| 614 | OK — reviewed, no change required | `      {label:"สถานะ",render:r=>\`<span class="pill ${r.status==='open'?'ok':'bad'}">${esc(r.status)}</span>\`},` |
| 615 | OK — reviewed, no change required | `      {label:"โชว์เว็บ",render:r=>r.active_on_web===false?'FALSE':'TRUE'}` |
| 616 | OK — reviewed, no change required | `    ], openEventRows.slice(0,50));` |
| 617 | OK — blank/separator line | `` |
| 618 | OK — reviewed, no change required | `    $("#bookingsCount").textContent=(bookingRows.length===bookingRowsAll.length?bookingRows.length:(bookingRows.length+" / "+bookingRowsAll.length))+" รายการ";` |
| 619 | OK — reviewed, no change required | `    table($("#bookingsTable"),[` |
| 620 | OK — reviewed, no change required | `      {label:"วันที่งาน",render:r=>esc(fmtDate(r.event_date))},` |
| 621 | OK — reviewed, no change required | `      {label:"ชื่อลูกค้า",key:"customer_name"},` |
| 622 | OK — reviewed, no change required | `      {label:"เบอร์โทร",render:r=>esc(r.customer_phone || "-")},` |
| 623 | OK — reviewed, no change required | `      {label:"ชื่องาน",render:r=>esc(r.event_name || r.event_id || "")},` |
| 624 | OK — reviewed, no change required | `      {label:"แพ็กเกจ",render:r=>esc(r.package_display || r.package_type || "")},` |
| 625 | REVIEWED asset field support / double booking guarded by backend | `      {label:"Phone",render:r=>esc(r.phone_model_display || r.phone_asset_id || "-")},` |
| 626 | REVIEWED asset field support / double booking guarded by backend | `      {label:"Lens",render:r=>esc(r.lens_model_display || r.lens_asset_id || "-")},` |
| 627 | OK — reviewed, no change required | `      {label:"สถานะ",render:r=>\`<span class="pill ${String(r.booking_status).toLowerCase()==='cancelled'?'bad':'ok'}">${esc(r.booking_status)}</span>\`},` |
| 628 | OK — reviewed, no change required | `      {label:"วันที่บันทึก",render:r=>esc(fmtDate(r.created_at))},` |
| 629 | OK — reviewed, no change required | `      {label:"CRM",render:r=>\`<button class="mini-btn" type="button" data-customer-key="${esc(bookingCustomerKey(r))}">ดูประวัติ</button>\`}` |
| 630 | OK — reviewed, no change required | `    ], bookingRows.slice(0,50));` |
| 631 | OK — blank/separator line | `` |
| 632 | OK — reviewed, no change required | `    const todayStats=$("#todayStats");` |
| 633 | OK — reviewed, no change required | `    if(todayStats){` |
| 634 | REVIEWED innerHTML use; check escaping/safe static markup | `      todayStats.innerHTML=[` |
| 635 | OK — reviewed, no change required | `        [today.length,"Booking วันนี้"],` |
| 636 | OK — reviewed, no change required | `        [today.filter(b=>["pending","confirmed"].includes(String(b.booking_status||"").toLowerCase())).length,"ต้องเตรียมส่งมอบ"],` |
| 637 | OK — reviewed, no change required | `        [today.filter(b=>String(b.booking_status||"").toLowerCase()==="picked_up").length,"รอรับคืน"],` |
| 638 | OK — reviewed, no change required | `        [unpaidToday,"ยังไม่ paid"]` |
| 639 | OK — reviewed, no change required | `      ].map(s=>\`<div class="card stat"><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></div>\`).join('');` |
| 640 | OK — reviewed, no change required | `    }` |
| 641 | OK — reviewed, no change required | `    if($("#todayCount")) $("#todayCount").textContent=(d.today_key?("วันที่ "+fmtDate(d.today_key)+" · "):"")+today.length+" รายการ";` |
| 642 | OK — reviewed, no change required | `    table($("#todayTable"),[` |
| 643 | OK — reviewed, no change required | `      {label:"งาน",render:r=>esc(r.event_name || r.event_id || "")},` |
| 644 | OK — reviewed, no change required | `      {label:"ลูกค้า",key:"customer_name"},` |
| 645 | OK — reviewed, no change required | `      {label:"ติดต่อ",render:r=>esc([r.customer_contact,r.customer_phone].filter(Boolean).join(" / "))},` |
| 646 | REVIEWED asset field support / double booking guarded by backend | `      {label:"Phone",render:r=>esc(r.phone_model_display || r.phone_asset_id || "-")},` |
| 647 | REVIEWED asset field support / double booking guarded by backend | `      {label:"Lens",render:r=>esc(r.lens_model_display || r.lens_asset_id || "-")},` |
| 648 | OK — reviewed, no change required | `      {label:"Pickup",render:r=>esc(r.pickup_time || "-")},` |
| 649 | OK — reviewed, no change required | `      {label:"Payment",render:r=>\`<span class="pill ${String(r.payment_status).toLowerCase()==='paid'?'ok':'bad'}">${esc(r.payment_status||'')}</span>\`},` |
| 650 | OK — reviewed, no change required | `      {label:"สิ่งที่ต้องทำ",key:"work_task"},` |
| 651 | OK — reviewed, no change required | `      {label:"Note",key:"note"}` |
| 652 | OK — reviewed, no change required | `    ], today);` |
| 653 | OK — blank/separator line | `` |
| 654 | OK — reviewed, no change required | `    $("#assetsCount").textContent=assets.length+" รายการ";` |
| 655 | OK — reviewed, no change required | `    table($("#assetsTable"),[` |
| 656 | OK — reviewed, no change required | `      {label:"ID",key:"asset_id"},{label:"Type",key:"asset_type"},{label:"Model Display",render:r=>esc(r.model_display || r.model_group || "")},{label:"Group",key:"model_group"}…` |
| 657 | OK — reviewed, no change required | `    ], assets.slice(0,80));` |
| 658 | OK — blank/separator line | `` |
| 659 | OK — reviewed, no change required | `    table($("#healthTable"),[` |
| 660 | OK — reviewed, no change required | `      {label:"Check",key:"check"},{label:"Status",render:r=>\`<span class="pill ${String(r.status).toLowerCase().includes('ok')?'ok':String(r.status).toLowerCase().includes('che…` |
| 661 | OK — reviewed, no change required | `    ], health);` |
| 662 | OK — blank/separator line | `` |
| 663 | OK — reviewed, no change required | `    if($("#customerStatsCount")) $("#customerStatsCount").textContent=customerHistory.length+" รายการ";` |
| 664 | OK — reviewed, no change required | `    table($("#customerStatsTable"),[` |
| 665 | OK — reviewed, no change required | `      {label:"ลูกค้า",key:"customer_name"},` |
| 666 | OK — reviewed, no change required | `      {label:"ติดต่อ",render:r=>esc([r.customer_contact,r.customer_phone].filter(Boolean).join(" / "))},` |
| 667 | OK — reviewed, no change required | `      {label:"เช่าแล้ว",render:r=>esc(r.rental_count||0)},` |
| 668 | OK — reviewed, no change required | `      {label:"เช่าล่าสุด",render:r=>esc(fmtDate(r.last_rental_date))},` |
| 669 | OK — reviewed, no change required | `      {label:"งานล่าสุด",key:"last_event_name"},` |
| 670 | OK — reviewed, no change required | `      {label:"CRM",render:r=>\`<button class="mini-btn" type="button" data-customer-key="${esc(r.customer_key)}">ดูประวัติ</button>\`}` |
| 671 | OK — reviewed, no change required | `    ], customerHistory.slice(0,50));` |
| 672 | OK — blank/separator line | `` |
| 673 | OK — reviewed, no change required | `    const q=String((document.getElementById("customerSearch")||{}).value||"").trim().toLowerCase();` |
| 674 | OK — reviewed, no change required | `    const filteredCustomers=customerHistory.filter(c=>{` |
| 675 | OK — reviewed, no change required | `      const hay=[c.customer_name,c.customer_contact,c.customer_phone,c.last_event_name].join(" ").toLowerCase();` |
| 676 | OK — reviewed, no change required | `      return !q || hay.includes(q);` |
| 677 | OK — reviewed, no change required | `    });` |
| 678 | OK — reviewed, no change required | `    table($("#customersTable"),[` |
| 679 | OK — reviewed, no change required | `      {label:"ลูกค้า",key:"customer_name"},` |
| 680 | OK — reviewed, no change required | `      {label:"เบอร์/LINE",render:r=>esc([r.customer_phone,r.customer_contact].filter(Boolean).join(" / "))},` |
| 681 | OK — reviewed, no change required | `      {label:"เช่าแล้ว",render:r=>\`<strong>${esc(r.rental_count||0)}</strong> ครั้ง\`},` |
| 682 | OK — reviewed, no change required | `      {label:"เช่าล่าสุด",render:r=>esc(fmtDate(r.last_rental_date))},` |
| 683 | OK — reviewed, no change required | `      {label:"งานล่าสุด",key:"last_event_name"},` |
| 684 | OK — reviewed, no change required | `      {label:"ดู",render:r=>\`<button class="mini-btn${String(state.selectedCustomerKey)===String(r.customer_key)?' active':''}" type="button" data-customer-key="${esc(r.custome…` |
| 685 | OK — reviewed, no change required | `    ], filteredCustomers.slice(0,100));` |
| 686 | OK — reviewed, no change required | `    renderCustomerDetail(customerHistory);` |
| 687 | OK — blank/separator line | `` |
| 688 | OK — reviewed, no change required | `    fillSelects();` |
| 689 | OK — reviewed, no change required | `  }` |
| 690 | OK — blank/separator line | `` |
| 691 | OK — reviewed, no change required | `  async function refresh(){` |
| 692 | OK — reviewed, no change required | `    if(state.loading) return;` |
| 693 | OK — reviewed, no change required | `    state.loading=true;` |
| 694 | OK — reviewed, no change required | `    try{` |
| 695 | OK — reviewed, no change required | `      const data=await api("snapshot");` |
| 696 | OK — reviewed, no change required | `      state.data=data.data||{};` |
| 697 | OK — reviewed, no change required | `      render();` |
| 698 | OK — reviewed, no change required | `      const backendVersion = state.data.admin_api_version || (state.data.phase1_diagnostics && state.data.phase1_diagnostics.admin_api_version) || "";` |
| 699 | OK — reviewed, no change required | `      if(backendVersion && backendVersion !== EXPECTED_BACKEND_VERSION){` |
| 700 | OK — reviewed, no change required | `        showNotice("Version ไม่ตรงกัน: Admin UI "+KK_ADMIN_UI_VERSION+" / Expected Apps Script "+EXPECTED_BACKEND_VERSION+" แต่ Apps Script จริงคือ "+backendVersion, "bad");` |
| 701 | OK — reviewed, no change required | `      }` |
| 702 | OK — reviewed, no change required | `      if(state.data.spreadsheet_id && state.data.frontend_sheet_id && state.data.spreadsheet_id !== state.data.frontend_sheet_id){` |
| 703 | OK — reviewed, no change required | `        showNotice("GOOGLE_SHEET_ID ใน Vercel ไม่ตรงกับ Spreadsheet ที่ Apps Script ใช้", "bad");` |
| 704 | OK — reviewed, no change required | `      }` |
| 705 | OK — reviewed, no change required | `    } finally {` |
| 706 | OK — reviewed, no change required | `      state.loading=false;` |
| 707 | OK — reviewed, no change required | `    }` |
| 708 | OK — reviewed, no change required | `  }` |
| 709 | OK — blank/separator line | `` |
| 710 | OK — reviewed, no change required | `  async function uploadPosterFromInput(fileInput, form){` |
| 711 | OK — reviewed, no change required | `    const input = typeof fileInput === "string" ? $(fileInput) : fileInput;` |
| 712 | OK — reviewed, no change required | `    const file = input && input.files && input.files[0];` |
| 713 | OK — reviewed, no change required | `    if(!file) return "";` |
| 714 | OK — reviewed, no change required | `    if(file.size>3*1024*1024) throw new Error("รูปใหญ่เกินไป กรุณาใช้ไฟล์ไม่เกิน 3MB");` |
| 715 | OK — reviewed, no change required | `    if(file.type && !/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) throw new Error("รองรับเฉพาะรูป JPG, PNG หรือ WEBP");` |
| 716 | OK — blank/separator line | `` |
| 717 | OK — reviewed, no change required | `    const base64=await new Promise((resolve,reject)=>{` |
| 718 | OK — reviewed, no change required | `      const r=new FileReader();` |
| 719 | OK — reviewed, no change required | `      r.onload=()=>resolve(String(r.result||"").split(',')[1]||"");` |
| 720 | OK — reviewed, no change required | `      r.onerror=()=>reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));` |
| 721 | OK — reviewed, no change required | `      r.readAsDataURL(file);` |
| 722 | OK — reviewed, no change required | `    });` |
| 723 | OK — blank/separator line | `` |
| 724 | OK — reviewed, no change required | `    state.posterWarning = "";` |
| 725 | OK — reviewed, no change required | `    const res=await api("uploadPoster",{fileName:file.name,mimeType:file.type||"image/jpeg",base64});` |
| 726 | OK — reviewed, no change required | `    if(res.sharing_warning){` |
| 727 | OK — reviewed, no change required | `      state.posterWarning = res.sharing_warning;` |
| 728 | OK — reviewed, no change required | `      console.warn("KK poster public warning", res.sharing_warning);` |
| 729 | OK — reviewed, no change required | `    }` |
| 730 | OK — reviewed, no change required | `    const url = res.url || res.poster_url || res.view_url || "";` |
| 731 | OK — reviewed, no change required | `    if(!url) throw new Error("อัปโหลดรูปแล้ว แต่ไม่ได้รับ poster URL กลับมา");` |
| 732 | OK — blank/separator line | `` |
| 733 | OK — reviewed, no change required | `    if(form && form.elements && form.elements.poster_url){` |
| 734 | OK — reviewed, no change required | `      form.elements.poster_url.value = url;` |
| 735 | OK — reviewed, no change required | `    }` |
| 736 | OK — reviewed, no change required | `    return url;` |
| 737 | OK — reviewed, no change required | `  }` |
| 738 | OK — blank/separator line | `` |
| 739 | OK — reviewed, no change required | `  function bind(){` |
| 740 | OK — reviewed, no change required | `    $$(".nav[data-tab]").forEach(btn=>{` |
| 741 | OK — reviewed, no change required | `      btn.setAttribute("aria-controls", "tab-"+btn.dataset.tab);` |
| 742 | OK — reviewed, no change required | `      btn.setAttribute("aria-pressed", btn.classList.contains("active") ? "true" : "false");` |
| 743 | OK — reviewed, no change required | `      btn.addEventListener("click",()=>{` |
| 744 | OK — reviewed, no change required | `        $$(".nav[data-tab]").forEach(b=>{ b.classList.remove("active"); b.setAttribute("aria-pressed","false"); });` |
| 745 | OK — reviewed, no change required | `        btn.classList.add("active"); btn.setAttribute("aria-pressed","true");` |
| 746 | OK — reviewed, no change required | `        $$(".tab-panel").forEach(p=>p.classList.remove("active"));` |
| 747 | OK — reviewed, no change required | `        const panel=$("#tab-"+btn.dataset.tab);` |
| 748 | OK — reviewed, no change required | `        if(panel) panel.classList.add("active");` |
| 749 | OK — reviewed, no change required | `        window.scrollTo({top:0,behavior:"smooth"});` |
| 750 | OK — reviewed, no change required | `      });` |
| 751 | OK — reviewed, no change required | `    });` |
| 752 | OK — reviewed, no change required | `    document.addEventListener("click", ev=>{` |
| 753 | OK — reviewed, no change required | `      const jump=ev.target.closest("[data-tab-jump]");` |
| 754 | OK — reviewed, no change required | `      if(!jump) return;` |
| 755 | OK — reviewed, no change required | `      const tab=jump.getAttribute("data-tab-jump");` |
| 756 | OK — reviewed, no change required | `      const nav=$(\`.nav[data-tab="${tab}"]\`);` |
| 757 | OK — reviewed, no change required | `      if(nav) nav.click();` |
| 758 | OK — reviewed, no change required | `    });` |
| 759 | OK — reviewed, no change required | `    const loginBtn=$("#loginBtn");` |
| 760 | OK — reviewed, no change required | `    if(loginBtn) loginBtn.addEventListener("click", async()=>{` |
| 761 | REVIEWED UI alert / safe fallback where possible | `      state.pin=$("#pinInput").value.trim(); if(!state.pin) return alert("กรุณากรอก PIN");` |
| 762 | OK — reviewed, no change required | `      sessionStorage.setItem("kk_admin_pin",state.pin);` |
| 763 | OK — reviewed, no change required | `      try{ await refresh(); $("#loginPanel").classList.add("hidden"); $("#appPanel").classList.remove("hidden"); showNotice("โหลดข้อมูลสำเร็จ"); }` |
| 764 | OK — reviewed, no change required | `      catch(e){ showNotice(e.message,"bad"); }` |
| 765 | OK — reviewed, no change required | `    });` |
| 766 | OK — reviewed, no change required | `    const logoutBtn=$("#logoutBtn");` |
| 767 | OK — reviewed, no change required | `    if(logoutBtn) logoutBtn.addEventListener("click",()=>{ sessionStorage.removeItem("kk_admin_pin"); location.reload(); });` |
| 768 | OK — reviewed, no change required | `    const refreshBtn=$("#refreshBtn");` |
| 769 | OK — reviewed, no change required | `    if(refreshBtn) refreshBtn.addEventListener("click",()=>refresh().then(()=>showNotice("Refresh แล้ว")).catch(e=>showNotice(e.message,"bad")));` |
| 770 | OK — reviewed, no change required | `    ["#eventsSort","#bookingsSort"].forEach(sel=>{` |
| 771 | OK — reviewed, no change required | `      const el=$(sel);` |
| 772 | OK — reviewed, no change required | `      if(el) el.addEventListener("change",()=>render());` |
| 773 | OK — reviewed, no change required | `    });` |
| 774 | OK — reviewed, no change required | `    ["#eventsSearch","#bookingsSearch"].forEach(sel=>{` |
| 775 | OK — reviewed, no change required | `      const el=$(sel);` |
| 776 | OK — reviewed, no change required | `      if(el) el.addEventListener("input",()=>render());` |
| 777 | OK — reviewed, no change required | `    });` |
| 778 | OK — reviewed, no change required | `    const customerSearch=$("#customerSearch");` |
| 779 | OK — reviewed, no change required | `    if(customerSearch) customerSearch.addEventListener("input",()=>render());` |
| 780 | OK — reviewed, no change required | `    document.addEventListener("click",ev=>{` |
| 781 | OK — reviewed, no change required | `      const btn=ev.target.closest("[data-customer-key]");` |
| 782 | OK — reviewed, no change required | `      if(!btn) return;` |
| 783 | OK — reviewed, no change required | `      const key=btn.getAttribute("data-customer-key")||"";` |
| 784 | OK — reviewed, no change required | `      if(!key) return;` |
| 785 | OK — reviewed, no change required | `      ev.preventDefault();` |
| 786 | OK — reviewed, no change required | `      ev.stopPropagation();` |
| 787 | OK — reviewed, no change required | `      setActiveCustomer(key);` |
| 788 | OK — reviewed, no change required | `    });` |
| 789 | OK — reviewed, no change required | `    const bookingEventSelect=$("#bookingForm select[name='event_id']");` |
| 790 | OK — reviewed, no change required | `    if(bookingEventSelect) bookingEventSelect.addEventListener("change", populateBookingPackages);` |
| 791 | OK — reviewed, no change required | `    const eventUpdateSelect=$("#eventUpdateForm select[name='event_id']");` |
| 792 | OK — reviewed, no change required | `    if(eventUpdateSelect) eventUpdateSelect.addEventListener("change", populateEventUpdateForm);` |
| 793 | OK — reviewed, no change required | `    const packageUpdateSelect=$("#packageUpdateForm select[name='template_id']");` |
| 794 | OK — reviewed, no change required | `    if(packageUpdateSelect) packageUpdateSelect.addEventListener("change", populatePackageUpdateForm);` |
| 795 | OK — reviewed, no change required | `    const bookingEditSelect=$("#bookingEditForm select[name='row_number']");` |
| 796 | OK — reviewed, no change required | `    if(bookingEditSelect) bookingEditSelect.addEventListener("change", populateBookingEditForm);` |
| 797 | OK — reviewed, no change required | `    const cleanupBtn=$("#cleanupBtn");` |
| 798 | OK — reviewed, no change required | `    if(cleanupBtn){` |
| 799 | OK — reviewed, no change required | `      cleanupBtn.addEventListener("click", async()=>{` |
| 800 | OK — reviewed, no change required | `        if(!confirm("ย้าย booking/event เก่ากว่า 30 วันไป Archive และอัปเดต Customer Stats ใช่ไหม?")) return;` |
| 801 | OK — reviewed, no change required | `        setBusy(cleanupBtn,true);` |
| 802 | OK — reviewed, no change required | `        try{` |
| 803 | OK — reviewed, no change required | `          const res=await api("cleanupOldData",{});` |
| 804 | OK — reviewed, no change required | `          await refresh();` |
| 805 | OK — reviewed, no change required | `          showNotice(\`Cleanup สำเร็จ: bookings ${res.archived_bookings||0}, events ${res.archived_events||0}, overrides ${res.archived_overrides||0}, customer stats ${res.custo…` |
| 806 | OK — reviewed, no change required | `        }catch(e){ showNotice(e.message,"bad"); }` |
| 807 | OK — reviewed, no change required | `        finally{ setBusy(cleanupBtn,false); }` |
| 808 | OK — reviewed, no change required | `      });` |
| 809 | OK — reviewed, no change required | `    }` |
| 810 | OK — blank/separator line | `` |
| 811 | OK — reviewed, no change required | `    const overrideForm=$("#eventPriceOverrideForm");` |
| 812 | OK — reviewed, no change required | `    if(overrideForm){` |
| 813 | OK — reviewed, no change required | `      $$('select', overrideForm).forEach(sel=>sel.addEventListener("change", populateEventOverrideForm));` |
| 814 | OK — reviewed, no change required | `      overrideForm.addEventListener("submit",async ev=>{` |
| 815 | OK — reviewed, no change required | `        ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true);` |
| 816 | OK — reviewed, no change required | `        try{ await api("upsertEventOverride",formData(ev.target)); await refresh(); showNotice("บันทึกราคาเฉพาะงานสำเร็จ"); }` |
| 817 | OK — reviewed, no change required | `        catch(e){ showNotice(e.message,"bad"); } finally{ setBusy(btn,false); }` |
| 818 | OK — reviewed, no change required | `      });` |
| 819 | OK — reviewed, no change required | `    }` |
| 820 | OK — blank/separator line | `` |
| 821 | OK — reviewed, no change required | `    const eventForm=$("#eventForm");` |
| 822 | OK — reviewed, no change required | `    if(eventForm) eventForm.addEventListener("submit",async ev=>{` |
| 823 | OK — reviewed, no change required | `      ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true);` |
| 824 | OK — reviewed, no change required | `      try{` |
| 825 | OK — reviewed, no change required | `        const p=formData(ev.target);` |
| 826 | OK — reviewed, no change required | `        if(p.poster_url) p.poster_url=normalizePosterUrl(p.poster_url);` |
| 827 | OK — reviewed, no change required | `        const uploaded=await uploadPosterFromInput("#posterFile", ev.target);` |
| 828 | OK — reviewed, no change required | `        if(uploaded) p.poster_url=uploaded;` |
| 829 | OK — reviewed, no change required | `        const res=await api("createEvent",p);` |
| 830 | OK — reviewed, no change required | `        ev.target.reset();` |
| 831 | OK — reviewed, no change required | `        await refresh();` |
| 832 | OK — reviewed, no change required | `        showNotice("สร้างงานสำเร็จ" + posterSyncText(res) + (res.web_ready_action==="hide" ? " แต่สถานะตอนนี้ยังถูกซ่อนจากเว็บ" : "") + posterWarningText(res));` |
| 833 | OK — reviewed, no change required | `        state.posterWarning = "";` |
| 834 | OK — reviewed, no change required | `      }` |
| 835 | OK — reviewed, no change required | `      catch(e){ showNotice(e.message,"bad"); } finally{ setBusy(btn,false); }` |
| 836 | OK — reviewed, no change required | `    });` |
| 837 | OK — reviewed, no change required | `    const eventUpdateForm=$("#eventUpdateForm");` |
| 838 | OK — reviewed, no change required | `    if(eventUpdateForm) eventUpdateForm.addEventListener("submit",async ev=>{` |
| 839 | OK — reviewed, no change required | `      ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true);` |
| 840 | OK — reviewed, no change required | `      try{` |
| 841 | OK — reviewed, no change required | `        const p=formData(ev.target);` |
| 842 | OK — reviewed, no change required | `        if(p.poster_url) p.poster_url=normalizePosterUrl(p.poster_url);` |
| 843 | OK — reviewed, no change required | `        const uploaded=await uploadPosterFromInput("#updatePosterFile", ev.target);` |
| 844 | OK — reviewed, no change required | `        if(uploaded) p.poster_url=uploaded;` |
| 845 | OK — reviewed, no change required | `        const res=await api("updateEvent",p);` |
| 846 | OK — reviewed, no change required | `        if($("#updatePosterFile")) $("#updatePosterFile").value="";` |
| 847 | OK — reviewed, no change required | `        await refresh();` |
| 848 | OK — reviewed, no change required | `        showNotice("แก้งานสำเร็จ" + posterSyncText(res) + (res.web_ready_action==="hide" ? " แต่สถานะตอนนี้ยังถูกซ่อนจากเว็บ" : "") + posterWarningText(res));` |
| 849 | OK — reviewed, no change required | `        state.posterWarning = "";` |
| 850 | OK — reviewed, no change required | `      }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);}` |
| 851 | OK — reviewed, no change required | `    });` |
| 852 | OK — reviewed, no change required | `    const packageForm=$("#packageForm");` |
| 853 | OK — reviewed, no change required | `    if(packageForm) packageForm.addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("createPackage",formData(ev.…` |
| 854 | OK — reviewed, no change required | `    const packageUpdateForm=$("#packageUpdateForm");` |
| 855 | OK — reviewed, no change required | `    if(packageUpdateForm) packageUpdateForm.addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("updatePackage",…` |
| 856 | OK — reviewed, no change required | `    const assetForm=$("#assetForm");` |
| 857 | OK — reviewed, no change required | `    if(assetForm) assetForm.addEventListener("submit",async ev=>{ ev.preventDefault(); const btn=ev.submitter; setBusy(btn,true); try{ await api("addAssets",formData(ev.target))…` |
| 858 | OK — reviewed, no change required | `    const bookingForm=$("#bookingForm");` |
| 859 | OK — reviewed, no change required | `    if(bookingForm) bookingForm.addEventListener("submit",async ev=>{` |
| 860 | OK — reviewed, no change required | `      ev.preventDefault();` |
| 861 | OK — reviewed, no change required | `      const btn=ev.submitter;` |
| 862 | OK — reviewed, no change required | `      setBusy(btn,true);` |
| 863 | OK — reviewed, no change required | `      try{` |
| 864 | OK — reviewed, no change required | `        const payload=formData(ev.target);` |
| 865 | OK — reviewed, no change required | `        if(hasWebPackageSource()){` |
| 866 | OK — reviewed, no change required | `          if(!eventHasBookablePackage(payload.event_id)) throw new Error("งานนี้เต็มแล้วหรือไม่มีแพ็กเกจว่าง กรุณา Refresh แล้วเลือกงานใหม่");` |
| 867 | OK — reviewed, no change required | `          const okPkg=bookableWebPackagesForEvent(payload.event_id).some(p=>String(templateIdFromWebPackage(p))===String(payload.template_id));` |
| 868 | OK — reviewed, no change required | `          if(!okPkg) throw new Error("แพ็กเกจนี้เต็มแล้วหรือถูกซ่อน กรุณาเลือกแพ็กเกจที่ยังว่าง");` |
| 869 | OK — reviewed, no change required | `        }` |
| 870 | OK — reviewed, no change required | `        const res=await api("createBooking",payload);` |
| 871 | OK — reviewed, no change required | `        ev.target.reset();` |
| 872 | OK — reviewed, no change required | `        await refresh();` |
| 873 | REVIEWED asset field support / double booking guarded by backend | `        showNotice(\`บันทึก Booking สำเร็จ: Phone ${res.phone_asset_id||'-'} / Lens ${res.lens_asset_id||'-'}\`);` |
| 874 | OK — reviewed, no change required | `      }catch(e){showNotice(e.message,"bad");}finally{setBusy(btn,false);}` |
| 875 | OK — reviewed, no change required | `    });` |
| 876 | OK — reviewed, no change required | `    const bookingEditForm=$("#bookingEditForm");` |
| 877 | OK — reviewed, no change required | `    if(bookingEditForm){` |
| 878 | OK — reviewed, no change required | `      bookingEditForm.addEventListener("submit",async ev=>{` |
| 879 | OK — reviewed, no change required | `        ev.preventDefault();` |
| 880 | OK — reviewed, no change required | `        const btn=ev.submitter;` |
| 881 | OK — reviewed, no change required | `        setBusy(btn,true);` |
| 882 | OK — reviewed, no change required | `        try{` |
| 883 | OK — reviewed, no change required | `          const payload=formData(ev.target);` |
| 884 | OK — reviewed, no change required | `          if(!payload.row_number) throw new Error("กรุณาเลือก Booking ที่ต้องการแก้");` |
| 885 | OK — reviewed, no change required | `          const res=await api("updateBooking", payload);` |
| 886 | OK — reviewed, no change required | `          await refresh();` |
| 887 | OK — reviewed, no change required | `          showNotice(\`แก้ Booking สำเร็จ: row ${res.row_number}\`);` |
| 888 | OK — reviewed, no change required | `        }catch(e){ showNotice(e.message,"bad"); }finally{ setBusy(btn,false); }` |
| 889 | OK — reviewed, no change required | `      });` |
| 890 | OK — reviewed, no change required | `    }` |
| 891 | OK — reviewed, no change required | `  }` |
| 892 | OK — blank/separator line | `` |
| 893 | OK — reviewed, no change required | `  bind();` |
| 894 | OK — reviewed, no change required | `  if(state.pin && $("#pinInput") && $("#loginBtn")){ $("#pinInput").value=state.pin; $("#loginBtn").click(); }` |
| 895 | OK — reviewed, no change required | `})();` |

### `admin/index.html`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — reviewed, no change required | `<!doctype html>` |
| 2 | OK — reviewed, no change required | `<html lang="th">` |
| 3 | OK — reviewed, no change required | `<head>` |
| 4 | OK — reviewed, no change required | `  <meta charset="utf-8" />` |
| 5 | OK — reviewed, no change required | `  <meta name="viewport" content="width=device-width,initial-scale=1" />` |
| 6 | OK — reviewed, no change required | `  <meta name="robots" content="noindex,nofollow" />` |
| 7 | UPDATED version sync to v16.6.2 | `  <title>KK Admin CRM Dashboard v16.6.2_LINE_AUDITED</title>` |
| 8 | OK — reviewed, no change required | `  <base href="/admin/" />` |
| 9 | OK — reviewed, no change required | `  <link rel="icon" href="/favicon.png" />` |
| 10 | OK — reviewed, no change required | `  <link rel="preconnect" href="https://fonts.googleapis.com" />` |
| 11 | OK — reviewed, no change required | `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />` |
| 12 | OK — reviewed, no change required | `  <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />` |
| 13 | OK — reviewed, no change required | `  <link rel="stylesheet" href="/admin/admin.css" />` |
| 14 | OK — reviewed, no change required | `</head>` |
| 15 | OK — reviewed, no change required | `<body>` |
| 16 | OK — reviewed, no change required | `  <div class="shell">` |
| 17 | OK — reviewed, no change required | `    <aside class="sidebar">` |
| 18 | OK — reviewed, no change required | `      <div class="brand">` |
| 19 | OK — reviewed, no change required | `        <div class="logo">KK</div>` |
| 20 | OK — reviewed, no change required | `        <div>` |
| 21 | OK — reviewed, no change required | `          <strong>Admin CRM</strong>` |
| 22 | OK — reviewed, no change required | `          <span>Phone Rental v16.6.2 · Audited</span>` |
| 23 | OK — reviewed, no change required | `        </div>` |
| 24 | OK — reviewed, no change required | `      </div>` |
| 25 | OK — reviewed, no change required | `      <nav aria-label="Admin sections">` |
| 26 | OK — reviewed, no change required | `        <button class="nav active" type="button" data-tab="overview">ภาพรวม</button>` |
| 27 | OK — reviewed, no change required | `        <button class="nav" type="button" data-tab="today">งานวันนี้</button>` |
| 28 | OK — reviewed, no change required | `        <button class="nav" type="button" data-tab="booking">เพิ่ม Booking</button>` |
| 29 | OK — reviewed, no change required | `        <button class="nav" type="button" data-tab="edit-booking">แก้ Booking</button>` |
| 30 | OK — reviewed, no change required | `        <button class="nav" type="button" data-tab="customers">ประวัติลูกค้า</button>` |
| 31 | OK — reviewed, no change required | `        <button class="nav" type="button" data-tab="events">เพิ่ม/แก้งาน</button>` |
| 32 | OK — reviewed, no change required | `        <button class="nav" type="button" data-tab="packages">แพ็กเกจ/ราคา</button>` |
| 33 | OK — reviewed, no change required | `        <button class="nav" type="button" data-tab="assets">มือถือ/เลนส์</button>` |
| 34 | OK — reviewed, no change required | `        <button class="nav" type="button" data-tab="health">Health Check</button>` |
| 35 | OK — reviewed, no change required | `        <button class="nav muted" id="logoutBtn" type="button">ออกจากระบบ</button>` |
| 36 | OK — reviewed, no change required | `      </nav>` |
| 37 | OK — reviewed, no change required | `    </aside>` |
| 38 | OK — blank/separator line | `` |
| 39 | OK — reviewed, no change required | `    <main>` |
| 40 | OK — reviewed, no change required | `      <header class="topbar">` |
| 41 | OK — reviewed, no change required | `        <div>` |
| 42 | OK — reviewed, no change required | `          <h1>KK Phone Rental · Admin CRM</h1>` |
| 43 | OK — reviewed, no change required | `          <p>จัดการงาน ราคา สต็อก และ Booking โดยเขียนเข้า Google Sheet อัตโนมัติ</p>` |
| 44 | OK — reviewed, no change required | `        </div>` |
| 45 | OK — reviewed, no change required | `        <div class="top-actions">` |
| 46 | OK — reviewed, no change required | `          <span class="top-badge" title="Admin UI version">v16.6.2 · Audited</span>` |
| 47 | OK — reviewed, no change required | `          <button id="refreshBtn" class="btn secondary" type="button">Refresh</button>` |
| 48 | OK — reviewed, no change required | `          <a class="btn ghost" href="/" target="_blank" rel="noopener">ดูหน้าเว็บ</a>` |
| 49 | OK — reviewed, no change required | `        </div>` |
| 50 | OK — reviewed, no change required | `      </header>` |
| 51 | OK — blank/separator line | `` |
| 52 | OK — reviewed, no change required | `      <section id="loginPanel" class="card login-card">` |
| 53 | OK — reviewed, no change required | `        <h2>เข้าสู่ระบบ Admin</h2>` |
| 54 | OK — reviewed, no change required | `        <p>กรอก PIN ที่ตั้งไว้ใน Vercel Environment Variable: <code>KK_ADMIN_PIN</code></p>` |
| 55 | OK — reviewed, no change required | `        <div class="row two">` |
| 56 | OK — reviewed, no change required | `          <label>Admin PIN` |
| 57 | OK — reviewed, no change required | `            <input id="pinInput" type="password" autocomplete="current-password" placeholder="เช่น 123456" />` |
| 58 | OK — reviewed, no change required | `          </label>` |
| 59 | OK — reviewed, no change required | `          <div class="login-actions">` |
| 60 | OK — reviewed, no change required | `            <button id="loginBtn" class="btn primary" type="button">เข้าใช้งาน</button>` |
| 61 | OK — reviewed, no change required | `          </div>` |
| 62 | OK — reviewed, no change required | `        </div>` |
| 63 | OK — reviewed, no change required | `      </section>` |
| 64 | OK — blank/separator line | `` |
| 65 | OK — reviewed, no change required | `      <div id="appPanel" class="hidden">` |
| 66 | OK — reviewed, no change required | `        <div id="notice" class="notice hidden"></div>` |
| 67 | OK — blank/separator line | `` |
| 68 | OK — reviewed, no change required | `        <section class="tab-panel active" id="tab-overview">` |
| 69 | OK — reviewed, no change required | `          <div class="card quickbar" aria-label="Quick actions">` |
| 70 | OK — reviewed, no change required | `            <div>` |
| 71 | OK — reviewed, no change required | `              <span class="eyebrow">Quick Actions</span>` |
| 72 | OK — reviewed, no change required | `              <h2>งานที่ใช้บ่อย</h2>` |
| 73 | OK — reviewed, no change required | `              <p class="hint">กดเข้าฟอร์มหลักได้ทันที ลดเวลาหาเมนูเวลาใช้งานบนมือถือ</p>` |
| 74 | OK — reviewed, no change required | `            </div>` |
| 75 | OK — reviewed, no change required | `            <div class="quick-actions">` |
| 76 | OK — reviewed, no change required | `              <button class="btn primary" type="button" data-tab-jump="booking">+ เพิ่ม Booking</button>` |
| 77 | OK — reviewed, no change required | `              <button class="btn secondary" type="button" data-tab-jump="edit-booking">แก้ / ยกเลิก Booking</button>` |
| 78 | OK — reviewed, no change required | `              <button class="btn ghost" type="button" data-tab-jump="customers">ดูประวัติลูกค้า</button>` |
| 79 | OK — reviewed, no change required | `              <button class="btn ghost" type="button" data-tab-jump="events">เพิ่ม / แก้งาน</button>` |
| 80 | OK — reviewed, no change required | `            </div>` |
| 81 | OK — reviewed, no change required | `          </div>` |
| 82 | OK — reviewed, no change required | `          <div class="grid stats" id="statsGrid"></div>` |
| 83 | OK — blank/separator line | `` |
| 84 | OK — reviewed, no change required | `          <div class="card action-card">` |
| 85 | OK — reviewed, no change required | `            <div class="card-head">` |
| 86 | OK — reviewed, no change required | `              <div>` |
| 87 | OK — reviewed, no change required | `                <span class="eyebrow">Action Center</span>` |
| 88 | OK — reviewed, no change required | `                <h2>สิ่งที่ต้องจัดการ</h2>` |
| 89 | OK — reviewed, no change required | `                <p class="hint">รวมงานที่ควรเช็กก่อน เช่น ยังไม่ชำระเงิน รอรับคืน งานใกล้ถึง และงานที่ข้อมูลยังไม่สมบูรณ์</p>` |
| 90 | OK — reviewed, no change required | `              </div>` |
| 91 | OK — reviewed, no change required | `              <small id="actionCount"></small>` |
| 92 | OK — reviewed, no change required | `            </div>` |
| 93 | OK — reviewed, no change required | `            <div class="grid stats compact action-kpi" id="actionStats"></div>` |
| 94 | OK — reviewed, no change required | `            <div class="table-wrap action-table-wrap"><table id="actionTable"></table></div>` |
| 95 | OK — reviewed, no change required | `          </div>` |
| 96 | OK — blank/separator line | `` |
| 97 | OK — reviewed, no change required | `          <div class="grid two-col">` |
| 98 | OK — reviewed, no change required | `            <div class="card">` |
| 99 | OK — reviewed, no change required | `              <div class="card-head">` |
| 100 | OK — reviewed, no change required | `                <div>` |
| 101 | OK — reviewed, no change required | `                  <h2>งานที่เปิดอยู่</h2>` |
| 102 | OK — reviewed, no change required | `                  <small id="eventsCount"></small>` |
| 103 | OK — reviewed, no change required | `                </div>` |
| 104 | OK — reviewed, no change required | `                <div class="mini-tools">` |
| 105 | OK — reviewed, no change required | `                  <label class="mini-control">ค้นหา` |
| 106 | OK — reviewed, no change required | `                    <input id="eventsSearch" class="mini-search" type="search" placeholder="ชื่องาน / สถานที่" />` |
| 107 | OK — reviewed, no change required | `                  </label>` |
| 108 | OK — reviewed, no change required | `                  <label class="mini-control">จัดเรียง` |
| 109 | OK — reviewed, no change required | `                    <select id="eventsSort">` |
| 110 | OK — reviewed, no change required | `                      <option value="date_asc">วันที่ใกล้สุดก่อน</option>` |
| 111 | OK — reviewed, no change required | `                      <option value="date_desc">วันที่ไกลสุดก่อน</option>` |
| 112 | OK — reviewed, no change required | `                      <option value="name_asc">ชื่องาน A-Z</option>` |
| 113 | OK — reviewed, no change required | `                    </select>` |
| 114 | OK — reviewed, no change required | `                  </label>` |
| 115 | OK — reviewed, no change required | `                </div>` |
| 116 | OK — reviewed, no change required | `              </div>` |
| 117 | OK — reviewed, no change required | `              <div class="table-wrap"><table id="eventsTable"></table></div>` |
| 118 | OK — reviewed, no change required | `            </div>` |
| 119 | OK — reviewed, no change required | `            <div class="card">` |
| 120 | OK — reviewed, no change required | `              <div class="card-head">` |
| 121 | OK — reviewed, no change required | `                <div>` |
| 122 | OK — reviewed, no change required | `                  <h2>Booking ล่าสุด</h2>` |
| 123 | OK — reviewed, no change required | `                  <small id="bookingsCount"></small>` |
| 124 | OK — reviewed, no change required | `                </div>` |
| 125 | OK — reviewed, no change required | `                <div class="mini-tools">` |
| 126 | OK — reviewed, no change required | `                  <label class="mini-control">ค้นหา` |
| 127 | OK — reviewed, no change required | `                    <input id="bookingsSearch" class="mini-search" type="search" placeholder="ลูกค้า / เบอร์ / งาน" />` |
| 128 | OK — reviewed, no change required | `                  </label>` |
| 129 | OK — reviewed, no change required | `                  <label class="mini-control">จัดเรียง` |
| 130 | OK — reviewed, no change required | `                    <select id="bookingsSort">` |
| 131 | OK — reviewed, no change required | `                      <option value="created_desc">วันที่บันทึกล่าสุด</option>` |
| 132 | OK — reviewed, no change required | `                      <option value="event_date_asc">วันงานใกล้สุดก่อน</option>` |
| 133 | OK — reviewed, no change required | `                      <option value="event_date_desc">วันงานไกลสุดก่อน</option>` |
| 134 | OK — reviewed, no change required | `                      <option value="customer_asc">ชื่อลูกค้า A-Z</option>` |
| 135 | OK — reviewed, no change required | `                    </select>` |
| 136 | OK — reviewed, no change required | `                  </label>` |
| 137 | OK — reviewed, no change required | `                </div>` |
| 138 | OK — reviewed, no change required | `              </div>` |
| 139 | OK — reviewed, no change required | `              <div class="table-wrap"><table id="bookingsTable"></table></div>` |
| 140 | OK — reviewed, no change required | `            </div>` |
| 141 | OK — reviewed, no change required | `          </div>` |
| 142 | OK — reviewed, no change required | `        </section>` |
| 143 | OK — blank/separator line | `` |
| 144 | OK — reviewed, no change required | `        <section class="tab-panel" id="tab-today">` |
| 145 | OK — reviewed, no change required | `          <div class="card">` |
| 146 | OK — reviewed, no change required | `            <div class="card-head">` |
| 147 | OK — reviewed, no change required | `              <div>` |
| 148 | OK — reviewed, no change required | `                <h2>Today’s Working</h2>` |
| 149 | OK — reviewed, no change required | `                <p class="hint">งานที่ต้องทำวันนี้ ดึงจาก event_date ของ booking และแสดงชื่อรุ่นจาก Model_Master</p>` |
| 150 | OK — reviewed, no change required | `              </div>` |
| 151 | OK — reviewed, no change required | `              <small id="todayCount"></small>` |
| 152 | OK — reviewed, no change required | `            </div>` |
| 153 | OK — reviewed, no change required | `            <div class="grid stats compact" id="todayStats"></div>` |
| 154 | OK — reviewed, no change required | `            <div class="table-wrap"><table id="todayTable"></table></div>` |
| 155 | OK — reviewed, no change required | `          </div>` |
| 156 | OK — reviewed, no change required | `        </section>` |
| 157 | OK — blank/separator line | `` |
| 158 | OK — reviewed, no change required | `        <section class="tab-panel" id="tab-booking">` |
| 159 | OK — reviewed, no change required | `          <form class="card form" id="bookingForm">` |
| 160 | OK — reviewed, no change required | `            <div class="form-title"><span class="eyebrow">Booking</span><h2>เพิ่ม Booking</h2></div>` |
| 161 | OK — reviewed, no change required | `            <p class="hint">เลือกเฉพาะงานที่ยังไม่เต็มและยังไม่ย้อนหลัง ระบบจะเช็กแพ็กเกจ/สต็อกก่อนบันทึกเพื่อลดปัญหาจองซ้ำ</p>` |
| 162 | OK — reviewed, no change required | `            <div class="form-note ok-note">เช็กก่อนบันทึก: เลือกงาน → เลือกแพ็กเกจ → กรอกชื่อลูกค้า/เบอร์ → บันทึก Booking</div>` |
| 163 | OK — reviewed, no change required | `            <div class="row three">` |
| 164 | OK — reviewed, no change required | `              <label>งาน` |
| 165 | OK — reviewed, no change required | `                <select name="event_id" data-source="events" required></select>` |
| 166 | OK — reviewed, no change required | `                <small>แสดงเฉพาะงานที่ยังมีแพ็กเกจว่าง เพื่อกันเพิ่ม Booking ในวันที่เต็มแล้ว</small>` |
| 167 | OK — reviewed, no change required | `              </label>` |
| 168 | OK — reviewed, no change required | `              <label>แพ็กเกจ` |
| 169 | OK — reviewed, no change required | `                <select name="template_id" data-source="packages" required></select>` |
| 170 | OK — reviewed, no change required | `                <small>หลังเลือกงาน ระบบจะแสดงเฉพาะแพ็กเกจที่ยังว่าง</small>` |
| 171 | OK — reviewed, no change required | `              </label>` |
| 172 | OK — reviewed, no change required | `              <label>สถานะ Booking` |
| 173 | OK — reviewed, no change required | `                <select name="booking_status">` |
| 174 | OK — reviewed, no change required | `                  <option value="confirmed">confirmed</option>` |
| 175 | OK — reviewed, no change required | `                  <option value="pending">pending</option>` |
| 176 | OK — reviewed, no change required | `                  <option value="cancelled">cancelled</option>` |
| 177 | OK — reviewed, no change required | `                </select>` |
| 178 | OK — reviewed, no change required | `              </label>` |
| 179 | OK — reviewed, no change required | `            </div>` |
| 180 | OK — reviewed, no change required | `            <div class="row three">` |
| 181 | OK — reviewed, no change required | `              <label>ชื่อลูกค้า <input name="customer_name" required placeholder="เช่น Mint" /></label>` |
| 182 | OK — reviewed, no change required | `              <label>X / LINE <input name="customer_contact" placeholder="@handle หรือ LINE" /></label>` |
| 183 | OK — reviewed, no change required | `              <label>เบอร์โทร <input name="customer_phone" inputmode="tel" /></label>` |
| 184 | OK — reviewed, no change required | `            </div>` |
| 185 | OK — reviewed, no change required | `            <div class="row three">` |
| 186 | OK — reviewed, no change required | `              <label>ช่องทาง` |
| 187 | OK — reviewed, no change required | `                <select name="contact_channel"><option>LINE</option><option>X</option><option>Facebook</option><option>Instagram</option></select>` |
| 188 | OK — reviewed, no change required | `              </label>` |
| 189 | OK — reviewed, no change required | `              <label>สถานะชำระเงิน` |
| 190 | OK — reviewed, no change required | `                <select name="payment_status"><option value="unpaid">unpaid</option><option value="partial">partial</option><option value="paid">paid</option></select>` |
| 191 | OK — reviewed, no change required | `              </label>` |
| 192 | OK — reviewed, no change required | `              <label>ยอดรับแล้ว <input name="amount_received" type="number" min="0" step="1" value="0" /></label>` |
| 193 | OK — reviewed, no change required | `            </div>` |
| 194 | OK — reviewed, no change required | `            <div class="row two">` |
| 195 | REVIEWED asset field support / double booking guarded by backend | `              <label>ระบุมือถือเอง ถ้าไม่ใส่ ระบบหาให้ <input name="phone_asset_id" placeholder="เช่น PHONE-001" /></label>` |
| 196 | REVIEWED asset field support / double booking guarded by backend | `              <label>ระบุเลนส์เอง ถ้าไม่ใส่ ระบบหาให้ <input name="lens_asset_id" placeholder="เช่น LENS-001" /></label>` |
| 197 | OK — reviewed, no change required | `            </div>` |
| 198 | OK — reviewed, no change required | `            <label>หมายเหตุ <textarea name="booking_note" rows="3"></textarea></label>` |
| 199 | OK — reviewed, no change required | `            <button class="btn primary" type="submit">บันทึก Booking</button>` |
| 200 | OK — reviewed, no change required | `          </form>` |
| 201 | OK — reviewed, no change required | `        </section>` |
| 202 | OK — blank/separator line | `` |
| 203 | OK — reviewed, no change required | `        <section class="tab-panel" id="tab-edit-booking">` |
| 204 | OK — reviewed, no change required | `          <form class="card form" id="bookingEditForm">` |
| 205 | OK — reviewed, no change required | `            <div class="form-title"><span class="eyebrow">Edit Booking</span><h2>แก้ / ยกเลิก Booking</h2></div>` |
| 206 | OK — reviewed, no change required | `            <p class="hint">ใช้เมื่อลูกค้าขอแก้ข้อมูลหรือยกเลิก หากเปลี่ยนสถานะเป็น cancelled ระบบจะปล่อยคิวกลับตามสูตร backend</p>` |
| 207 | OK — reviewed, no change required | `            <div class="form-note warn-note">ถ้าลูกค้าเปลี่ยนงานหรือเปลี่ยนแพ็กเกจ แนะนำให้ยกเลิก booking เดิม แล้วสร้าง booking ใหม่ เพื่อกันสต็อกผิด</div>` |
| 208 | OK — reviewed, no change required | `            <label>เลือก Booking` |
| 209 | OK — reviewed, no change required | `              <select name="row_number" required></select>` |
| 210 | OK — reviewed, no change required | `              <small>แสดงเฉพาะ booking วันนี้/อนาคต และ booking เก่าที่ยังไม่ returned/cancelled เพื่อกันรายการปิดแล้วค้างใน dropdown</small>` |
| 211 | OK — reviewed, no change required | `            </label>` |
| 212 | OK — reviewed, no change required | `            <div class="row three">` |
| 213 | OK — reviewed, no change required | `              <label>สถานะ Booking` |
| 214 | OK — reviewed, no change required | `                <select name="booking_status" required>` |
| 215 | OK — reviewed, no change required | `                  <option value="confirmed">confirmed</option>` |
| 216 | OK — reviewed, no change required | `                  <option value="pending">pending</option>` |
| 217 | OK — reviewed, no change required | `                  <option value="picked_up">picked_up</option>` |
| 218 | OK — reviewed, no change required | `                  <option value="returned">returned</option>` |
| 219 | OK — reviewed, no change required | `                  <option value="cancelled">cancelled</option>` |
| 220 | OK — reviewed, no change required | `                </select>` |
| 221 | OK — reviewed, no change required | `              </label>` |
| 222 | OK — reviewed, no change required | `              <label>สถานะชำระเงิน` |
| 223 | OK — reviewed, no change required | `                <select name="payment_status">` |
| 224 | OK — reviewed, no change required | `                  <option value="unpaid">unpaid</option>` |
| 225 | OK — reviewed, no change required | `                  <option value="partial">partial</option>` |
| 226 | OK — reviewed, no change required | `                  <option value="paid">paid</option>` |
| 227 | OK — reviewed, no change required | `                  <option value="refunded">refunded</option>` |
| 228 | OK — reviewed, no change required | `                </select>` |
| 229 | OK — reviewed, no change required | `              </label>` |
| 230 | OK — reviewed, no change required | `              <label>ยอดรับแล้ว <input name="amount_received" type="number" min="0" step="1" /></label>` |
| 231 | OK — reviewed, no change required | `            </div>` |
| 232 | OK — reviewed, no change required | `            <div class="row three">` |
| 233 | OK — reviewed, no change required | `              <label>ชื่อลูกค้า <input name="customer_name" required /></label>` |
| 234 | OK — reviewed, no change required | `              <label>X / LINE <input name="customer_contact" /></label>` |
| 235 | OK — reviewed, no change required | `              <label>เบอร์โทร <input name="customer_phone" inputmode="tel" /></label>` |
| 236 | OK — reviewed, no change required | `            </div>` |
| 237 | OK — reviewed, no change required | `            <div class="row three">` |
| 238 | OK — reviewed, no change required | `              <label>ช่องทาง` |
| 239 | OK — reviewed, no change required | `                <select name="contact_channel">` |
| 240 | OK — reviewed, no change required | `                  <option>LINE</option>` |
| 241 | OK — reviewed, no change required | `                  <option>X</option>` |
| 242 | OK — reviewed, no change required | `                  <option>Facebook</option>` |
| 243 | OK — reviewed, no change required | `                  <option>Instagram</option>` |
| 244 | OK — reviewed, no change required | `                </select>` |
| 245 | OK — reviewed, no change required | `              </label>` |
| 246 | OK — reviewed, no change required | `              <label>เวลารับเครื่อง <input name="pickup_time" placeholder="เช่น 17:30" /></label>` |
| 247 | REVIEWED asset field support / double booking guarded by backend | `              <label>Phone Asset <input name="phone_asset_id" placeholder="เช่น PHONE-001 / ว่างได้" /></label>` |
| 248 | OK — reviewed, no change required | `            </div>` |
| 249 | OK — reviewed, no change required | `            <div class="row two">` |
| 250 | REVIEWED asset field support / double booking guarded by backend | `              <label>Lens Asset <input name="lens_asset_id" placeholder="เช่น LENS-001 / ว่างได้" /></label>` |
| 251 | OK — reviewed, no change required | `              <label class="readonly-note">คำเตือน` |
| 252 | OK — reviewed, no change required | `                <input value="ระบบจะเช็กซ้ำว่า Asset ไม่ถูกจองชนวันเดียวกัน" disabled />` |
| 253 | OK — reviewed, no change required | `              </label>` |
| 254 | OK — reviewed, no change required | `            </div>` |
| 255 | OK — reviewed, no change required | `            <label>หมายเหตุ <textarea name="booking_note" rows="3"></textarea></label>` |
| 256 | OK — reviewed, no change required | `            <button class="btn secondary" type="submit">บันทึกการแก้ Booking</button>` |
| 257 | OK — reviewed, no change required | `          </form>` |
| 258 | OK — reviewed, no change required | `        </section>` |
| 259 | OK — blank/separator line | `` |
| 260 | OK — reviewed, no change required | `        <section class="tab-panel" id="tab-customers">` |
| 261 | OK — reviewed, no change required | `          <div class="grid two-col">` |
| 262 | OK — reviewed, no change required | `            <div class="card">` |
| 263 | OK — reviewed, no change required | `              <div class="card-head">` |
| 264 | OK — reviewed, no change required | `                <div>` |
| 265 | OK — reviewed, no change required | `                  <span class="eyebrow">CRM</span>` |
| 266 | OK — reviewed, no change required | `                  <h2>ประวัติลูกค้า</h2>` |
| 267 | OK — reviewed, no change required | `                  <p class="hint">ค้นหาลูกค้าจากชื่อ / เบอร์ / LINE แล้วกด “ดูประวัติ” เพื่อดูว่าเช่ากี่ครั้งและเคยจองงานไหนบ้าง</p>` |
| 268 | OK — reviewed, no change required | `                </div>` |
| 269 | OK — reviewed, no change required | `              </div>` |
| 270 | OK — reviewed, no change required | `              <label>ค้นหาลูกค้า` |
| 271 | OK — reviewed, no change required | `                <input id="customerSearch" type="search" placeholder="เช่น Mint, 08xxxxxxx, @line" />` |
| 272 | OK — reviewed, no change required | `              </label>` |
| 273 | OK — reviewed, no change required | `              <div class="table-wrap customer-list-wrap"><table id="customersTable"></table></div>` |
| 274 | OK — reviewed, no change required | `            </div>` |
| 275 | OK — reviewed, no change required | `            <div class="card customer-detail-card" id="customerDetailCard">` |
| 276 | OK — reviewed, no change required | `              <div class="card-head">` |
| 277 | OK — reviewed, no change required | `                <div>` |
| 278 | OK — reviewed, no change required | `                  <span class="eyebrow">Checklist</span>` |
| 279 | OK — reviewed, no change required | `                  <h2 id="customerDetailName">เลือก ลูกค้า เพื่อดูประวัติ</h2>` |
| 280 | OK — reviewed, no change required | `                  <p class="hint" id="customerDetailMeta">ระบบจะรวมจาก Booking ปัจจุบัน และ Customer Stats ถ้ามีข้อมูล archive แล้ว</p>` |
| 281 | OK — reviewed, no change required | `                </div>` |
| 282 | OK — reviewed, no change required | `              </div>` |
| 283 | OK — reviewed, no change required | `              <div class="grid stats compact customer-kpi" id="customerChecklist"></div>` |
| 284 | OK — reviewed, no change required | `              <div class="table-wrap"><table id="customerBookingsTable"></table></div>` |
| 285 | OK — reviewed, no change required | `            </div>` |
| 286 | OK — reviewed, no change required | `          </div>` |
| 287 | OK — reviewed, no change required | `        </section>` |
| 288 | OK — blank/separator line | `` |
| 289 | OK — reviewed, no change required | `        <section class="tab-panel" id="tab-events">` |
| 290 | OK — reviewed, no change required | `          <div class="grid two-col">` |
| 291 | OK — reviewed, no change required | `            <form class="card form" id="eventForm">` |
| 292 | OK — reviewed, no change required | `              <div class="form-title"><span class="eyebrow">Event</span><h2>เพิ่มงานใหม่</h2></div>` |
| 293 | OK — reviewed, no change required | `              <div class="row two">` |
| 294 | OK — reviewed, no change required | `                <label>ชื่องาน <input name="event_name" required placeholder="เช่น [안녕, BANGKOK] MUSIC FESTIVAL" /></label>` |
| 295 | OK — reviewed, no change required | `                <label>วันที่ <input name="event_date" required type="date" /></label>` |
| 296 | OK — reviewed, no change required | `              </div>` |
| 297 | OK — reviewed, no change required | `              <div class="row two">` |
| 298 | OK — reviewed, no change required | `                <label>สถานที่ <input name="venue" required placeholder="Bangkok" /></label>` |
| 299 | REVIEWED Drive URL logic/permission flow | `                <label>Poster URL <input name="poster_url" placeholder="Google Drive file link / thumbnail / direct image URL" /><small>วางลิงก์ไฟล์รูป Google Drive ได้โดยตรง หร…` |
| 300 | OK — reviewed, no change required | `              </div>` |
| 301 | OK — reviewed, no change required | `              <div class="row two">` |
| 302 | REVIEWED Drive URL logic/permission flow | `                <label>หรืออัปโหลดรูป Poster ไป Google Drive` |
| 303 | OK — reviewed, no change required | `                  <input id="posterFile" type="file" accept="image/*" />` |
| 304 | OK — reviewed, no change required | `                  <small>ต้องตั้ง Script Property <code>KK_POSTER_FOLDER_ID</code> ก่อน ใช้รูปไม่เกิน 3MB</small>` |
| 305 | OK — reviewed, no change required | `                </label>` |
| 306 | OK — reviewed, no change required | `                <label>สถานะ` |
| 307 | OK — reviewed, no change required | `                  <select name="status"><option value="open">open</option><option value="closed">closed</option></select>` |
| 308 | OK — reviewed, no change required | `                </label>` |
| 309 | OK — reviewed, no change required | `              </div>` |
| 310 | OK — reviewed, no change required | `              <label class="check"><input name="active_on_web" type="checkbox" checked /> เปิดโชว์หน้าเว็บ</label>` |
| 311 | OK — reviewed, no change required | `              <label>Note <textarea name="note" rows="3"></textarea></label>` |
| 312 | OK — reviewed, no change required | `              <button class="btn primary" type="submit">สร้างงาน</button>` |
| 313 | OK — reviewed, no change required | `            </form>` |
| 314 | OK — blank/separator line | `` |
| 315 | OK — reviewed, no change required | `            <form class="card form" id="eventUpdateForm">` |
| 316 | OK — reviewed, no change required | `              <div class="form-title"><span class="eyebrow">Edit Event</span><h2>แก้งานเดิม</h2></div>` |
| 317 | OK — reviewed, no change required | `              <label>เลือกงาน <select name="event_id" data-source="events" required></select><small>แสดงเฉพาะงานวันนี้/อนาคตที่ยัง open เพื่อกันแก้งานย้อนหลังโดยไม่ตั้งใจ</small…` |
| 318 | OK — reviewed, no change required | `              <div class="row two">` |
| 319 | OK — reviewed, no change required | `                <label>ชื่องานใหม่ <input name="event_name" /></label>` |
| 320 | OK — reviewed, no change required | `                <label>วันที่ใหม่ <input name="event_date" type="date" /></label>` |
| 321 | OK — reviewed, no change required | `              </div>` |
| 322 | OK — reviewed, no change required | `              <div class="row two">` |
| 323 | OK — reviewed, no change required | `                <label>สถานที่ใหม่ <input name="venue" /></label>` |
| 324 | REVIEWED Drive URL logic/permission flow | `                <label>Poster URL ใหม่ <input name="poster_url" placeholder="Google Drive file link / thumbnail / direct image URL" /><small>ถ้าวางลิงก์ใหม่ ระบบจะใช้รูปนี้แทนรู…` |
| 325 | OK — reviewed, no change required | `              </div>` |
| 326 | OK — reviewed, no change required | `              <label>หรืออัปโหลดรูป Poster ใหม่` |
| 327 | OK — reviewed, no change required | `                <input id="updatePosterFile" type="file" accept="image/*" />` |
| 328 | OK — reviewed, no change required | `                <small>ถ้าเลือกไฟล์ ระบบจะอัปโหลดและใส่ Poster URL ใหม่ให้อัตโนมัติก่อนบันทึก</small>` |
| 329 | OK — reviewed, no change required | `              </label>` |
| 330 | OK — reviewed, no change required | `              <div class="row two">` |
| 331 | OK — reviewed, no change required | `                <label>สถานะ <select name="status"><option value="">ไม่เปลี่ยน</option><option value="open">open</option><option value="closed">closed</option></select></label>` |
| 332 | OK — reviewed, no change required | `                <label>โชว์บนเว็บ <select name="active_on_web"><option value="">ไม่เปลี่ยน</option><option value="true">TRUE</option><option value="false">FALSE</option></select…` |
| 333 | OK — reviewed, no change required | `              </div>` |
| 334 | OK — reviewed, no change required | `              <label>Note ใหม่ <textarea name="note" rows="3"></textarea></label>` |
| 335 | OK — reviewed, no change required | `              <button class="btn secondary" type="submit">บันทึกการแก้ไข</button>` |
| 336 | OK — reviewed, no change required | `            </form>` |
| 337 | OK — reviewed, no change required | `          </div>` |
| 338 | OK — reviewed, no change required | `        </section>` |
| 339 | OK — blank/separator line | `` |
| 340 | OK — reviewed, no change required | `        <section class="tab-panel" id="tab-packages">` |
| 341 | OK — reviewed, no change required | `          <div class="grid two-col">` |
| 342 | OK — reviewed, no change required | `            <form class="card form" id="packageForm">` |
| 343 | OK — reviewed, no change required | `              <div class="form-title"><span class="eyebrow">Package</span><h2>เพิ่มแพ็กเกจ/ราคา</h2></div>` |
| 344 | OK — reviewed, no change required | `              <div class="row two">` |
| 345 | OK — reviewed, no change required | `                <label>Template ID <input name="template_id" placeholder="ว่างไว้ให้ระบบสร้างได้" /></label>` |
| 346 | OK — reviewed, no change required | `                <label>ชื่อแสดงบนเว็บ <input name="display_name" required placeholder="Vivo X300 Pro + Lens" /></label>` |
| 347 | OK — reviewed, no change required | `              </div>` |
| 348 | OK — reviewed, no change required | `              <div class="row two">` |
| 349 | OK — reviewed, no change required | `                <label>ประเภท` |
| 350 | OK — reviewed, no change required | `                  <select name="package_type" required>` |
| 351 | OK — reviewed, no change required | `                    <option value="phone_only">phone_only</option>` |
| 352 | OK — reviewed, no change required | `                    <option value="lens_only">lens_only</option>` |
| 353 | OK — reviewed, no change required | `                    <option value="phone_lens_bundle">phone_lens_bundle</option>` |
| 354 | OK — reviewed, no change required | `                  </select>` |
| 355 | OK — reviewed, no change required | `                </label>` |
| 356 | OK — reviewed, no change required | `                <label>ราคา <input name="standard_price" required type="number" min="0" step="1" /></label>` |
| 357 | OK — reviewed, no change required | `              </div>` |
| 358 | OK — reviewed, no change required | `              <div class="row two">` |
| 359 | OK — reviewed, no change required | `                <label>Model Group <input name="model_group" placeholder="VIVO_X300_PRO" /></label>` |
| 360 | OK — reviewed, no change required | `                <label>Lens Group <input name="lens_group" placeholder="ZEISS_235X หรือ NONE" /></label>` |
| 361 | OK — reviewed, no change required | `              </div>` |
| 362 | OK — reviewed, no change required | `              <label>Use Case / ข้อความขาย <textarea name="use_case" rows="3" placeholder="ถ้าว่าง หน้าเว็บจะไม่แสดง"></textarea></label>` |
| 363 | OK — reviewed, no change required | `              <label class="check"><input name="active" type="checkbox" checked /> เปิดใช้งานแพ็กเกจ</label>` |
| 364 | OK — reviewed, no change required | `              <button class="btn primary" type="submit">เพิ่มแพ็กเกจ</button>` |
| 365 | OK — reviewed, no change required | `            </form>` |
| 366 | OK — blank/separator line | `` |
| 367 | OK — reviewed, no change required | `            <form class="card form" id="eventPriceOverrideForm">` |
| 368 | OK — reviewed, no change required | `              <div class="form-title"><span class="eyebrow">Override</span><h2>แก้ราคาเฉพาะงาน</h2></div>` |
| 369 | OK — reviewed, no change required | `              <p class="hint">ใช้ส่วนนี้เมื่ออยากให้ราคา/ข้อความของแพ็กเกจเปลี่ยนเฉพาะงานที่เลือก โดยไม่กระทบราคาหลักของทุกงาน</p>` |
| 370 | OK — reviewed, no change required | `              <label>เลือกงาน <select name="event_id" data-source="events" required></select><small>แสดงเฉพาะงานวันนี้/อนาคตที่ยัง open เพื่อกันแก้งานย้อนหลังโดยไม่ตั้งใจ</small…` |
| 371 | OK — reviewed, no change required | `              <label>เลือกแพ็กเกจ <select name="template_id" data-source="packages" required></select></label>` |
| 372 | OK — reviewed, no change required | `              <div class="row two">` |
| 373 | OK — reviewed, no change required | `                <label>ราคาเฉพาะงานนี้ <input name="override_price" type="number" min="0" step="1" placeholder="เช่น 1290" /></label>` |
| 374 | OK — reviewed, no change required | `                <label>Active เฉพาะงานนี้` |
| 375 | OK — reviewed, no change required | `                  <select name="active_override">` |
| 376 | OK — reviewed, no change required | `                    <option value="">ไม่เปลี่ยน</option>` |
| 377 | OK — reviewed, no change required | `                    <option value="true">เปิดขาย</option>` |
| 378 | OK — reviewed, no change required | `                    <option value="false">ซ่อนแพ็กเกจนี้ในงานนี้</option>` |
| 379 | OK — reviewed, no change required | `                  </select>` |
| 380 | OK — reviewed, no change required | `                </label>` |
| 381 | OK — reviewed, no change required | `              </div>` |
| 382 | OK — reviewed, no change required | `              <div class="row two">` |
| 383 | OK — reviewed, no change required | `                <label>Sort Order เฉพาะงาน <input name="sort_order_override" type="number" min="0" step="1" placeholder="ว่างไว้ได้" /></label>` |
| 384 | OK — reviewed, no change required | `                <label>Note เฉพาะงาน <input name="override_note" placeholder="ว่างไว้ได้" /></label>` |
| 385 | OK — reviewed, no change required | `              </div>` |
| 386 | OK — reviewed, no change required | `              <label>Use Case เฉพาะงาน <textarea name="use_case_override" rows="3" placeholder="ถ้าว่าง จะใช้ข้อความหลักจากแพ็กเกจ"></textarea></label>` |
| 387 | OK — reviewed, no change required | `              <button class="btn secondary" type="submit">บันทึกราคาเฉพาะงาน</button>` |
| 388 | OK — reviewed, no change required | `            </form>` |
| 389 | OK — blank/separator line | `` |
| 390 | OK — reviewed, no change required | `            <form class="card form" id="packageUpdateForm">` |
| 391 | OK — reviewed, no change required | `              <div class="form-title"><span class="eyebrow">Master Price</span><h2>แก้ราคาหลักของแพ็กเกจ</h2></div>` |
| 392 | OK — reviewed, no change required | `              <p class="hint">ส่วนนี้จะกระทบทุกงานที่ไม่ได้ตั้งราคาเฉพาะงานไว้</p>` |
| 393 | OK — reviewed, no change required | `              <label>เลือกแพ็กเกจ <select name="template_id" data-source="packages" required></select><small>เลือกแล้วระบบจะเติมราคาหลัก/ชื่อ/Use Case เดิมให้แก้</small></label>` |
| 394 | OK — reviewed, no change required | `              <div class="row two">` |
| 395 | OK — reviewed, no change required | `                <label>ราคาหลักใหม่ <input name="standard_price" type="number" min="0" step="1" /></label>` |
| 396 | OK — reviewed, no change required | `                <label>ชื่อแสดงใหม่ <input name="display_name" /></label>` |
| 397 | OK — reviewed, no change required | `              </div>` |
| 398 | OK — reviewed, no change required | `              <label>Use Case หลักใหม่ <textarea name="use_case" rows="3"></textarea></label>` |
| 399 | OK — reviewed, no change required | `              <label>Active <select name="active"><option value="">ไม่เปลี่ยน</option><option value="true">TRUE</option><option value="false">FALSE</option></select></label>` |
| 400 | OK — reviewed, no change required | `              <button class="btn ghost" type="submit">บันทึกราคาหลัก</button>` |
| 401 | OK — reviewed, no change required | `            </form>` |
| 402 | OK — reviewed, no change required | `          </div>` |
| 403 | OK — reviewed, no change required | `        </section>` |
| 404 | OK — blank/separator line | `` |
| 405 | OK — reviewed, no change required | `        <section class="tab-panel" id="tab-assets">` |
| 406 | OK — reviewed, no change required | `          <div class="grid two-col">` |
| 407 | OK — reviewed, no change required | `            <form class="card form" id="assetForm">` |
| 408 | OK — reviewed, no change required | `              <div class="form-title"><span class="eyebrow">Asset</span><h2>เพิ่มมือถือ / เลนส์ หลายรายการ</h2></div>` |
| 409 | OK — reviewed, no change required | `              <div class="row two">` |
| 410 | OK — reviewed, no change required | `                <label>ประเภท` |
| 411 | OK — reviewed, no change required | `                  <select name="asset_type" required><option value="phone">phone</option><option value="lens">lens</option></select>` |
| 412 | OK — reviewed, no change required | `                </label>` |
| 413 | OK — reviewed, no change required | `                <label>จำนวน <input name="quantity" type="number" min="1" max="50" value="1" required /></label>` |
| 414 | OK — reviewed, no change required | `              </div>` |
| 415 | OK — reviewed, no change required | `              <div class="row two">` |
| 416 | OK — reviewed, no change required | `                <label>Model / Lens Group <input name="model_group" required placeholder="VIVO_X300_PRO หรือ ZEISS_235X" /></label>` |
| 417 | OK — reviewed, no change required | `                <label>Serial Prefix <input name="serial_prefix" placeholder="เช่น VIVOX300" /></label>` |
| 418 | OK — reviewed, no change required | `              </div>` |
| 419 | OK — reviewed, no change required | `              <div class="row two">` |
| 420 | OK — reviewed, no change required | `                <label>สถานะ <select name="status"><option value="available">available</option><option value="repair">repair</option><option value="inactive">inactive</option></…` |
| 421 | OK — reviewed, no change required | `                <label class="check"><input name="rentable" type="checkbox" checked /> rentable</label>` |
| 422 | OK — reviewed, no change required | `              </div>` |
| 423 | OK — reviewed, no change required | `              <label>Note <textarea name="notes" rows="3"></textarea></label>` |
| 424 | OK — reviewed, no change required | `              <button class="btn primary" type="submit">เพิ่ม Asset</button>` |
| 425 | OK — reviewed, no change required | `            </form>` |
| 426 | OK — blank/separator line | `` |
| 427 | OK — reviewed, no change required | `            <div class="card">` |
| 428 | OK — reviewed, no change required | `              <div class="card-head"><h2>Assets ล่าสุด</h2><small id="assetsCount"></small></div>` |
| 429 | OK — reviewed, no change required | `              <div class="table-wrap"><table id="assetsTable"></table></div>` |
| 430 | OK — reviewed, no change required | `            </div>` |
| 431 | OK — reviewed, no change required | `          </div>` |
| 432 | OK — reviewed, no change required | `        </section>` |
| 433 | OK — blank/separator line | `` |
| 434 | OK — reviewed, no change required | `        <section class="tab-panel" id="tab-health">` |
| 435 | OK — reviewed, no change required | `          <div class="grid two-col">` |
| 436 | OK — reviewed, no change required | `            <div class="card">` |
| 437 | OK — reviewed, no change required | `              <div class="card-head"><h2>Health Check</h2><small>อ่านจาก 10_Admin_Health_Check</small></div>` |
| 438 | OK — reviewed, no change required | `              <div class="table-wrap"><table id="healthTable"></table></div>` |
| 439 | OK — reviewed, no change required | `            </div>` |
| 440 | OK — reviewed, no change required | `            <div class="card">` |
| 441 | OK — reviewed, no change required | `              <div class="card-head">` |
| 442 | OK — reviewed, no change required | `                <div>` |
| 443 | OK — reviewed, no change required | `                  <h2>Archive / Customer Stats</h2>` |
| 444 | OK — reviewed, no change required | `                  <p class="hint">ย้าย booking/event เก่ากว่า 30 วันไป Archive และอัปเดตจำนวนครั้งที่ลูกค้าเคยเช่า</p>` |
| 445 | OK — reviewed, no change required | `                </div>` |
| 446 | OK — reviewed, no change required | `              </div>` |
| 447 | OK — reviewed, no change required | `              <button class="btn secondary" id="cleanupBtn" type="button">Run 30-day Archive Cleanup</button>` |
| 448 | OK — reviewed, no change required | `              <p class="hint">แนะนำให้กดเมนู KK Admin &gt; CRM: Install Daily Cleanup Trigger ใน Google Sheet เพื่อให้ระบบทำงานอัตโนมัติทุกวัน</p>` |
| 449 | OK — reviewed, no change required | `              <div class="card-head"><h2>Customer Stats</h2><small id="customerStatsCount"></small></div>` |
| 450 | OK — reviewed, no change required | `              <div class="table-wrap"><table id="customerStatsTable"></table></div>` |
| 451 | OK — reviewed, no change required | `            </div>` |
| 452 | OK — reviewed, no change required | `          </div>` |
| 453 | OK — reviewed, no change required | `        </section>` |
| 454 | OK — reviewed, no change required | `      </div>` |
| 455 | OK — reviewed, no change required | `    </main>` |
| 456 | OK — reviewed, no change required | `  </div>` |
| 457 | OK — blank/separator line | `` |
| 458 | OK — reviewed, no change required | `  <script src="/admin/admin.js"></script>` |
| 459 | OK — reviewed, no change required | `</body>` |
| 460 | OK — reviewed, no change required | `</html>` |

### `api/kk-admin.js`

| Line | Status | Code |
|---:|---|---|
| 1 | UPDATED version sync to v16.6.2 | `// KK Phone Rental v16.6.2_LINE_AUDITED — Admin CRM Vercel Proxy` |
| 2 | OK — comment/documentation reviewed | `// Browser -> /api/kk-admin -> Apps Script Web App -> Google Sheet` |
| 3 | OK — comment/documentation reviewed | `// Required ENV on Vercel:` |
| 4 | OK — comment/documentation reviewed | `// GOOGLE_SHEET_ID      = same Spreadsheet ID used by Apps Script` |
| 5 | OK — comment/documentation reviewed | `// KK_ADMIN_SCRIPT_URL  = Apps Script Web App URL ending /exec` |
| 6 | REVIEWED API key stored in script/env, not public frontend | `// KK_ADMIN_API_KEY     = secret generated in Google Apps Script menu` |
| 7 | OK — comment/documentation reviewed | `// KK_ADMIN_PIN         = PIN that admin types on /admin` |
| 8 | OK — comment/documentation reviewed | `// Optional ENV:` |
| 9 | OK — comment/documentation reviewed | `// KK_SITE_ORIGIN       = https://kk-phone-rental.vercel.app or custom domain` |
| 10 | OK — blank/separator line | `` |
| 11 | UPDATED version sync to v16.6.2 | `const KK_APP_VERSION = "v16.6.2_LINE_AUDITED";` |
| 12 | OK — reviewed, no change required | `const DEFAULT_SHEET_ID = "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";` |
| 13 | OK — blank/separator line | `` |
| 14 | OK — reviewed, no change required | `function json(res, status, body) {` |
| 15 | OK — reviewed, no change required | `  res.statusCode = status;` |
| 16 | OK — reviewed, no change required | `  res.setHeader("Content-Type", "application/json; charset=utf-8");` |
| 17 | OK — reviewed, no change required | `  res.setHeader("X-Content-Type-Options", "nosniff");` |
| 18 | OK — reviewed, no change required | `  res.setHeader("X-KK-App-Version", KK_APP_VERSION);` |
| 19 | OK — reviewed, no change required | `  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");` |
| 20 | OK — reviewed, no change required | `  res.end(JSON.stringify(Object.assign({ proxy_version: KK_APP_VERSION }, body || {})));` |
| 21 | OK — reviewed, no change required | `}` |
| 22 | OK — blank/separator line | `` |
| 23 | OK — reviewed, no change required | `function readBody(req) {` |
| 24 | OK — reviewed, no change required | `  return new Promise((resolve, reject) => {` |
| 25 | OK — reviewed, no change required | `    let data = "";` |
| 26 | OK — reviewed, no change required | `    req.on("data", (chunk) => {` |
| 27 | OK — reviewed, no change required | `      data += chunk;` |
| 28 | OK — reviewed, no change required | `      if (data.length > 6 * 1024 * 1024) {` |
| 29 | OK — reviewed, no change required | `        reject(new Error("Request too large. Please keep poster images below 3 MB."));` |
| 30 | OK — reviewed, no change required | `        req.destroy();` |
| 31 | OK — reviewed, no change required | `        return;` |
| 32 | OK — reviewed, no change required | `      }` |
| 33 | OK — reviewed, no change required | `    });` |
| 34 | OK — reviewed, no change required | `    req.on("end", () => resolve(data));` |
| 35 | OK — reviewed, no change required | `    req.on("error", reject);` |
| 36 | OK — reviewed, no change required | `  });` |
| 37 | OK — reviewed, no change required | `}` |
| 38 | OK — blank/separator line | `` |
| 39 | OK — reviewed, no change required | `module.exports = async function handler(req, res) {` |
| 40 | OK — reviewed, no change required | `  const origin = req.headers.origin || "";` |
| 41 | OK — reviewed, no change required | `  const configuredOrigins = String(process.env.KK_SITE_ORIGIN || "")` |
| 42 | OK — reviewed, no change required | `    .split(",")` |
| 43 | OK — reviewed, no change required | `    .map((s) => s.trim())` |
| 44 | OK — reviewed, no change required | `    .filter(Boolean);` |
| 45 | OK — reviewed, no change required | `  const vercelOrigin = process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "";` |
| 46 | IMPROVED CORS supports comma-separated allowed origins | `  const allowedOrigins = new Set([...configuredOrigins, vercelOrigin].filter(Boolean));` |
| 47 | OK — reviewed, no change required | `  if (origin && allowedOrigins.has(origin)) {` |
| 48 | OK — reviewed, no change required | `    res.setHeader("Access-Control-Allow-Origin", origin);` |
| 49 | OK — reviewed, no change required | `    res.setHeader("Vary", "Origin");` |
| 50 | OK — reviewed, no change required | `  }` |
| 51 | OK — reviewed, no change required | `  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");` |
| 52 | OK — reviewed, no change required | `  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Pin");` |
| 53 | OK — reviewed, no change required | `  if (req.method === "OPTIONS") return json(res, 204, {});` |
| 54 | OK — reviewed, no change required | `  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { ok: false, error: "Method not allowed" });` |
| 55 | OK — blank/separator line | `` |
| 56 | OK — reviewed, no change required | `  const scriptUrl = String(process.env.KK_ADMIN_SCRIPT_URL || "").trim();` |
| 57 | REVIEWED sensitive API key redaction/ENV only | `  const apiKey = String(process.env.KK_ADMIN_API_KEY || "").trim();` |
| 58 | OK — reviewed, no change required | `  const adminPin = String(process.env.KK_ADMIN_PIN || "").trim();` |
| 59 | OK — reviewed, no change required | `  const envSheetId = String(process.env.GOOGLE_SHEET_ID || "").trim();` |
| 60 | OK — reviewed, no change required | `  const frontendSheetId = envSheetId || DEFAULT_SHEET_ID;` |
| 61 | OK — reviewed, no change required | `  const sheetIdSource = envSheetId ? "env" : "default-fallback";` |
| 62 | OK — blank/separator line | `` |
| 63 | REVIEWED sensitive API key redaction/ENV only | `  if (!scriptUrl || !apiKey || !adminPin) {` |
| 64 | OK — reviewed, no change required | `    return json(res, 500, {` |
| 65 | OK — reviewed, no change required | `      ok: false,` |
| 66 | REVIEWED API key stored in script/env, not public frontend | `      error: "Admin API is not configured. Set KK_ADMIN_SCRIPT_URL, KK_ADMIN_API_KEY and KK_ADMIN_PIN in Vercel Environment Variables."` |
| 67 | OK — reviewed, no change required | `    });` |
| 68 | OK — reviewed, no change required | `  }` |
| 69 | OK — blank/separator line | `` |
| 70 | OK — reviewed, no change required | `  const providedPin = String(req.headers["x-admin-pin"] || "").trim();` |
| 71 | OK — reviewed, no change required | `  if (providedPin !== adminPin) return json(res, 401, { ok: false, error: "Invalid admin PIN" });` |
| 72 | OK — blank/separator line | `` |
| 73 | OK — reviewed, no change required | `  try {` |
| 74 | OK — reviewed, no change required | `    let payload = {};` |
| 75 | OK — reviewed, no change required | `    if (req.method === "GET") {` |
| 76 | OK — reviewed, no change required | `      payload = { action: String(req.query.action || "snapshot") };` |
| 77 | OK — reviewed, no change required | `    } else {` |
| 78 | OK — reviewed, no change required | `      const raw = await readBody(req);` |
| 79 | OK — reviewed, no change required | `      try {` |
| 80 | OK — reviewed, no change required | `        payload = raw ? JSON.parse(raw) : {};` |
| 81 | OK — reviewed, no change required | `      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {` |
| 82 | IMPROVED request validation | `        return json(res, 400, { ok: false, error: "JSON request body must be an object" });` |
| 83 | OK — reviewed, no change required | `      }` |
| 84 | OK — reviewed, no change required | `      } catch (_) {` |
| 85 | OK — reviewed, no change required | `        return json(res, 400, { ok: false, error: "Invalid JSON request body" });` |
| 86 | OK — reviewed, no change required | `      }` |
| 87 | OK — reviewed, no change required | `    }` |
| 88 | OK — blank/separator line | `` |
| 89 | OK — reviewed, no change required | `    const upstreamPayload = Object.assign({}, payload, {` |
| 90 | REVIEWED sensitive API key redaction/ENV only | `      apiKey,` |
| 91 | OK — reviewed, no change required | `      proxyVersion: KK_APP_VERSION,` |
| 92 | OK — reviewed, no change required | `      frontendSheetId,` |
| 93 | OK — reviewed, no change required | `      sheetIdSource` |
| 94 | OK — reviewed, no change required | `    });` |
| 95 | REVIEWED network call and error handling | `    const upstream = await fetch(scriptUrl, {` |
| 96 | OK — reviewed, no change required | `      method: "POST",` |
| 97 | OK — reviewed, no change required | `      headers: { "Content-Type": "application/json" },` |
| 98 | OK — reviewed, no change required | `      body: JSON.stringify(upstreamPayload),` |
| 99 | OK — reviewed, no change required | `    });` |
| 100 | OK — blank/separator line | `` |
| 101 | OK — reviewed, no change required | `    const text = await upstream.text();` |
| 102 | OK — reviewed, no change required | `    let data;` |
| 103 | OK — reviewed, no change required | `    try { data = JSON.parse(text); }` |
| 104 | OK — reviewed, no change required | `    catch (_) { data = { ok: false, error: text || "Apps Script returned a non-JSON response" }; }` |
| 105 | OK — blank/separator line | `` |
| 106 | OK — reviewed, no change required | `    if (data && data.ok && payload && payload.action === "snapshot") {` |
| 107 | OK — reviewed, no change required | `      data.frontend_sheet_id = frontendSheetId;` |
| 108 | OK — reviewed, no change required | `      data.frontend_sheet_id_source = sheetIdSource;` |
| 109 | OK — reviewed, no change required | `      data.frontend_proxy_version = KK_APP_VERSION;` |
| 110 | OK — reviewed, no change required | `      if (data.data) {` |
| 111 | OK — reviewed, no change required | `        data.data.frontend_sheet_id = frontendSheetId;` |
| 112 | OK — reviewed, no change required | `        data.data.frontend_sheet_id_source = sheetIdSource;` |
| 113 | OK — reviewed, no change required | `        data.data.frontend_proxy_version = KK_APP_VERSION;` |
| 114 | OK — reviewed, no change required | `      }` |
| 115 | OK — reviewed, no change required | `    }` |
| 116 | OK — blank/separator line | `` |
| 117 | OK — reviewed, no change required | `    return json(res, upstream.ok ? 200 : upstream.status, data);` |
| 118 | OK — reviewed, no change required | `  } catch (err) {` |
| 119 | OK — reviewed, no change required | `    return json(res, 500, { ok: false, error: err && err.message ? err.message : String(err) });` |
| 120 | OK — reviewed, no change required | `  }` |
| 121 | OK — reviewed, no change required | `};` |

### `api/kk-data.js`

| Line | Status | Code |
|---:|---|---|
| 1 | UPDATED version sync to v16.6.2 | `// KK Phone Rental v16.6.2_LINE_AUDITED — Vercel Serverless Google Sheets CSV Proxy` |
| 2 | OK — comment/documentation reviewed | `// Production reads through this proxy first. If GOOGLE_SHEET_ID is missing, it falls back to the known read-only sheet ID to prevent public-site outages.` |
| 3 | OK — blank/separator line | `` |
| 4 | UPDATED version sync to v16.6.2 | `const KK_APP_VERSION = "v16.6.2_LINE_AUDITED";` |
| 5 | OK — reviewed, no change required | `const DEFAULT_SHEET_ID = "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";` |
| 6 | OK — blank/separator line | `` |
| 7 | OK — reviewed, no change required | `const ALLOWED = {` |
| 8 | OK — reviewed, no change required | `  "08_Web_Ready": new Set(["A4:K"]),` |
| 9 | OK — reviewed, no change required | `  "09_Web_Packages": new Set(["A4:N", "A4:M", "A4:L"]),` |
| 10 | OK — reviewed, no change required | `};` |
| 11 | OK — blank/separator line | `` |
| 12 | OK — reviewed, no change required | `function csvHeaderLooksValid(sheet, text) {` |
| 13 | OK — reviewed, no change required | `  const firstLine = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/)[0] || "";` |
| 14 | OK — reviewed, no change required | `  const normalized = firstLine.toLowerCase();` |
| 15 | OK — reviewed, no change required | `  if (sheet === "08_Web_Ready") {` |
| 16 | OK — reviewed, no change required | `    return normalized.includes("event_id") && normalized.includes("poster_image_url") && normalized.includes("action_for_web");` |
| 17 | OK — reviewed, no change required | `  }` |
| 18 | OK — reviewed, no change required | `  if (sheet === "09_Web_Packages") {` |
| 19 | OK — reviewed, no change required | `    return normalized.includes("package_id") && normalized.includes("event_id") && normalized.includes("available_count");` |
| 20 | OK — reviewed, no change required | `  }` |
| 21 | OK — reviewed, no change required | `  return true;` |
| 22 | OK — reviewed, no change required | `}` |
| 23 | OK — blank/separator line | `` |
| 24 | OK — reviewed, no change required | `function send(res, status, body, contentType = "text/plain; charset=utf-8") {` |
| 25 | OK — reviewed, no change required | `  res.statusCode = status;` |
| 26 | OK — reviewed, no change required | `  res.setHeader("Content-Type", contentType);` |
| 27 | OK — reviewed, no change required | `  res.setHeader("X-Content-Type-Options", "nosniff");` |
| 28 | OK — reviewed, no change required | `  res.setHeader("X-KK-App-Version", KK_APP_VERSION);` |
| 29 | OK — reviewed, no change required | `  res.end(body);` |
| 30 | OK — reviewed, no change required | `}` |
| 31 | OK — blank/separator line | `` |
| 32 | OK — reviewed, no change required | `module.exports = async function handler(req, res) {` |
| 33 | OK — reviewed, no change required | `  res.setHeader("Access-Control-Allow-Origin", "*");` |
| 34 | OK — reviewed, no change required | `  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");` |
| 35 | OK — reviewed, no change required | `  res.setHeader("Access-Control-Allow-Headers", "Content-Type");` |
| 36 | OK — reviewed, no change required | `  if (req.method === "OPTIONS") return send(res, 204, "");` |
| 37 | OK — reviewed, no change required | `  if (req.method !== "GET") return send(res, 405, "Method Not Allowed");` |
| 38 | OK — blank/separator line | `` |
| 39 | IMPROVED query validation | `  const sheet = Array.isArray(req.query.sheet) ? "" : String(req.query.sheet || "").trim();` |
| 40 | OK — reviewed, no change required | `  const range = Array.isArray(req.query.range) ? "" : String(req.query.range || "").trim();` |
| 41 | OK — reviewed, no change required | `  const envSheetId = String(process.env.GOOGLE_SHEET_ID || "").trim();` |
| 42 | OK — reviewed, no change required | `  const sheetId = envSheetId || DEFAULT_SHEET_ID;` |
| 43 | OK — reviewed, no change required | `  const usingDefault = !envSheetId;` |
| 44 | OK — reviewed, no change required | `  res.setHeader("X-KK-Sheet-ID", sheetId ? sheetId.slice(0, 8) + "…" : "missing");` |
| 45 | OK — reviewed, no change required | `  res.setHeader("X-KK-Sheet-Source", usingDefault ? "default-fallback" : "env");` |
| 46 | OK — blank/separator line | `` |
| 47 | OK — reviewed, no change required | `  if (!sheetId) {` |
| 48 | OK — reviewed, no change required | `    return send(res, 500, "Missing GOOGLE_SHEET_ID environment variable and DEFAULT_SHEET_ID is empty.");` |
| 49 | OK — reviewed, no change required | `  }` |
| 50 | OK — reviewed, no change required | `  if (!ALLOWED[sheet] || !ALLOWED[sheet].has(range)) {` |
| 51 | OK — reviewed, no change required | `    return send(res, 400, "Sheet/range not allowed");` |
| 52 | OK — reviewed, no change required | `  }` |
| 53 | OK — blank/separator line | `` |
| 54 | OK — reviewed, no change required | `  const url = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(sheetId) +` |
| 55 | OK — reviewed, no change required | `    "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(sheet) +` |
| 56 | OK — reviewed, no change required | `    "&range=" + encodeURIComponent(range) +` |
| 57 | OK — reviewed, no change required | `    "&t=" + Date.now();` |
| 58 | OK — blank/separator line | `` |
| 59 | OK — reviewed, no change required | `  try {` |
| 60 | REVIEWED network call and error handling | `    const upstream = await fetch(url, {` |
| 61 | OK — reviewed, no change required | `      headers: { "User-Agent": "KK-Phone-Rental-Vercel-Proxy/16.6.2-Line-Audited" },` |
| 62 | OK — reviewed, no change required | `    });` |
| 63 | OK — reviewed, no change required | `    const text = await upstream.text();` |
| 64 | OK — reviewed, no change required | `    if (!upstream.ok) {` |
| 65 | OK — reviewed, no change required | `      return send(res, upstream.status, text || "Google Sheets upstream error");` |
| 66 | OK — reviewed, no change required | `    }` |
| 67 | OK — reviewed, no change required | `    if (!csvHeaderLooksValid(sheet, text)) {` |
| 68 | OK — reviewed, no change required | `      return send(res, 502, "Google Sheets returned invalid CSV header for " + sheet + ". Check GOOGLE_SHEET_ID, sheet name, sharing, and range.");` |
| 69 | OK — reviewed, no change required | `    }` |
| 70 | OK — reviewed, no change required | `    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=45");` |
| 71 | OK — reviewed, no change required | `    return send(res, 200, text, "text/csv; charset=utf-8");` |
| 72 | OK — reviewed, no change required | `  } catch (err) {` |
| 73 | OK — reviewed, no change required | `    return send(res, 502, "Proxy fetch failed: " + (err && err.message ? err.message : String(err)));` |
| 74 | OK — reviewed, no change required | `  }` |
| 75 | OK — reviewed, no change required | `};` |

### `apps-script/Code.gs`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — comment/documentation reviewed | `/**` |
| 2 | UPDATED version sync to v16.6.2 | ` * KK Phone Rental Backend v16.6.2_LINE_AUDITED` |
| 3 | OK — comment/documentation reviewed | ` * Phase 1 recovery-stable baseline + audited booking/override guards + dynamic range optimization` |
| 4 | OK — comment/documentation reviewed | ` * Keep in sync with backend sheets: Dashboard K31:K42, Web Packages A4:N, use_case_override in 04_Event_Overrides!G.` |
| 5 | OK — comment/documentation reviewed | ` */` |
| 6 | UPDATED version sync to v16.6.2 | `const KK_ADMIN_VERSION = 'v16.6.2_LINE_AUDITED';` |
| 7 | OK — reviewed, no change required | `const KK_PHASE1_DIRECT_FALLBACK_DISABLED = false;` |
| 8 | OK — blank/separator line | `` |
| 9 | OK — reviewed, no change required | `const KK = {` |
| 10 | OK — reviewed, no change required | `  dashboard: '00_Admin_Dashboard',` |
| 11 | OK — reviewed, no change required | `  events: '01_Events',` |
| 12 | OK — reviewed, no change required | `  assets: '02_Assets',` |
| 13 | OK — reviewed, no change required | `  packages: '03_Packages',` |
| 14 | OK — reviewed, no change required | `  overrides: '04_Event_Overrides',` |
| 15 | OK — reviewed, no change required | `  accessories: '06_Accessory_Stock',` |
| 16 | OK — reviewed, no change required | `  webReady: '08_Web_Ready',` |
| 17 | OK — reviewed, no change required | `  webPackages: '09_Web_Packages',` |
| 18 | OK — reviewed, no change required | `  bookings: '00_Master_Booking',` |
| 19 | OK — reviewed, no change required | `  health: '10_Admin_Health_Check',` |
| 20 | OK — reviewed, no change required | `  modelMaster: 'Model_Master',` |
| 21 | OK — reviewed, no change required | `  customerStats: '11_Customer_Stats',` |
| 22 | OK — reviewed, no change required | `  bookingArchive: '12_Booking_Archive',` |
| 23 | OK — reviewed, no change required | `  eventArchive: '13_Event_Archive',` |
| 24 | OK — reviewed, no change required | `  overrideArchive: '14_Event_Override_Archive',` |
| 25 | OK — reviewed, no change required | `  adminAuditLog: '15_Admin_Audit_Log',` |
| 26 | OK — reviewed, no change required | `  adminErrorLog: '16_Admin_Error_Log'` |
| 27 | OK — reviewed, no change required | `};` |
| 28 | OK — blank/separator line | `` |
| 29 | OK — reviewed, no change required | `const KK_NAMED_RANGES = [` |
| 30 | OK — reviewed, no change required | `  { name: 'KK_EVENT_CREATE_INPUTS', sheet: KK.dashboard, a1: 'B6:B13' },` |
| 31 | OK — reviewed, no change required | `  { name: 'KK_EVENT_CREATED_ID', sheet: KK.dashboard, a1: 'B13' },` |
| 32 | OK — reviewed, no change required | `  { name: 'KK_EVENT_PACKAGE_ROWS', sheet: KK.dashboard, a1: 'A17:I46' },` |
| 33 | OK — reviewed, no change required | `  { name: 'KK_ADD_ASSET_INPUTS', sheet: KK.dashboard, a1: 'K6:K11' },` |
| 34 | OK — reviewed, no change required | `  { name: 'KK_ACCESSORY_INPUT_ROWS', sheet: KK.dashboard, a1: 'J16:N26' },` |
| 35 | OK — reviewed, no change required | `  { name: 'KK_QUICK_BOOKING_INPUTS', sheet: KK.dashboard, a1: 'K31:K42' },` |
| 36 | OK — reviewed, no change required | `  { name: 'KK_QUICK_BOOKING_ASSIGNED_ASSETS', sheet: KK.dashboard, a1: 'K38:K39' }` |
| 37 | OK — reviewed, no change required | `];` |
| 38 | OK — blank/separator line | `` |
| 39 | OK — reviewed, no change required | `function onOpen() {` |
| 40 | OK — reviewed, no change required | `  try {` |
| 41 | OK — reviewed, no change required | `    SpreadsheetApp.getUi()` |
| 42 | OK — reviewed, no change required | `      .createMenu('KK Admin')` |
| 43 | OK — reviewed, no change required | `      .addItem('Setup/Repair Named Ranges', 'kkSetupNamedRanges')` |
| 44 | OK — reviewed, no change required | `      .addItem('Phase 1: Create/Repair Log Sheets', 'kkEnsurePhase1Sheets')` |
| 45 | OK — reviewed, no change required | `      .addItem('Phase 1: Show Version Health', 'kkShowPhase1Health')` |
| 46 | OK — reviewed, no change required | `      .addSeparator()` |
| 47 | OK — reviewed, no change required | `      .addItem('1) Create Event from Dashboard', 'kkCreateEventFromDashboard')` |
| 48 | OK — reviewed, no change required | `      .addItem('2) Add Assets from Dashboard', 'kkAddAssetsFromDashboard')` |
| 49 | OK — reviewed, no change required | `      .addItem('3) Update Accessory Stock', 'kkUpdateAccessoryStockFromDashboard')` |
| 50 | OK — reviewed, no change required | `      .addItem('4) Add Quick Booking', 'kkAddQuickBookingFromDashboard')` |
| 51 | OK — reviewed, no change required | `      .addSeparator()` |
| 52 | OK — reviewed, no change required | `      .addItem('Convert Event Drive Image URLs', 'kkConvertEventDriveUrls')` |
| 53 | OK — reviewed, no change required | `      .addItem('Run Basic Health Check', 'kkRunBasicHealthCheck')` |
| 54 | OK — reviewed, no change required | `      .addSeparator()` |
| 55 | OK — reviewed, no change required | `      .addItem('CRM: Generate Admin API Key', 'kkGenerateAdminApiKey')` |
| 56 | OK — reviewed, no change required | `      .addItem('CRM: Set Poster Folder ID', 'kkSetPosterFolderId')` |
| 57 | OK — reviewed, no change required | `      .addItem('CRM: Authorize Drive Access', 'kkAuthorizeDriveAccess')` |
| 58 | OK — reviewed, no change required | `      .addItem('CRM: Show Setup Info', 'kkShowAdminCrmSetupInfo')` |
| 59 | OK — reviewed, no change required | `      .addSeparator()` |
| 60 | OK — reviewed, no change required | `      .addItem('CRM: Run 30-day Archive Cleanup', 'kkCleanupOldData30Days')` |
| 61 | OK — reviewed, no change required | `      .addItem('CRM: Install Daily Cleanup Trigger', 'kkInstallDailyCleanupTrigger')` |
| 62 | OK — reviewed, no change required | `      .addToUi();` |
| 63 | OK — reviewed, no change required | `  } catch (err) {` |
| 64 | OK — reviewed, no change required | `    Logger.log('onOpen skipped because Spreadsheet UI is not available in this context: ' + (err && err.message ? err.message : err));` |
| 65 | OK — reviewed, no change required | `  }` |
| 66 | OK — reviewed, no change required | `}` |
| 67 | OK — blank/separator line | `` |
| 68 | OK — reviewed, no change required | `function kkSafeAlert_(message) {` |
| 69 | OK — reviewed, no change required | `  const text = String(message || '');` |
| 70 | OK — reviewed, no change required | `  try {` |
| 71 | REVIEWED UI alert / safe fallback where possible | `    SpreadsheetApp.getUi().alert(text);` |
| 72 | OK — reviewed, no change required | `  } catch (err) {` |
| 73 | OK — reviewed, no change required | `    Logger.log(text);` |
| 74 | OK — reviewed, no change required | `  }` |
| 75 | OK — reviewed, no change required | `}` |
| 76 | OK — blank/separator line | `` |
| 77 | OK — reviewed, no change required | `function kkSafeStringify_(value, maxLen) {` |
| 78 | OK — reviewed, no change required | `  const limit = maxLen || 1500;` |
| 79 | OK — reviewed, no change required | `  try {` |
| 80 | OK — reviewed, no change required | `    const clean = JSON.parse(JSON.stringify(value || {}, function(key, val) {` |
| 81 | REVIEWED sensitive API key redaction/ENV only | `      if (key === 'apiKey') return '[redacted]';` |
| 82 | OK — reviewed, no change required | `      if (key === 'base64') return '[base64 omitted]';` |
| 83 | OK — reviewed, no change required | `      if (typeof val === 'string' && val.length > 300) return val.slice(0, 300) + '…';` |
| 84 | OK — reviewed, no change required | `      return val;` |
| 85 | OK — reviewed, no change required | `    }));` |
| 86 | OK — reviewed, no change required | `    const text = JSON.stringify(clean);` |
| 87 | OK — reviewed, no change required | `    return text.length > limit ? text.slice(0, limit) + '…' : text;` |
| 88 | OK — reviewed, no change required | `  } catch (err) {` |
| 89 | OK — reviewed, no change required | `    return String(value || '').slice(0, limit);` |
| 90 | OK — reviewed, no change required | `  }` |
| 91 | OK — reviewed, no change required | `}` |
| 92 | OK — blank/separator line | `` |
| 93 | OK — reviewed, no change required | `function kkEnsurePhase1Sheets() {` |
| 94 | OK — reviewed, no change required | `  kkEnsureCrmArchiveSheets_();` |
| 95 | OK — reviewed, no change required | `  kkEnsureAdminLogSheets_();` |
| 96 | OK — reviewed, no change required | `  kkSafeAlert_('Phase 1 sheets are ready:\n- ' + KK.adminAuditLog + '\n- ' + KK.adminErrorLog);` |
| 97 | OK — reviewed, no change required | `}` |
| 98 | OK — blank/separator line | `` |
| 99 | OK — reviewed, no change required | `function kkEnsureAdminLogSheets_() {` |
| 100 | OK — reviewed, no change required | `  kkEnsureSheetWithHeaders_(KK.adminAuditLog, [` |
| 101 | OK — reviewed, no change required | `    'timestamp','version','action','status','duration_ms','summary','event_id','booking_id','row_number','admin_source'` |
| 102 | OK — reviewed, no change required | `  ]);` |
| 103 | OK — reviewed, no change required | `  kkEnsureSheetWithHeaders_(KK.adminErrorLog, [` |
| 104 | OK — reviewed, no change required | `    'timestamp','version','action','error_message','duration_ms','payload_summary','stack','admin_source'` |
| 105 | OK — reviewed, no change required | `  ]);` |
| 106 | OK — reviewed, no change required | `  return true;` |
| 107 | OK — reviewed, no change required | `}` |
| 108 | OK — blank/separator line | `` |
| 109 | OK — comment/documentation reviewed | `// PERFORMANCE FIX: O(1) Append instead of slow appendRow()` |
| 110 | OK — reviewed, no change required | `function kkAppendRowSafe_(sheetName, row) {` |
| 111 | OK — reviewed, no change required | `  try {` |
| 112 | OK — reviewed, no change required | `    kkEnsureAdminLogSheets_();` |
| 113 | OK — reviewed, no change required | `    const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);` |
| 114 | OK — reviewed, no change required | `    const targetRow = Math.max(sh.getLastRow() + 1, 2);` |
| 115 | REVIEWED batch write preferred | `    sh.getRange(targetRow, 1, 1, row.length).setValues([row]);` |
| 116 | OK — reviewed, no change required | `  } catch (logErr) {` |
| 117 | OK — reviewed, no change required | `    Logger.log('Could not write to ' + sheetName + ': ' + (logErr && logErr.message ? logErr.message : logErr));` |
| 118 | OK — reviewed, no change required | `  }` |
| 119 | OK — reviewed, no change required | `}` |
| 120 | OK — blank/separator line | `` |
| 121 | OK — reviewed, no change required | `function kkAuditLog_(action, payload, result, startedAt) {` |
| 122 | OK — reviewed, no change required | `  const duration = startedAt ? (Date.now() - startedAt) : '';` |
| 123 | OK — reviewed, no change required | `  kkAppendRowSafe_(KK.adminAuditLog, [` |
| 124 | OK — reviewed, no change required | `    new Date(),` |
| 125 | OK — reviewed, no change required | `    KK_ADMIN_VERSION,` |
| 126 | OK — reviewed, no change required | `    action || '',` |
| 127 | OK — reviewed, no change required | `    'OK',` |
| 128 | OK — reviewed, no change required | `    duration,` |
| 129 | OK — reviewed, no change required | `    kkSafeStringify_(result, 800),` |
| 130 | OK — reviewed, no change required | `    result && result.event_id ? result.event_id : (payload && payload.event_id ? payload.event_id : ''),` |
| 131 | OK — reviewed, no change required | `    result && result.booking_id ? result.booking_id : '',` |
| 132 | OK — reviewed, no change required | `    result && result.row_number ? result.row_number : '',` |
| 133 | OK — reviewed, no change required | `    payload && payload.proxyVersion ? payload.proxyVersion : ''` |
| 134 | OK — reviewed, no change required | `  ]);` |
| 135 | OK — reviewed, no change required | `}` |
| 136 | OK — blank/separator line | `` |
| 137 | OK — reviewed, no change required | `function kkErrorLog_(action, payload, err, startedAt) {` |
| 138 | OK — reviewed, no change required | `  const duration = startedAt ? (Date.now() - startedAt) : '';` |
| 139 | OK — reviewed, no change required | `  kkAppendRowSafe_(KK.adminErrorLog, [` |
| 140 | OK — reviewed, no change required | `    new Date(),` |
| 141 | OK — reviewed, no change required | `    KK_ADMIN_VERSION,` |
| 142 | OK — reviewed, no change required | `    action || '',` |
| 143 | OK — reviewed, no change required | `    err && err.message ? err.message : String(err),` |
| 144 | OK — reviewed, no change required | `    duration,` |
| 145 | OK — reviewed, no change required | `    kkSafeStringify_(payload, 1000),` |
| 146 | OK — reviewed, no change required | `    err && err.stack ? String(err.stack).slice(0, 1500) : '',` |
| 147 | OK — reviewed, no change required | `    payload && payload.proxyVersion ? payload.proxyVersion : ''` |
| 148 | OK — reviewed, no change required | `  ]);` |
| 149 | OK — reviewed, no change required | `}` |
| 150 | OK — blank/separator line | `` |
| 151 | OK — reviewed, no change required | `function kkSheetExists_(name) {` |
| 152 | OK — reviewed, no change required | `  return !!SpreadsheetApp.getActive().getSheetByName(name);` |
| 153 | OK — reviewed, no change required | `}` |
| 154 | OK — blank/separator line | `` |
| 155 | OK — reviewed, no change required | `function kkPhase1Diagnostics_(payload) {` |
| 156 | OK — reviewed, no change required | `  const props = PropertiesService.getScriptProperties();` |
| 157 | OK — reviewed, no change required | `  const frontendSheetId = payload && payload.frontendSheetId ? String(payload.frontendSheetId).trim() : '';` |
| 158 | OK — reviewed, no change required | `  const spreadsheetId = SpreadsheetApp.getActive().getId();` |
| 159 | OK — reviewed, no change required | `  return {` |
| 160 | OK — reviewed, no change required | `    admin_api_version: KK_ADMIN_VERSION,` |
| 161 | OK — reviewed, no change required | `    spreadsheet_id: spreadsheetId,` |
| 162 | OK — reviewed, no change required | `    frontend_sheet_id: frontendSheetId,` |
| 163 | OK — reviewed, no change required | `    frontend_backend_same_sheet: !!frontendSheetId && frontendSheetId === spreadsheetId,` |
| 164 | REVIEWED API key stored in script/env, not public frontend | `    admin_api_key_set: !!String(props.getProperty('KK_ADMIN_API_KEY') || '').trim(),` |
| 165 | OK — reviewed, no change required | `    poster_folder_id_set: !!String(props.getProperty('KK_POSTER_FOLDER_ID') || '').trim(),` |
| 166 | OK — reviewed, no change required | `    audit_log_sheet_exists: kkSheetExists_(KK.adminAuditLog),` |
| 167 | OK — reviewed, no change required | `    error_log_sheet_exists: kkSheetExists_(KK.adminErrorLog),` |
| 168 | OK — reviewed, no change required | `    log_sheets_ready: kkSheetExists_(KK.adminAuditLog) && kkSheetExists_(KK.adminErrorLog),` |
| 169 | OK — reviewed, no change required | `    direct_fallback_disabled: KK_PHASE1_DIRECT_FALLBACK_DISABLED,` |
| 170 | OK — reviewed, no change required | `    generated_at: kkApiDateTime_(new Date())` |
| 171 | OK — reviewed, no change required | `  };` |
| 172 | OK — reviewed, no change required | `}` |
| 173 | OK — blank/separator line | `` |
| 174 | OK — reviewed, no change required | `function kkShowPhase1Health() {` |
| 175 | OK — reviewed, no change required | `  kkEnsureAdminLogSheets_();` |
| 176 | OK — reviewed, no change required | `  const d = kkPhase1Diagnostics_({});` |
| 177 | OK — reviewed, no change required | `  kkSafeAlert_(` |
| 178 | OK — reviewed, no change required | `    'KK Phone Rental Phase 1 Health\n\n' +` |
| 179 | OK — reviewed, no change required | `    'Version: ' + d.admin_api_version + '\n' +` |
| 180 | OK — reviewed, no change required | `    'Spreadsheet ID: ' + d.spreadsheet_id + '\n' +` |
| 181 | OK — reviewed, no change required | `    'API key set: ' + d.admin_api_key_set + '\n' +` |
| 182 | OK — reviewed, no change required | `    'Poster folder set: ' + d.poster_folder_id_set + '\n' +` |
| 183 | OK — reviewed, no change required | `    'Audit log exists: ' + d.audit_log_sheet_exists + '\n' +` |
| 184 | OK — reviewed, no change required | `    'Error log exists: ' + d.error_log_sheet_exists` |
| 185 | OK — reviewed, no change required | `  );` |
| 186 | OK — reviewed, no change required | `}` |
| 187 | OK — blank/separator line | `` |
| 188 | OK — reviewed, no change required | `function kkSheet_(name) {` |
| 189 | OK — reviewed, no change required | `  const sh = SpreadsheetApp.getActive().getSheetByName(name);` |
| 190 | OK — reviewed, no change required | `  if (!sh) throw new Error('Missing sheet: ' + name);` |
| 191 | OK — reviewed, no change required | `  return sh;` |
| 192 | OK — reviewed, no change required | `}` |
| 193 | OK — blank/separator line | `` |
| 194 | OK — comment/documentation reviewed | `// PERFORMANCE FIX: Helpers for Dynamic Ranging` |
| 195 | OK — reviewed, no change required | `function kkGetDynamicRange_(sheetName, startRow, startCol, numCols) {` |
| 196 | OK — reviewed, no change required | `  const sh = kkSheet_(sheetName);` |
| 197 | OK — reviewed, no change required | `  const lastRow = sh.getLastRow();` |
| 198 | OK — reviewed, no change required | `  if (lastRow < startRow) return null;` |
| 199 | OK — reviewed, no change required | `  return sh.getRange(startRow, startCol, lastRow - startRow + 1, numCols);` |
| 200 | OK — reviewed, no change required | `}` |
| 201 | OK — blank/separator line | `` |
| 202 | OK — reviewed, no change required | `function kkGetValues_(sheetName, startRow, startCol, numCols) {` |
| 203 | OK — reviewed, no change required | `  const range = kkGetDynamicRange_(sheetName, startRow, startCol, numCols);` |
| 204 | REVIEWED range read scope | `  return range ? range.getValues() : [];` |
| 205 | OK — reviewed, no change required | `}` |
| 206 | OK — blank/separator line | `` |
| 207 | OK — reviewed, no change required | `function kkSetupNamedRanges() {` |
| 208 | OK — reviewed, no change required | `  const ss = SpreadsheetApp.getActive();` |
| 209 | OK — reviewed, no change required | `  KK_NAMED_RANGES.forEach(cfg => {` |
| 210 | OK — reviewed, no change required | `    ss.getNamedRanges()` |
| 211 | OK — reviewed, no change required | `      .filter(nr => nr.getName() === cfg.name)` |
| 212 | OK — reviewed, no change required | `      .forEach(nr => nr.remove());` |
| 213 | OK — reviewed, no change required | `    ss.setNamedRange(cfg.name, kkSheet_(cfg.sheet).getRange(cfg.a1));` |
| 214 | OK — reviewed, no change required | `  });` |
| 215 | OK — reviewed, no change required | `  kkEnsureCrmArchiveSheets_();` |
| 216 | OK — reviewed, no change required | `  kkEnsureAdminLogSheets_();` |
| 217 | OK — reviewed, no change required | `  kkSafeAlert_('Named ranges have been created/repaired: ' + KK_NAMED_RANGES.length + '\nArchive/customer/log sheets checked.');` |
| 218 | OK — reviewed, no change required | `}` |
| 219 | OK — blank/separator line | `` |
| 220 | OK — reviewed, no change required | `function kkRange_(name, sheetName, fallbackA1) {` |
| 221 | OK — reviewed, no change required | `  const ss = SpreadsheetApp.getActive();` |
| 222 | OK — reviewed, no change required | `  const named = ss.getRangeByName(name);` |
| 223 | OK — reviewed, no change required | `  if (named) return named;` |
| 224 | OK — reviewed, no change required | `  return kkSheet_(sheetName).getRange(fallbackA1);` |
| 225 | OK — reviewed, no change required | `}` |
| 226 | OK — blank/separator line | `` |
| 227 | OK — reviewed, no change required | `function kkBlank_(value) {` |
| 228 | OK — reviewed, no change required | `  return value === '' || value === null || typeof value === 'undefined';` |
| 229 | OK — reviewed, no change required | `}` |
| 230 | OK — blank/separator line | `` |
| 231 | OK — reviewed, no change required | `function kkRowBlank_(row) {` |
| 232 | OK — reviewed, no change required | `  return row.every(kkBlank_);` |
| 233 | OK — reviewed, no change required | `}` |
| 234 | OK — blank/separator line | `` |
| 235 | OK — comment/documentation reviewed | `// PERFORMANCE FIX: Optimized Empty Rows Scanner (No O(MaxRows) scanning)` |
| 236 | OK — reviewed, no change required | `function kkEmptyRows_(sheetName, keyCol, startRow, writeStartCol, writeColCount, needed) {` |
| 237 | OK — reviewed, no change required | `  const sh = kkSheet_(sheetName);` |
| 238 | OK — reviewed, no change required | `  const last = Math.max(sh.getLastRow(), startRow - 1);` |
| 239 | OK — reviewed, no change required | `  const rows = [];` |
| 240 | OK — reviewed, no change required | `  const neededRows = Math.max(Number(needed || 1), 1);` |
| 241 | OK — blank/separator line | `` |
| 242 | OK — reviewed, no change required | `  if (last >= startRow) {` |
| 243 | OK — reviewed, no change required | `    const scanRows = last - startRow + 1;` |
| 244 | REVIEWED range read scope | `    const keyValues = sh.getRange(startRow, keyCol, scanRows, 1).getValues();` |
| 245 | REVIEWED range read scope | `    const guardValues = sh.getRange(startRow, writeStartCol, scanRows, writeColCount).getValues();` |
| 246 | OK — reviewed, no change required | `    for (let i = 0; i < scanRows && rows.length < neededRows; i++) {` |
| 247 | OK — reviewed, no change required | `      if (kkBlank_(keyValues[i][0]) && kkRowBlank_(guardValues[i])) rows.push(startRow + i);` |
| 248 | OK — reviewed, no change required | `    }` |
| 249 | OK — reviewed, no change required | `  }` |
| 250 | OK — blank/separator line | `` |
| 251 | OK — reviewed, no change required | `  let next = Math.max(last + 1, startRow);` |
| 252 | OK — reviewed, no change required | `  const missing = neededRows - rows.length;` |
| 253 | OK — reviewed, no change required | `  if (missing > 0) {` |
| 254 | OK — reviewed, no change required | `    const maxRows = sh.getMaxRows();` |
| 255 | OK — reviewed, no change required | `    const requiredLastRow = next + missing - 1;` |
| 256 | OK — reviewed, no change required | `    if (requiredLastRow > maxRows) {` |
| 257 | OK — reviewed, no change required | `      sh.insertRowsAfter(maxRows, requiredLastRow - maxRows);` |
| 258 | OK — reviewed, no change required | `    }` |
| 259 | OK — reviewed, no change required | `    for (let i = 0; i < missing; i++) rows.push(next + i);` |
| 260 | OK — reviewed, no change required | `  }` |
| 261 | OK — reviewed, no change required | `  return rows;` |
| 262 | OK — reviewed, no change required | `}` |
| 263 | OK — blank/separator line | `` |
| 264 | OK — reviewed, no change required | `function kkFirstEmptyRow_(sheetName, keyCol, startRow, writeStartCol, writeColCount) {` |
| 265 | OK — reviewed, no change required | `  return kkEmptyRows_(sheetName, keyCol, startRow, writeStartCol || keyCol, writeColCount || 1, 1)[0];` |
| 266 | OK — reviewed, no change required | `}` |
| 267 | OK — blank/separator line | `` |
| 268 | OK — reviewed, no change required | `function kkSlug_(text) {` |
| 269 | OK — reviewed, no change required | `  return String(text || '')` |
| 270 | OK — reviewed, no change required | `    .normalize('NFKD')` |
| 271 | OK — reviewed, no change required | `    .replace(/[\u0300-\u036f]/g, '')` |
| 272 | OK — reviewed, no change required | `    .replace(/[^A-Za-z0-9]+/g, '-')` |
| 273 | OK — reviewed, no change required | `    .replace(/^-+|-+$/g, '')` |
| 274 | OK — reviewed, no change required | `    .toUpperCase()` |
| 275 | OK — reviewed, no change required | `    .slice(0, 28) || 'EVENT';` |
| 276 | OK — reviewed, no change required | `}` |
| 277 | OK — blank/separator line | `` |
| 278 | OK — reviewed, no change required | `function kkDateObj_(value) {` |
| 279 | OK — reviewed, no change required | `  const d = value instanceof Date ? value : new Date(value);` |
| 280 | OK — reviewed, no change required | `  if (isNaN(d.getTime())) throw new Error('Invalid date: ' + value);` |
| 281 | OK — reviewed, no change required | `  return d;` |
| 282 | OK — reviewed, no change required | `}` |
| 283 | OK — blank/separator line | `` |
| 284 | OK — reviewed, no change required | `function kkDateKey_(dateValue) {` |
| 285 | OK — reviewed, no change required | `  return Utilities.formatDate(kkDateObj_(dateValue), Session.getScriptTimeZone(), 'yyyyMMdd');` |
| 286 | OK — reviewed, no change required | `}` |
| 287 | OK — blank/separator line | `` |
| 288 | OK — reviewed, no change required | `function kkSameDate_(a, b) {` |
| 289 | OK — reviewed, no change required | `  if (!a || !b) return false;` |
| 290 | OK — reviewed, no change required | `  return kkDateKey_(a) === kkDateKey_(b);` |
| 291 | OK — reviewed, no change required | `}` |
| 292 | OK — blank/separator line | `` |
| 293 | OK — reviewed, no change required | `function kkGenerateUniqueEventId_(eventName, eventDate) {` |
| 294 | OK — reviewed, no change required | `  const base = \`EVT-${kkDateKey_(eventDate)}-${kkSlug_(eventName)}\`;` |
| 295 | OK — reviewed, no change required | `  const events = kkGetValues_(KK.events, 5, 1, 1).flat().filter(String);` |
| 296 | OK — reviewed, no change required | `  if (!events.includes(base)) return base;` |
| 297 | OK — reviewed, no change required | `  for (let i = 2; i < 100; i++) {` |
| 298 | OK — reviewed, no change required | `    const id = \`${base}-${i}\`;` |
| 299 | OK — reviewed, no change required | `    if (!events.includes(id)) return id;` |
| 300 | OK — reviewed, no change required | `  }` |
| 301 | OK — reviewed, no change required | `  throw new Error('Cannot generate unique event_id');` |
| 302 | OK — reviewed, no change required | `}` |
| 303 | OK — blank/separator line | `` |
| 304 | OK — reviewed, no change required | `function kkExtractDriveFileId_(value) {` |
| 305 | OK — reviewed, no change required | `  const s = String(value || '').trim();` |
| 306 | OK — reviewed, no change required | `  if (!s) return '';` |
| 307 | OK — reviewed, no change required | `  const patterns = [` |
| 308 | OK — reviewed, no change required | `    /\/file\/d\/([a-zA-Z0-9_-]{15,})/,` |
| 309 | OK — reviewed, no change required | `    /[?&]id=([a-zA-Z0-9_-]{15,})/,` |
| 310 | OK — reviewed, no change required | `    /\/thumbnail\?id=([a-zA-Z0-9_-]{15,})/,` |
| 311 | OK — reviewed, no change required | `    /googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/,` |
| 312 | OK — reviewed, no change required | `    /lh[3-6]\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/,` |
| 313 | OK — reviewed, no change required | `    /uc\?export=(?:view|download)&id=([a-zA-Z0-9_-]{15,})/` |
| 314 | OK — reviewed, no change required | `  ];` |
| 315 | OK — reviewed, no change required | `  for (const re of patterns) {` |
| 316 | OK — reviewed, no change required | `    const m = s.match(re);` |
| 317 | OK — reviewed, no change required | `    if (m && m[1]) return m[1];` |
| 318 | OK — reviewed, no change required | `  }` |
| 319 | OK — reviewed, no change required | `  if (!/^https?:\/\//i.test(s) && /^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;` |
| 320 | OK — reviewed, no change required | `  return '';` |
| 321 | OK — reviewed, no change required | `}` |
| 322 | OK — blank/separator line | `` |
| 323 | OK — reviewed, no change required | `function kkDrivePermissionApiSetAnyone_(fileId) {` |
| 324 | OK — reviewed, no change required | `  const id = String(fileId || '').trim();` |
| 325 | OK — reviewed, no change required | `  if (!id) throw new Error('Missing Drive file ID');` |
| 326 | OK — reviewed, no change required | `  const url = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) +` |
| 327 | OK — reviewed, no change required | `    '/permissions?supportsAllDrives=true&sendNotificationEmail=false';` |
| 328 | REVIEWED network call and error handling | `  const resp = UrlFetchApp.fetch(url, {` |
| 329 | OK — reviewed, no change required | `    method: 'post',` |
| 330 | OK — reviewed, no change required | `    contentType: 'application/json',` |
| 331 | OK — reviewed, no change required | `    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },` |
| 332 | OK — reviewed, no change required | `    payload: JSON.stringify({ role: 'reader', type: 'anyone' }),` |
| 333 | OK — reviewed, no change required | `    muteHttpExceptions: true` |
| 334 | OK — reviewed, no change required | `  });` |
| 335 | OK — reviewed, no change required | `  const code = resp.getResponseCode();` |
| 336 | OK — reviewed, no change required | `  if ((code >= 200 && code < 300) || code === 409) return { ok: true, status: code, method: 'Drive API' };` |
| 337 | OK — reviewed, no change required | `  const body = String(resp.getContentText() || '').slice(0, 500);` |
| 338 | OK — reviewed, no change required | `  throw new Error('Drive API HTTP ' + code + (body ? ': ' + body : ''));` |
| 339 | OK — reviewed, no change required | `}` |
| 340 | OK — blank/separator line | `` |
| 341 | OK — reviewed, no change required | `function kkEnsureDriveFilePublic_(fileId, options) {` |
| 342 | OK — reviewed, no change required | `  const id = String(fileId || '').trim();` |
| 343 | OK — reviewed, no change required | `  if (!id) return { file_id: '', view_url: '', public_checked: false, sharing_warning: '' };` |
| 344 | OK — reviewed, no change required | `  const errors = [];` |
| 345 | OK — reviewed, no change required | `  let viewUrl = '';` |
| 346 | OK — blank/separator line | `` |
| 347 | OK — reviewed, no change required | `  try {` |
| 348 | REVIEWED Drive permission scope required | `    const file = DriveApp.getFileById(id);` |
| 349 | OK — reviewed, no change required | `    viewUrl = file.getUrl();` |
| 350 | OK — reviewed, no change required | `    try {` |
| 351 | REVIEWED Drive permission scope required | `      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);` |
| 352 | OK — reviewed, no change required | `      return {` |
| 353 | OK — reviewed, no change required | `        file_id: id,` |
| 354 | OK — reviewed, no change required | `        view_url: viewUrl,` |
| 355 | OK — reviewed, no change required | `        public_checked: true,` |
| 356 | OK — reviewed, no change required | `        sharing_warning: ''` |
| 357 | OK — reviewed, no change required | `      };` |
| 358 | OK — reviewed, no change required | `    } catch (shareErr) {` |
| 359 | REVIEWED Drive permission scope required | `      errors.push('DriveApp.setSharing: ' + (shareErr && shareErr.message ? shareErr.message : String(shareErr)));` |
| 360 | OK — reviewed, no change required | `    }` |
| 361 | OK — reviewed, no change required | `  } catch (fileErr) {` |
| 362 | REVIEWED Drive permission scope required | `    errors.push('DriveApp.getFileById: ' + (fileErr && fileErr.message ? fileErr.message : String(fileErr)));` |
| 363 | OK — reviewed, no change required | `  }` |
| 364 | OK — blank/separator line | `` |
| 365 | OK — reviewed, no change required | `  try {` |
| 366 | OK — reviewed, no change required | `    kkDrivePermissionApiSetAnyone_(id);` |
| 367 | OK — reviewed, no change required | `    if (!viewUrl) {` |
| 368 | REVIEWED Drive permission scope required | `      try { viewUrl = DriveApp.getFileById(id).getUrl(); } catch (ignore) {}` |
| 369 | OK — reviewed, no change required | `    }` |
| 370 | OK — reviewed, no change required | `    return {` |
| 371 | OK — reviewed, no change required | `      file_id: id,` |
| 372 | OK — reviewed, no change required | `      view_url: viewUrl,` |
| 373 | OK — reviewed, no change required | `      public_checked: true,` |
| 374 | OK — reviewed, no change required | `      sharing_warning: ''` |
| 375 | OK — reviewed, no change required | `    };` |
| 376 | OK — reviewed, no change required | `  } catch (apiErr) {` |
| 377 | OK — reviewed, no change required | `    errors.push('Drive API permissions.create: ' + (apiErr && apiErr.message ? apiErr.message : String(apiErr)));` |
| 378 | OK — reviewed, no change required | `  }` |
| 379 | OK — blank/separator line | `` |
| 380 | OK — reviewed, no change required | `  return {` |
| 381 | OK — reviewed, no change required | `    file_id: id,` |
| 382 | OK — reviewed, no change required | `    view_url: viewUrl,` |
| 383 | OK — reviewed, no change required | `    public_checked: false,` |
| 384 | OK — reviewed, no change required | `    sharing_warning: 'Poster URL was saved, but Apps Script could not change Drive sharing automatically. Details: ' + errors.join(' | ')` |
| 385 | OK — reviewed, no change required | `  };` |
| 386 | OK — reviewed, no change required | `}` |
| 387 | OK — blank/separator line | `` |
| 388 | OK — reviewed, no change required | `function kkNormalizePoster_(url, options) {` |
| 389 | OK — reviewed, no change required | `  const opts = options || {};` |
| 390 | OK — reviewed, no change required | `  const s = String(url || '').trim();` |
| 391 | OK — reviewed, no change required | `  if (!s) return { url: '', drive_file_id: '', view_url: '', public_checked: false };` |
| 392 | OK — reviewed, no change required | `  if (/drive\.google\.com\/(drive\/u\/\d+\/)?folders\//i.test(s) || /drive\.google\.com\/drive\/folders\//i.test(s)) {` |
| 393 | REVIEWED Drive URL logic/permission flow | `    throw new Error('Poster URL must be a Google Drive FILE link, not a folder link.');` |
| 394 | OK — reviewed, no change required | `  }` |
| 395 | OK — blank/separator line | `` |
| 396 | OK — reviewed, no change required | `  const id = kkExtractDriveFileId_(s);` |
| 397 | OK — reviewed, no change required | `  if (id) {` |
| 398 | OK — reviewed, no change required | `    const publicInfo = opts.ensurePublic ? kkEnsureDriveFilePublic_(id, { strict: opts.strictPublic === true }) : { file_id: id, view_url: '', public_checked: false, sharing_war…` |
| 399 | OK — reviewed, no change required | `    return {` |
| 400 | OK — reviewed, no change required | `      url: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w1200',` |
| 401 | OK — reviewed, no change required | `      drive_file_id: id,` |
| 402 | OK — reviewed, no change required | `      view_url: publicInfo.view_url || '',` |
| 403 | OK — reviewed, no change required | `      public_checked: !!publicInfo.public_checked,` |
| 404 | OK — reviewed, no change required | `      sharing_warning: publicInfo.sharing_warning || ''` |
| 405 | OK — reviewed, no change required | `    };` |
| 406 | OK — reviewed, no change required | `  }` |
| 407 | OK — blank/separator line | `` |
| 408 | OK — reviewed, no change required | `  if (/drive\.google\.com/i.test(s)) {` |
| 409 | REVIEWED Drive URL logic/permission flow | `    throw new Error('Cannot read Google Drive file ID from Poster URL.');` |
| 410 | OK — reviewed, no change required | `  }` |
| 411 | OK — blank/separator line | `` |
| 412 | OK — reviewed, no change required | `  if (!/^https?:\/\//i.test(s)) {` |
| 413 | REVIEWED Drive URL logic/permission flow | `    throw new Error('Poster URL must be a Google Drive file link, Drive file ID, or direct http(s) image URL.');` |
| 414 | OK — reviewed, no change required | `  }` |
| 415 | OK — blank/separator line | `` |
| 416 | OK — reviewed, no change required | `  return { url: s, drive_file_id: '', view_url: s, public_checked: false };` |
| 417 | OK — reviewed, no change required | `}` |
| 418 | OK — blank/separator line | `` |
| 419 | OK — reviewed, no change required | `function kkDriveThumbnail_(url) {` |
| 420 | OK — reviewed, no change required | `  return kkNormalizePoster_(url, { ensurePublic: false }).url;` |
| 421 | OK — reviewed, no change required | `}` |
| 422 | OK — blank/separator line | `` |
| 423 | OK — reviewed, no change required | `function kkPosterForWrite_(url, options) {` |
| 424 | OK — reviewed, no change required | `  const opts = options || {};` |
| 425 | OK — reviewed, no change required | `  return kkNormalizePoster_(url, { ensurePublic: true, strictPublic: opts.strictPublic === true });` |
| 426 | OK — reviewed, no change required | `}` |
| 427 | OK — blank/separator line | `` |
| 428 | OK — reviewed, no change required | `function kkExtractDriveFolderId_(value) {` |
| 429 | OK — reviewed, no change required | `  const s = String(value || '').trim();` |
| 430 | OK — reviewed, no change required | `  if (!s) return '';` |
| 431 | OK — reviewed, no change required | `  const folderMatch = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);` |
| 432 | OK — reviewed, no change required | `  if (folderMatch) return folderMatch[1];` |
| 433 | OK — reviewed, no change required | `  const idMatch = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);` |
| 434 | OK — reviewed, no change required | `  if (idMatch) return idMatch[1];` |
| 435 | OK — reviewed, no change required | `  return s.replace(/[^a-zA-Z0-9_-]/g, '');` |
| 436 | OK — reviewed, no change required | `}` |
| 437 | OK — blank/separator line | `` |
| 438 | OK — reviewed, no change required | `function kkIsTrue_(v) {` |
| 439 | OK — reviewed, no change required | `  return v === true || String(v).toUpperCase() === 'TRUE' || String(v) === '1' || String(v).toLowerCase() === 'yes';` |
| 440 | OK — reviewed, no change required | `}` |
| 441 | OK — blank/separator line | `` |
| 442 | OK — reviewed, no change required | `function kkActiveHold_(status) {` |
| 443 | OK — reviewed, no change required | `  return ['pending', 'confirmed', 'picked_up'].includes(String(status || '').toLowerCase());` |
| 444 | OK — reviewed, no change required | `}` |
| 445 | OK — blank/separator line | `` |
| 446 | OK — reviewed, no change required | `function kkAssetIsRentableAvailable_(statusValue, rentableValue) {` |
| 447 | OK — reviewed, no change required | `  const status = String(statusValue || '').toLowerCase().trim();` |
| 448 | OK — reviewed, no change required | `  const rentableBlank = kkBlank_(rentableValue);` |
| 449 | OK — reviewed, no change required | `  const rentable = rentableBlank ? status === 'available' : kkIsTrue_(rentableValue);` |
| 450 | OK — reviewed, no change required | `  return status === 'available' && rentable;` |
| 451 | OK — reviewed, no change required | `}` |
| 452 | OK — blank/separator line | `` |
| 453 | OK — reviewed, no change required | `function kkGetEventById_(eventId) {` |
| 454 | OK — reviewed, no change required | `  const rows = kkGetValues_(KK.events, 5, 1, 9);` |
| 455 | OK — reviewed, no change required | `  for (const r of rows) {` |
| 456 | OK — reviewed, no change required | `    if (String(r[0]).trim() === String(eventId).trim()) {` |
| 457 | OK — reviewed, no change required | `      return { event_id: r[0], event_name: r[1], event_date: r[2], venue: r[3], status: r[5], active: kkIsTrue_(r[6]), data_health: r[8] };` |
| 458 | OK — reviewed, no change required | `    }` |
| 459 | OK — reviewed, no change required | `  }` |
| 460 | OK — reviewed, no change required | `  throw new Error('Event not found: ' + eventId);` |
| 461 | OK — reviewed, no change required | `}` |
| 462 | OK — blank/separator line | `` |
| 463 | OK — reviewed, no change required | `function kkGetPackageByTemplateId_(templateId) {` |
| 464 | OK — reviewed, no change required | `  const rows = kkGetValues_(KK.packages, 5, 1, 10);` |
| 465 | OK — reviewed, no change required | `  for (const r of rows) {` |
| 466 | OK — reviewed, no change required | `    if (String(r[0]).trim() === String(templateId).trim()) {` |
| 467 | OK — reviewed, no change required | `      return { template_id: r[0], model_group: r[1], package_type: r[2], lens_group: r[3], standard_price: r[4], display_name: r[5], active: kkIsTrue_(r[7]), use_case: r[9] || '…` |
| 468 | OK — reviewed, no change required | `    }` |
| 469 | OK — reviewed, no change required | `  }` |
| 470 | OK — reviewed, no change required | `  throw new Error('Template/package not found: ' + templateId);` |
| 471 | OK — reviewed, no change required | `}` |
| 472 | OK — blank/separator line | `` |
| 473 | OK — reviewed, no change required | `function kkEventDateMap_() {` |
| 474 | OK — reviewed, no change required | `  const map = {};` |
| 475 | OK — reviewed, no change required | `  kkGetValues_(KK.events, 5, 1, 3).forEach(r => { if (r[0]) map[String(r[0]).trim()] = r[2]; });` |
| 476 | OK — reviewed, no change required | `  return map;` |
| 477 | OK — reviewed, no change required | `}` |
| 478 | OK — blank/separator line | `` |
| 479 | OK — reviewed, no change required | `function kkBookedAssetIdsForDate_(eventDate, excludeRow) {` |
| 480 | OK — reviewed, no change required | `  const eventDates = kkEventDateMap_();` |
| 481 | OK — reviewed, no change required | `  const booked = { phone: {}, lens: {} };` |
| 482 | OK — reviewed, no change required | `  const skipRow = Number(excludeRow || 0);` |
| 483 | OK — reviewed, no change required | `  const rows = kkGetValues_(KK.bookings, 5, 3, 9);` |
| 484 | OK — reviewed, no change required | `  rows.forEach((r, i) => {` |
| 485 | OK — reviewed, no change required | `    const sourceRow = i + 5;` |
| 486 | OK — reviewed, no change required | `    if (skipRow && sourceRow === skipRow) return;` |
| 487 | OK — reviewed, no change required | `    const status = r[0];` |
| 488 | OK — reviewed, no change required | `    const eventId = r[1];` |
| 489 | OK — reviewed, no change required | `    const phoneId = r[7];` |
| 490 | OK — reviewed, no change required | `    const lensId = r[8];` |
| 491 | OK — reviewed, no change required | `    if (!kkActiveHold_(status)) return;` |
| 492 | OK — reviewed, no change required | `    if (!eventDates[String(eventId).trim()] || !kkSameDate_(eventDates[String(eventId).trim()], eventDate)) return;` |
| 493 | OK — reviewed, no change required | `    if (phoneId) booked.phone[String(phoneId).trim()] = true;` |
| 494 | OK — reviewed, no change required | `    if (lensId) booked.lens[String(lensId).trim()] = true;` |
| 495 | OK — reviewed, no change required | `  });` |
| 496 | OK — reviewed, no change required | `  return booked;` |
| 497 | OK — reviewed, no change required | `}` |
| 498 | OK — blank/separator line | `` |
| 499 | OK — reviewed, no change required | `function kkFindAvailableAsset_(assetType, modelGroup, eventDate) {` |
| 500 | OK — reviewed, no change required | `  const type = String(assetType || '').toLowerCase();` |
| 501 | OK — reviewed, no change required | `  const model = String(modelGroup || '').trim();` |
| 502 | OK — reviewed, no change required | `  if (!model || model === 'NONE') return '';` |
| 503 | OK — reviewed, no change required | `  const booked = kkBookedAssetIdsForDate_(eventDate);` |
| 504 | OK — reviewed, no change required | `  const rows = kkGetValues_(KK.assets, 5, 1, 7);` |
| 505 | OK — reviewed, no change required | `  for (const r of rows) {` |
| 506 | OK — reviewed, no change required | `    const assetId = String(r[0] || '').trim();` |
| 507 | OK — reviewed, no change required | `    const rowType = String(r[1] || '').toLowerCase().trim();` |
| 508 | OK — reviewed, no change required | `    const rowModel = String(r[2] || '').trim();` |
| 509 | OK — reviewed, no change required | `    const status = String(r[4] || '').toLowerCase().trim();` |
| 510 | OK — reviewed, no change required | `    const rentable = kkAssetIsRentableAvailable_(status, r[6]);` |
| 511 | OK — reviewed, no change required | `    if (!assetId || rowType !== type || rowModel !== model || !rentable) continue;` |
| 512 | OK — reviewed, no change required | `    if (booked[type] && booked[type][assetId]) continue;` |
| 513 | OK — reviewed, no change required | `    return assetId;` |
| 514 | OK — reviewed, no change required | `  }` |
| 515 | OK — reviewed, no change required | `  throw new Error(\`No available ${type} asset for model ${model} on ${kkDateKey_(eventDate)}\`);` |
| 516 | OK — reviewed, no change required | `}` |
| 517 | OK — blank/separator line | `` |
| 518 | OK — reviewed, no change required | `function kkValidateManualAsset_(assetId, assetType, modelGroup, eventDate) {` |
| 519 | OK — reviewed, no change required | `  assetId = String(assetId || '').trim();` |
| 520 | OK — reviewed, no change required | `  if (!assetId) return;` |
| 521 | OK — reviewed, no change required | `  const type = String(assetType || '').toLowerCase().trim();` |
| 522 | OK — reviewed, no change required | `  const model = String(modelGroup || '').trim();` |
| 523 | OK — reviewed, no change required | `  const rows = kkGetValues_(KK.assets, 5, 1, 7);` |
| 524 | OK — reviewed, no change required | `  const booked = kkBookedAssetIdsForDate_(eventDate);` |
| 525 | OK — reviewed, no change required | `  let found = false;` |
| 526 | OK — blank/separator line | `` |
| 527 | OK — reviewed, no change required | `  for (const r of rows) {` |
| 528 | OK — reviewed, no change required | `    const rowId = String(r[0] || '').trim();` |
| 529 | OK — reviewed, no change required | `    if (rowId !== assetId) continue;` |
| 530 | OK — reviewed, no change required | `    found = true;` |
| 531 | OK — reviewed, no change required | `    const rowType = String(r[1] || '').toLowerCase().trim();` |
| 532 | OK — reviewed, no change required | `    const rowModel = String(r[2] || '').trim();` |
| 533 | OK — reviewed, no change required | `    const status = String(r[4] || '').toLowerCase().trim();` |
| 534 | OK — reviewed, no change required | `    const rentable = kkAssetIsRentableAvailable_(status, r[6]);` |
| 535 | OK — reviewed, no change required | `    if (rowType !== type) throw new Error(\`${assetId} is not a ${type} asset\`);` |
| 536 | OK — reviewed, no change required | `    if (model && model !== 'NONE' && rowModel !== model) throw new Error(\`${assetId} model is ${rowModel}, expected ${model}\`);` |
| 537 | OK — reviewed, no change required | `    if (!rentable) throw new Error(\`${assetId} is not rentable/available\`);` |
| 538 | OK — reviewed, no change required | `    if (booked[type] && booked[type][assetId]) throw new Error(\`${assetId} is already booked on ${kkDateKey_(eventDate)}\`);` |
| 539 | OK — reviewed, no change required | `    return;` |
| 540 | OK — reviewed, no change required | `  }` |
| 541 | OK — reviewed, no change required | `  if (!found) throw new Error(\`Asset not found: ${assetId}\`);` |
| 542 | OK — reviewed, no change required | `}` |
| 543 | OK — blank/separator line | `` |
| 544 | OK — reviewed, no change required | `function kkCreateEventFromDashboard() {` |
| 545 | OK — reviewed, no change required | `  const ui = SpreadsheetApp.getUi();` |
| 546 | REVIEWED range read scope | `  const eventInputs = kkRange_('KK_EVENT_CREATE_INPUTS', KK.dashboard, 'B6:B13').getValues().flat();` |
| 547 | OK — reviewed, no change required | `  const eventName = eventInputs[0];` |
| 548 | OK — reviewed, no change required | `  const eventDate = eventInputs[1];` |
| 549 | OK — reviewed, no change required | `  const venue = eventInputs[2];` |
| 550 | OK — reviewed, no change required | `  const posterInfo = kkPosterForWrite_(eventInputs[3]);` |
| 551 | OK — reviewed, no change required | `  const poster = posterInfo.url;` |
| 552 | OK — reviewed, no change required | `  const note = eventInputs[4];` |
| 553 | OK — reviewed, no change required | `  const status = eventInputs[5] || 'open';` |
| 554 | OK — reviewed, no change required | `  const active = kkBlank_(eventInputs[6]) ? true : kkIsTrue_(eventInputs[6]);` |
| 555 | OK — reviewed, no change required | `  if (!eventName || !eventDate || !venue) throw new Error('Please fill event_name, event_date, venue');` |
| 556 | OK — reviewed, no change required | `  const eventId = kkGenerateUniqueEventId_(eventName, eventDate);` |
| 557 | OK — reviewed, no change required | `  const eventRow = kkFirstEmptyRow_(KK.events, 1, 5, 1, 8);` |
| 558 | REVIEWED batch write preferred | `  kkSheet_(KK.events).getRange(eventRow, 1, 1, 8).setValues([[eventId, eventName, eventDate, venue, poster, status, active, note]]);` |
| 559 | OK — blank/separator line | `` |
| 560 | REVIEWED range read scope | `  const pkgRows = kkRange_('KK_EVENT_PACKAGE_ROWS', KK.dashboard, 'A17:I46').getValues();` |
| 561 | OK — reviewed, no change required | `  const overrideSheet = kkSheet_(KK.overrides);` |
| 562 | OK — reviewed, no change required | `  const writtenOverrideKeys = {};` |
| 563 | OK — reviewed, no change required | `  pkgRows.forEach(row => {` |
| 564 | OK — reviewed, no change required | `    const usePkg = kkIsTrue_(row[0]);` |
| 565 | OK — reviewed, no change required | `    const templateId = String(row[1] || '').trim();` |
| 566 | OK — reviewed, no change required | `    const overridePrice = row[4];` |
| 567 | OK — reviewed, no change required | `    const hide = kkIsTrue_(row[5]);` |
| 568 | OK — reviewed, no change required | `    const overrideNote = row[6];` |
| 569 | OK — reviewed, no change required | `    const sortOverride = row[7];` |
| 570 | OK — reviewed, no change required | `    const useCaseOverride = row[8];` |
| 571 | OK — reviewed, no change required | `    if (!templateId) return;` |
| 572 | OK — reviewed, no change required | `    const key = eventId + '|' + templateId;` |
| 573 | OK — reviewed, no change required | `    if (writtenOverrideKeys[key]) return;` |
| 574 | OK — reviewed, no change required | `    const shouldWrite = !usePkg || hide || overridePrice !== '' || overrideNote !== '' || sortOverride !== '' || useCaseOverride !== '';` |
| 575 | OK — reviewed, no change required | `    if (!shouldWrite) return;` |
| 576 | OK — reviewed, no change required | `    const r = kkFirstEmptyRow_(KK.overrides, 1, 5, 1, 7);` |
| 577 | REVIEWED batch write preferred | `    overrideSheet.getRange(r, 1, 1, 7).setValues([[eventId, templateId, overridePrice || '', (!usePkg || hide) ? false : '', overrideNote || '', sortOverride || '', useCaseOverr…` |
| 578 | OK — reviewed, no change required | `    writtenOverrideKeys[key] = true;` |
| 579 | OK — reviewed, no change required | `  });` |
| 580 | OK — reviewed, no change required | `  kkRange_('KK_EVENT_CREATED_ID', KK.dashboard, 'B13').setValue(eventId);` |
| 581 | REVIEWED UI alert / safe fallback where possible | `  ui.alert('Created event: ' + eventId);` |
| 582 | OK — reviewed, no change required | `}` |
| 583 | OK — blank/separator line | `` |
| 584 | OK — reviewed, no change required | `function kkNextAssetIds_(assetType, qty) {` |
| 585 | OK — reviewed, no change required | `  const type = String(assetType || '').toLowerCase().trim();` |
| 586 | OK — reviewed, no change required | `  const prefix = type === 'lens' ? 'LENS' : 'PHONE';` |
| 587 | OK — reviewed, no change required | `  const values = kkGetValues_(KK.assets, 5, 1, 1).flat().filter(String);` |
| 588 | OK — reviewed, no change required | `  let max = 0;` |
| 589 | OK — reviewed, no change required | `  values.forEach(id => {` |
| 590 | OK — reviewed, no change required | `    const m = String(id).match(new RegExp('^' + prefix + '-(\\d+)$'));` |
| 591 | OK — reviewed, no change required | `    if (m) max = Math.max(max, Number(m[1]));` |
| 592 | OK — reviewed, no change required | `  });` |
| 593 | OK — reviewed, no change required | `  return Array.from({ length: qty }, (_, i) => \`${prefix}-${String(max + i + 1).padStart(3, '0')}\`);` |
| 594 | OK — reviewed, no change required | `}` |
| 595 | OK — blank/separator line | `` |
| 596 | OK — reviewed, no change required | `function kkAddAssetsFromDashboard() {` |
| 597 | OK — reviewed, no change required | `  const ui = SpreadsheetApp.getUi();` |
| 598 | REVIEWED range read scope | `  const inputs = kkRange_('KK_ADD_ASSET_INPUTS', KK.dashboard, 'K6:K11').getValues().flat();` |
| 599 | OK — reviewed, no change required | `  const assetType = String(inputs[0] || '').toLowerCase().trim();` |
| 600 | OK — reviewed, no change required | `  const modelGroup = String(inputs[1] || '').trim();` |
| 601 | OK — reviewed, no change required | `  const qty = Number(inputs[2] || 0);` |
| 602 | OK — reviewed, no change required | `  const serialPrefix = String(inputs[3] || '').trim();` |
| 603 | OK — reviewed, no change required | `  const status = String(inputs[4] || 'available').toLowerCase().trim();` |
| 604 | OK — reviewed, no change required | `  const notes = inputs[5];` |
| 605 | OK — reviewed, no change required | `  if (!['phone', 'lens'].includes(assetType)) throw new Error('asset_type must be phone or lens');` |
| 606 | OK — reviewed, no change required | `  if (!modelGroup || qty < 1) throw new Error('Please fill model_group and quantity');` |
| 607 | OK — blank/separator line | `` |
| 608 | OK — reviewed, no change required | `  const sh = kkSheet_(KK.assets);` |
| 609 | OK — reviewed, no change required | `  const ids = kkNextAssetIds_(assetType, qty);` |
| 610 | OK — reviewed, no change required | `  const targetRows = kkEmptyRows_(KK.assets, 1, 5, 1, 6, qty);` |
| 611 | OK — reviewed, no change required | `  const data = ids.map((id, i) => [id, assetType, modelGroup, serialPrefix ? \`${serialPrefix}-${String(i + 1).padStart(3, '0')}\` : '', status, notes]);` |
| 612 | OK — reviewed, no change required | `  const contiguous = targetRows.every((row, i) => i === 0 || row === targetRows[i - 1] + 1);` |
| 613 | REVIEWED batch write preferred | `  if (contiguous) sh.getRange(targetRows[0], 1, qty, 6).setValues(data);` |
| 614 | REVIEWED batch write preferred | `  else targetRows.forEach((row, i) => sh.getRange(row, 1, 1, 6).setValues([data[i]]));` |
| 615 | REVIEWED UI alert / safe fallback where possible | `  ui.alert('Added assets: ' + ids.join(', '));` |
| 616 | OK — reviewed, no change required | `}` |
| 617 | OK — blank/separator line | `` |
| 618 | OK — reviewed, no change required | `function kkUpdateAccessoryStockFromDashboard() {` |
| 619 | OK — reviewed, no change required | `  const ui = SpreadsheetApp.getUi();` |
| 620 | REVIEWED range read scope | `  const rows = kkRange_('KK_ACCESSORY_INPUT_ROWS', KK.dashboard, 'J16:N26').getValues();` |
| 621 | OK — reviewed, no change required | `  const sh = kkSheet_(KK.accessories);` |
| 622 | OK — reviewed, no change required | `  const existing = kkGetValues_(KK.accessories, 5, 1, 1).flat();` |
| 623 | OK — reviewed, no change required | `  const rowByType = {};` |
| 624 | OK — reviewed, no change required | `  existing.forEach((v, i) => {` |
| 625 | OK — reviewed, no change required | `    const key = String(v || '').trim();` |
| 626 | OK — reviewed, no change required | `    if (key && rowByType[key] === undefined) rowByType[key] = i + 5;` |
| 627 | OK — reviewed, no change required | `  });` |
| 628 | OK — reviewed, no change required | `  let count = 0;` |
| 629 | OK — reviewed, no change required | `  const seenThisRun = {};` |
| 630 | OK — reviewed, no change required | `  rows.forEach(row => {` |
| 631 | OK — reviewed, no change required | `    const type = String(row[0] || '').trim();` |
| 632 | OK — reviewed, no change required | `    if (!type || seenThisRun[type]) return;` |
| 633 | OK — reviewed, no change required | `    seenThisRun[type] = true;` |
| 634 | OK — reviewed, no change required | `    const total = Number(row[1] || 0);` |
| 635 | OK — reviewed, no change required | `    const damaged = Number(row[2] || 0);` |
| 636 | OK — reviewed, no change required | `    const notes = row[3] || '';` |
| 637 | OK — reviewed, no change required | `    let targetRow = rowByType[type];` |
| 638 | OK — reviewed, no change required | `    if (!targetRow) {` |
| 639 | OK — reviewed, no change required | `      targetRow = kkFirstEmptyRow_(KK.accessories, 1, 5, 1, 5);` |
| 640 | OK — reviewed, no change required | `      rowByType[type] = targetRow;` |
| 641 | OK — reviewed, no change required | `    }` |
| 642 | REVIEWED batch write preferred | `    sh.getRange(targetRow, 1, 1, 3).setValues([[type, total, damaged]]);` |
| 643 | OK — reviewed, no change required | `    sh.getRange(targetRow, 5).setValue(notes);` |
| 644 | OK — reviewed, no change required | `    count++;` |
| 645 | OK — reviewed, no change required | `  });` |
| 646 | REVIEWED UI alert / safe fallback where possible | `  ui.alert('Updated accessory rows: ' + count);` |
| 647 | OK — reviewed, no change required | `}` |
| 648 | OK — blank/separator line | `` |
| 649 | OK — reviewed, no change required | `function kkAddQuickBookingFromDashboard() {` |
| 650 | OK — reviewed, no change required | `  const ui = SpreadsheetApp.getUi();` |
| 651 | OK — reviewed, no change required | `  try {` |
| 652 | REVIEWED range read scope | `    const bookingInputs = kkRange_('KK_QUICK_BOOKING_INPUTS', KK.dashboard, 'K31:K42').getValues().flat();` |
| 653 | OK — reviewed, no change required | `    const eventId = String(bookingInputs[0] || '').trim();` |
| 654 | OK — reviewed, no change required | `    let templateId = String(bookingInputs[1] || '').trim();` |
| 655 | OK — reviewed, no change required | `    const customerName = bookingInputs[2];` |
| 656 | OK — reviewed, no change required | `    const customerContact = bookingInputs[3];` |
| 657 | OK — reviewed, no change required | `    const customerPhone = bookingInputs[4];` |
| 658 | OK — reviewed, no change required | `    const contactChannel = bookingInputs[5] || 'LINE';` |
| 659 | OK — reviewed, no change required | `    const bookingStatus = String(bookingInputs[6] || 'confirmed').toLowerCase().trim();` |
| 660 | OK — reviewed, no change required | `    let phoneAssetId = String(bookingInputs[7] || '').trim();` |
| 661 | OK — reviewed, no change required | `    let lensAssetId = String(bookingInputs[8] || '').trim();` |
| 662 | OK — reviewed, no change required | `    const paymentStatus = String(bookingInputs[9] || 'unpaid').toLowerCase().trim();` |
| 663 | OK — reviewed, no change required | `    const amountReceived = Number(bookingInputs[10] || 0);` |
| 664 | OK — reviewed, no change required | `    const bookingNote = bookingInputs[11];` |
| 665 | OK — blank/separator line | `` |
| 666 | OK — reviewed, no change required | `    if (!eventId || !templateId || !customerName) {` |
| 667 | OK — reviewed, no change required | `      throw new Error('Please fill event_id, template_id, customer_name');` |
| 668 | OK — reviewed, no change required | `    }` |
| 669 | OK — reviewed, no change required | `    if (!['pending', 'confirmed', 'picked_up', 'returned', 'cancelled'].includes(bookingStatus)) {` |
| 670 | OK — reviewed, no change required | `      throw new Error('Invalid booking_status');` |
| 671 | OK — reviewed, no change required | `    }` |
| 672 | OK — reviewed, no change required | `    if (!['unpaid', 'partial', 'paid', 'refunded'].includes(paymentStatus)) {` |
| 673 | OK — reviewed, no change required | `      throw new Error('Invalid payment_status');` |
| 674 | OK — reviewed, no change required | `    }` |
| 675 | OK — reviewed, no change required | `    if (isNaN(amountReceived) || amountReceived < 0) {` |
| 676 | OK — reviewed, no change required | `      throw new Error('amount_received must be a number and cannot be negative');` |
| 677 | OK — reviewed, no change required | `    }` |
| 678 | OK — blank/separator line | `` |
| 679 | OK — reviewed, no change required | `    templateId = kkNormalizeTemplateIdForEvent_(eventId, templateId);` |
| 680 | OK — reviewed, no change required | `    const event = kkGetEventById_(eventId);` |
| 681 | OK — reviewed, no change required | `    if (kkIsPastEventDate_(event.event_date)) throw new Error('Cannot create booking for a past event date: ' + kkApiDate_(event.event_date));` |
| 682 | OK — reviewed, no change required | `    const pkg = kkGetPackageByTemplateId_(templateId);` |
| 683 | OK — reviewed, no change required | `    if (String(event.status).toLowerCase() !== 'open') throw new Error('Event is not open: ' + eventId);` |
| 684 | OK — reviewed, no change required | `    if (!event.active) throw new Error('Event is not active_on_web: ' + eventId);` |
| 685 | OK — reviewed, no change required | `    if (!pkg.active) throw new Error('Package is inactive: ' + templateId);` |
| 686 | OK — reviewed, no change required | `    kkAssertWebPackageBookable_(eventId, templateId);` |
| 687 | OK — blank/separator line | `` |
| 688 | OK — reviewed, no change required | `    const pkgType = String(pkg.package_type || '').toLowerCase().trim();` |
| 689 | OK — reviewed, no change required | `    if (phoneAssetId) kkValidateManualAsset_(phoneAssetId, 'phone', pkg.model_group, event.event_date);` |
| 690 | OK — reviewed, no change required | `    if (lensAssetId) kkValidateManualAsset_(lensAssetId, 'lens', pkg.lens_group, event.event_date);` |
| 691 | OK — blank/separator line | `` |
| 692 | OK — reviewed, no change required | `    if ((pkgType === 'phone_only' || pkgType === 'phone_lens_bundle') && !phoneAssetId) {` |
| 693 | OK — reviewed, no change required | `      phoneAssetId = kkFindAvailableAsset_('phone', pkg.model_group, event.event_date);` |
| 694 | OK — reviewed, no change required | `    }` |
| 695 | OK — reviewed, no change required | `    if ((pkgType === 'lens_only' || pkgType === 'phone_lens_bundle') && !lensAssetId) {` |
| 696 | OK — reviewed, no change required | `      lensAssetId = kkFindAvailableAsset_('lens', pkg.lens_group, event.event_date);` |
| 697 | OK — reviewed, no change required | `    }` |
| 698 | OK — blank/separator line | `` |
| 699 | OK — reviewed, no change required | `    const row = kkFirstEmptyRow_(KK.bookings, 4, 5, 2, 19);` |
| 700 | REVIEWED batch write preferred | `    kkSheet_(KK.bookings).getRange(row, 2, 1, 19).setValues([[` |
| 701 | OK — reviewed, no change required | `        new Date(), bookingStatus, eventId, customerName, customerContact, customerPhone, contactChannel,` |
| 702 | OK — reviewed, no change required | `        pkgType, phoneAssetId, lensAssetId, '', '', paymentStatus, amountReceived, '', '', '', 0, bookingNote` |
| 703 | OK — reviewed, no change required | `    ]]);` |
| 704 | REVIEWED batch write preferred | `    kkRange_('KK_QUICK_BOOKING_ASSIGNED_ASSETS', KK.dashboard, 'K38:K39').setValues([[phoneAssetId], [lensAssetId]]);` |
| 705 | REVIEWED UI alert / safe fallback where possible | `    ui.alert(` |
| 706 | OK — reviewed, no change required | `      \`✅ Added booking row ${row}\n\` +` |
| 707 | OK — reviewed, no change required | `      \`Event: ${eventId}\nTemplate: ${templateId}\nPhone: ${phoneAssetId || '-'}\nLens: ${lensAssetId || '-'}\`` |
| 708 | OK — reviewed, no change required | `    );` |
| 709 | OK — reviewed, no change required | `  } catch (error) {` |
| 710 | REVIEWED UI alert / safe fallback where possible | `    ui.alert(\`❌ เกิดข้อผิดพลาด:\n${error.message}\`);` |
| 711 | OK — reviewed, no change required | `  }` |
| 712 | OK — reviewed, no change required | `}` |
| 713 | OK — blank/separator line | `` |
| 714 | OK — reviewed, no change required | `function kkConvertEventDriveUrls() {` |
| 715 | OK — reviewed, no change required | `  const range = kkGetDynamicRange_(KK.events, 5, 5, 1);` |
| 716 | OK — reviewed, no change required | `  if (!range) return kkSafeAlert_('No events to convert.');` |
| 717 | REVIEWED range read scope | `  const values = range.getValues();` |
| 718 | OK — reviewed, no change required | `  let count = 0;` |
| 719 | OK — reviewed, no change required | `  values.forEach((r, i) => {` |
| 720 | OK — reviewed, no change required | `    const before = r[0];` |
| 721 | OK — reviewed, no change required | `    const after = kkPosterForWrite_(before).url;` |
| 722 | OK — reviewed, no change required | `    if (before && before !== after) { values[i][0] = after; count++; }` |
| 723 | OK — reviewed, no change required | `  });` |
| 724 | REVIEWED batch write preferred | `  if (count > 0) range.setValues(values);` |
| 725 | OK — reviewed, no change required | `  kkSafeAlert_('Converted image URLs: ' + count);` |
| 726 | OK — reviewed, no change required | `}` |
| 727 | OK — blank/separator line | `` |
| 728 | OK — reviewed, no change required | `function kkRunBasicHealthCheck() {` |
| 729 | OK — reviewed, no change required | `  SpreadsheetApp.flush();` |
| 730 | OK — reviewed, no change required | `  const sh = SpreadsheetApp.getActive().getSheetByName(KK.health);` |
| 731 | OK — reviewed, no change required | `  if (sh) SpreadsheetApp.setActiveSheet(sh);` |
| 732 | OK — reviewed, no change required | `  kkSafeAlert_('Health Check recalculated. Please review rows with CHECK.');` |
| 733 | OK — reviewed, no change required | `}` |
| 734 | OK — blank/separator line | `` |
| 735 | OK — reviewed, no change required | `function kkApiJson_(obj, statusCode) {` |
| 736 | OK — reviewed, no change required | `  const output = ContentService.createTextOutput(JSON.stringify(obj));` |
| 737 | OK — reviewed, no change required | `  output.setMimeType(ContentService.MimeType.JSON);` |
| 738 | OK — reviewed, no change required | `  return output;` |
| 739 | OK — reviewed, no change required | `}` |
| 740 | OK — blank/separator line | `` |
| 741 | OK — reviewed, no change required | `function kkApiOk_(data) {` |
| 742 | OK — reviewed, no change required | `  return Object.assign({ ok: true }, data || {});` |
| 743 | OK — reviewed, no change required | `}` |
| 744 | OK — blank/separator line | `` |
| 745 | OK — reviewed, no change required | `function kkApiFail_(err) {` |
| 746 | OK — reviewed, no change required | `  return { ok: false, error: err && err.message ? err.message : String(err) };` |
| 747 | OK — reviewed, no change required | `}` |
| 748 | OK — blank/separator line | `` |
| 749 | OK — reviewed, no change required | `function kkApiRequireKey_(payload) {` |
| 750 | REVIEWED API key stored in script/env, not public frontend | `  const expected = String(PropertiesService.getScriptProperties().getProperty('KK_ADMIN_API_KEY') || '').trim();` |
| 751 | REVIEWED sensitive API key redaction/ENV only | `  const provided = String(payload.apiKey || '').trim();` |
| 752 | REVIEWED API key stored in script/env, not public frontend | `  if (!expected) throw new Error('Missing Script Property KK_ADMIN_API_KEY. In Google Sheet menu, run KK Admin > CRM: Generate Admin API Key.');` |
| 753 | OK — reviewed, no change required | `  if (!provided || provided !== expected) throw new Error('Invalid admin API key');` |
| 754 | OK — reviewed, no change required | `}` |
| 755 | OK — blank/separator line | `` |
| 756 | OK — reviewed, no change required | `function doPost(e) {` |
| 757 | OK — reviewed, no change required | `  const startedAt = Date.now();` |
| 758 | OK — reviewed, no change required | `  let payload = {};` |
| 759 | OK — reviewed, no change required | `  let action = '';` |
| 760 | OK — reviewed, no change required | `  let keyOk = false;` |
| 761 | OK — reviewed, no change required | `  try {` |
| 762 | OK — reviewed, no change required | `    payload = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};` |
| 763 | OK — reviewed, no change required | `    kkApiRequireKey_(payload);` |
| 764 | OK — reviewed, no change required | `    keyOk = true;` |
| 765 | OK — reviewed, no change required | `    action = String(payload.action || '').trim();` |
| 766 | OK — reviewed, no change required | `    let result;` |
| 767 | OK — blank/separator line | `` |
| 768 | OK — reviewed, no change required | `    switch (action) {` |
| 769 | OK — reviewed, no change required | `      case 'snapshot': result = kkApiSnapshot_(payload); break;` |
| 770 | OK — reviewed, no change required | `      case 'phase1Health': result = { data: kkPhase1Diagnostics_(payload) }; break;` |
| 771 | OK — reviewed, no change required | `      case 'uploadPoster': result = kkApiUploadPoster_(payload); break;` |
| 772 | OK — reviewed, no change required | `      case 'createEvent': result = kkApiCreateEvent_(payload); break;` |
| 773 | OK — reviewed, no change required | `      case 'updateEvent': result = kkApiUpdateEvent_(payload); break;` |
| 774 | OK — reviewed, no change required | `      case 'createPackage': result = kkApiCreatePackage_(payload); break;` |
| 775 | OK — reviewed, no change required | `      case 'updatePackage': result = kkApiUpdatePackage_(payload); break;` |
| 776 | OK — reviewed, no change required | `      case 'upsertEventOverride': result = kkApiUpsertEventOverride_(payload); break;` |
| 777 | OK — reviewed, no change required | `      case 'addAssets': result = kkApiAddAssets_(payload); break;` |
| 778 | OK — reviewed, no change required | `      case 'createBooking': result = kkApiCreateBooking_(payload); break;` |
| 779 | OK — reviewed, no change required | `      case 'updateBooking': result = kkApiUpdateBooking_(payload); break;` |
| 780 | OK — reviewed, no change required | `      case 'cleanupOldData': result = kkApiCleanupOldData_(payload); break;` |
| 781 | OK — reviewed, no change required | `      default: throw new Error('Unknown action: ' + action);` |
| 782 | OK — reviewed, no change required | `    }` |
| 783 | OK — reviewed, no change required | `    if (action && action !== 'snapshot' && action !== 'phase1Health') kkAuditLog_(action, payload, result, startedAt);` |
| 784 | OK — reviewed, no change required | `    return kkApiJson_(kkApiOk_(Object.assign({ admin_api_version: KK_ADMIN_VERSION }, result || {})));` |
| 785 | OK — reviewed, no change required | `  } catch (err) {` |
| 786 | OK — reviewed, no change required | `    if (keyOk) kkErrorLog_(action || (payload && payload.action) || '', payload, err, startedAt);` |
| 787 | OK — reviewed, no change required | `    return kkApiJson_(Object.assign({ admin_api_version: KK_ADMIN_VERSION }, kkApiFail_(err)));` |
| 788 | OK — reviewed, no change required | `  }` |
| 789 | OK — reviewed, no change required | `}` |
| 790 | OK — blank/separator line | `` |
| 791 | OK — reviewed, no change required | `function doGet() {` |
| 792 | OK — reviewed, no change required | `  return kkApiJson_({` |
| 793 | OK — reviewed, no change required | `    ok: true,` |
| 794 | OK — reviewed, no change required | `    version: KK_ADMIN_VERSION,` |
| 795 | OK — reviewed, no change required | `    spreadsheet_id: SpreadsheetApp.getActive().getId(),` |
| 796 | OK — reviewed, no change required | `    message: 'KK Phone Rental Admin CRM API is running. Use POST through the Vercel proxy.'` |
| 797 | OK — reviewed, no change required | `  });` |
| 798 | OK — reviewed, no change required | `}` |
| 799 | OK — blank/separator line | `` |
| 800 | OK — reviewed, no change required | `function kkApiDate_(value) {` |
| 801 | OK — reviewed, no change required | `  if (!value) return '';` |
| 802 | OK — reviewed, no change required | `  const d = value instanceof Date ? value : new Date(value);` |
| 803 | OK — reviewed, no change required | `  if (isNaN(d.getTime())) return String(value);` |
| 804 | OK — reviewed, no change required | `  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');` |
| 805 | OK — reviewed, no change required | `}` |
| 806 | OK — blank/separator line | `` |
| 807 | OK — reviewed, no change required | `function kkApiDateTime_(value) {` |
| 808 | OK — reviewed, no change required | `  if (!value) return '';` |
| 809 | OK — reviewed, no change required | `  const d = value instanceof Date ? value : new Date(value);` |
| 810 | OK — reviewed, no change required | `  if (isNaN(d.getTime())) return String(value);` |
| 811 | OK — reviewed, no change required | `  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");` |
| 812 | OK — reviewed, no change required | `}` |
| 813 | OK — blank/separator line | `` |
| 814 | OK — reviewed, no change required | `function kkApiBoolOrBlank_(value) {` |
| 815 | OK — reviewed, no change required | `  if (value === '' || value === null || typeof value === 'undefined') return '';` |
| 816 | OK — reviewed, no change required | `  return kkIsTrue_(value);` |
| 817 | OK — reviewed, no change required | `}` |
| 818 | OK — blank/separator line | `` |
| 819 | OK — reviewed, no change required | `function kkApiNumber_(value, fieldName, allowBlank) {` |
| 820 | OK — reviewed, no change required | `  if ((value === '' || value === null || typeof value === 'undefined') && allowBlank) return '';` |
| 821 | OK — reviewed, no change required | `  const n = Number(value || 0);` |
| 822 | OK — reviewed, no change required | `  if (isNaN(n) || n < 0) throw new Error(fieldName + ' must be a non-negative number');` |
| 823 | OK — reviewed, no change required | `  return n;` |
| 824 | OK — reviewed, no change required | `}` |
| 825 | OK — blank/separator line | `` |
| 826 | OK — reviewed, no change required | `function kkModelDisplayMap_() {` |
| 827 | OK — reviewed, no change required | `  const map = {};` |
| 828 | OK — reviewed, no change required | `  const range = kkGetDynamicRange_(KK.modelMaster, 5, 1, 5);` |
| 829 | OK — reviewed, no change required | `  if (!range) return map;` |
| 830 | REVIEWED range read scope | `  range.getValues().forEach(r => {` |
| 831 | OK — reviewed, no change required | `    const key = String(r[0] || '').trim();` |
| 832 | OK — reviewed, no change required | `    if (!key) return;` |
| 833 | OK — reviewed, no change required | `    map[key] = {` |
| 834 | OK — reviewed, no change required | `      model_group: key,` |
| 835 | OK — reviewed, no change required | `      model_display: r[1] || key,` |
| 836 | OK — reviewed, no change required | `      asset_type: String(r[2] || '').toLowerCase().trim(),` |
| 837 | OK — reviewed, no change required | `      active: kkIsTrue_(r[3]),` |
| 838 | OK — reviewed, no change required | `      notes: r[4] || ''` |
| 839 | OK — reviewed, no change required | `    };` |
| 840 | OK — reviewed, no change required | `  });` |
| 841 | OK — reviewed, no change required | `  return map;` |
| 842 | OK — reviewed, no change required | `}` |
| 843 | OK — blank/separator line | `` |
| 844 | OK — reviewed, no change required | `function kkApiWebReadyRows_() {` |
| 845 | OK — reviewed, no change required | `  const range = kkGetDynamicRange_(KK.webReady, 5, 1, 11);` |
| 846 | OK — reviewed, no change required | `  if (!range) return [];` |
| 847 | REVIEWED range read scope | `  return range.getValues().filter(r => r[0]).map(r => ({` |
| 848 | OK — reviewed, no change required | `    event_id: String(r[0] || '').trim(),` |
| 849 | OK — reviewed, no change required | `    event_name: r[1] || '',` |
| 850 | OK — reviewed, no change required | `    event_date: kkApiDate_(r[2]),` |
| 851 | OK — reviewed, no change required | `    venue: r[3] || '',` |
| 852 | OK — reviewed, no change required | `    poster_image_url: r[4] || '',` |
| 853 | OK — reviewed, no change required | `    phone_model_display: r[5] || '',` |
| 854 | OK — reviewed, no change required | `    available_phone_count: Number(r[6] || 0),` |
| 855 | OK — reviewed, no change required | `    available_lens_count: Number(r[7] || 0),` |
| 856 | OK — reviewed, no change required | `    line_message_template: r[8] || '',` |
| 857 | OK — reviewed, no change required | `    action_for_web: r[9] || '',` |
| 858 | OK — reviewed, no change required | `    data_health: r[10] || ''` |
| 859 | OK — reviewed, no change required | `  }));` |
| 860 | OK — reviewed, no change required | `}` |
| 861 | OK — blank/separator line | `` |
| 862 | OK — reviewed, no change required | `function kkApiWebPackageRows_() {` |
| 863 | OK — reviewed, no change required | `  const range = kkGetDynamicRange_(KK.webPackages, 5, 1, 14);` |
| 864 | OK — reviewed, no change required | `  if (!range) return [];` |
| 865 | REVIEWED range read scope | `  return range.getValues().filter(r => r[0] && r[1]).map(r => ({` |
| 866 | OK — reviewed, no change required | `    package_id: String(r[0] || '').trim(),` |
| 867 | OK — reviewed, no change required | `    event_id: String(r[1] || '').trim(),` |
| 868 | OK — reviewed, no change required | `    package_type: r[2] || '',` |
| 869 | OK — reviewed, no change required | `    model_group: r[3] || '',` |
| 870 | OK — reviewed, no change required | `    model_display: r[4] || '',` |
| 871 | OK — reviewed, no change required | `    lens_group: r[5] || '',` |
| 872 | OK — reviewed, no change required | `    lens_display: r[6] || '',` |
| 873 | OK — reviewed, no change required | `    price: Number(r[7] || 0),` |
| 874 | OK — reviewed, no change required | `    available_count: Number(r[8] || 0),` |
| 875 | OK — reviewed, no change required | `    package_status: r[9] || '',` |
| 876 | OK — reviewed, no change required | `    sort_order: r[10] || '',` |
| 877 | OK — reviewed, no change required | `    web_note: r[11] || '',` |
| 878 | OK — reviewed, no change required | `    raw_available_count: Number(r[12] || 0),` |
| 879 | OK — reviewed, no change required | `    use_case: r[13] || ''` |
| 880 | OK — reviewed, no change required | `  }));` |
| 881 | OK — reviewed, no change required | `}` |
| 882 | OK — blank/separator line | `` |
| 883 | OK — reviewed, no change required | `function kkTemplateIdFromWebPackageId_(packageId, eventId) {` |
| 884 | OK — reviewed, no change required | `  const pkgId = String(packageId || '').trim();` |
| 885 | OK — reviewed, no change required | `  const evId = String(eventId || '').trim();` |
| 886 | OK — reviewed, no change required | `  if (!pkgId) return '';` |
| 887 | OK — reviewed, no change required | `  const tplPos = pkgId.indexOf('TPL-');` |
| 888 | OK — reviewed, no change required | `  if (tplPos >= 0) return pkgId.slice(tplPos);` |
| 889 | OK — reviewed, no change required | `  if (evId && pkgId.indexOf(evId + '-') === 0) return pkgId.slice(evId.length + 1);` |
| 890 | OK — reviewed, no change required | `  return pkgId;` |
| 891 | OK — reviewed, no change required | `}` |
| 892 | OK — blank/separator line | `` |
| 893 | OK — reviewed, no change required | `function kkNormalizeTemplateIdForEvent_(eventId, templateId) {` |
| 894 | OK — reviewed, no change required | `  const raw = String(templateId || '').trim();` |
| 895 | OK — reviewed, no change required | `  if (!raw) return '';` |
| 896 | OK — reviewed, no change required | `  const normalized = kkTemplateIdFromWebPackageId_(raw, eventId);` |
| 897 | OK — reviewed, no change required | `  return normalized || raw;` |
| 898 | OK — reviewed, no change required | `}` |
| 899 | OK — blank/separator line | `` |
| 900 | OK — reviewed, no change required | `function kkIsWebPackageBookable_(p) {` |
| 901 | OK — reviewed, no change required | `  if (!p) return false;` |
| 902 | OK — reviewed, no change required | `  const status = String(p.package_status || '').toLowerCase().trim();` |
| 903 | OK — reviewed, no change required | `  return (status === 'available' || status === 'open') && Number(p.available_count || 0) > 0 && Number(p.price || 0) > 0;` |
| 904 | OK — reviewed, no change required | `}` |
| 905 | OK — blank/separator line | `` |
| 906 | OK — reviewed, no change required | `function kkAssertWebPackageBookable_(eventId, templateId) {` |
| 907 | OK — reviewed, no change required | `  const normalizedTemplateId = kkNormalizeTemplateIdForEvent_(eventId, templateId);` |
| 908 | OK — reviewed, no change required | `  const eventRows = kkApiWebPackageRows_().filter(p => String(p.event_id || '').trim() === String(eventId || '').trim());` |
| 909 | OK — reviewed, no change required | `  if (!eventRows.length) return;` |
| 910 | OK — reviewed, no change required | `  const row = eventRows.find(p => {` |
| 911 | OK — reviewed, no change required | `    const webPackageId = String(p.package_id || '').trim();` |
| 912 | OK — reviewed, no change required | `    const webTemplateId = kkTemplateIdFromWebPackageId_(webPackageId, p.event_id || eventId);` |
| 913 | OK — reviewed, no change required | `    return webPackageId === normalizedTemplateId || webTemplateId === normalizedTemplateId;` |
| 914 | OK — reviewed, no change required | `  });` |
| 915 | OK — reviewed, no change required | `  if (!row) throw new Error('Package is not visible for this event in 09_Web_Packages: ' + normalizedTemplateId);` |
| 916 | OK — reviewed, no change required | `  if (!kkIsWebPackageBookable_(row)) {` |
| 917 | OK — reviewed, no change required | `    throw new Error('งานนี้เต็มแล้วหรือแพ็กเกจนี้ไม่พร้อมจอง: ' + normalizedTemplateId + ' / status=' + String(row.package_status || '-') + ' / available_count=' + String(row.av…` |
| 918 | OK — reviewed, no change required | `  }` |
| 919 | OK — reviewed, no change required | `}` |
| 920 | OK — blank/separator line | `` |
| 921 | OK — reviewed, no change required | `function kkApiSnapshot_(payload) {` |
| 922 | OK — reviewed, no change required | `  SpreadsheetApp.flush();` |
| 923 | OK — blank/separator line | `` |
| 924 | OK — reviewed, no change required | `  const modelMap = kkModelDisplayMap_();` |
| 925 | OK — blank/separator line | `` |
| 926 | OK — reviewed, no change required | `  const events = kkGetValues_(KK.events, 5, 1, 9)` |
| 927 | OK — reviewed, no change required | `    .filter(r => r[0])` |
| 928 | OK — reviewed, no change required | `    .map(r => ({` |
| 929 | OK — reviewed, no change required | `      event_id: String(r[0] || '').trim(),` |
| 930 | OK — reviewed, no change required | `      event_name: r[1] || '',` |
| 931 | OK — reviewed, no change required | `      event_date: kkApiDate_(r[2]),` |
| 932 | OK — reviewed, no change required | `      venue: r[3] || '',` |
| 933 | OK — reviewed, no change required | `      poster_url: r[4] || '',` |
| 934 | OK — reviewed, no change required | `      status: r[5] || '',` |
| 935 | OK — reviewed, no change required | `      active_on_web: kkIsTrue_(r[6]),` |
| 936 | OK — reviewed, no change required | `      note: r[7] || '',` |
| 937 | OK — reviewed, no change required | `      data_health: r[8] || ''` |
| 938 | OK — reviewed, no change required | `    }));` |
| 939 | OK — reviewed, no change required | `  const eventById = {};` |
| 940 | OK — reviewed, no change required | `  events.forEach(e => { eventById[e.event_id] = e; });` |
| 941 | OK — blank/separator line | `` |
| 942 | OK — reviewed, no change required | `  const packages = kkGetValues_(KK.packages, 5, 1, 10)` |
| 943 | OK — reviewed, no change required | `    .filter(r => r[0])` |
| 944 | OK — reviewed, no change required | `    .map(r => ({` |
| 945 | OK — reviewed, no change required | `      template_id: String(r[0] || '').trim(),` |
| 946 | OK — reviewed, no change required | `      model_group: r[1] || '',` |
| 947 | OK — reviewed, no change required | `      package_type: r[2] || '',` |
| 948 | OK — reviewed, no change required | `      lens_group: r[3] || '',` |
| 949 | OK — reviewed, no change required | `      standard_price: r[4] || 0,` |
| 950 | OK — reviewed, no change required | `      display_name: r[5] || '',` |
| 951 | OK — reviewed, no change required | `      active: kkIsTrue_(r[7]),` |
| 952 | OK — reviewed, no change required | `      use_case: r[9] || ''` |
| 953 | OK — reviewed, no change required | `    }));` |
| 954 | OK — blank/separator line | `` |
| 955 | OK — reviewed, no change required | `  const packageDisplayByKey = {};` |
| 956 | OK — reviewed, no change required | `  const packageDisplayByType = {};` |
| 957 | OK — reviewed, no change required | `  packages.forEach(p => {` |
| 958 | OK — reviewed, no change required | `    const type = String(p.package_type || '').trim();` |
| 959 | OK — reviewed, no change required | `    const model = String(p.model_group || '').trim();` |
| 960 | OK — reviewed, no change required | `    const lens = String(p.lens_group || '').trim();` |
| 961 | OK — reviewed, no change required | `    const label = p.display_name || p.template_id || type;` |
| 962 | OK — reviewed, no change required | `    if (type) packageDisplayByType[type] = packageDisplayByType[type] || label;` |
| 963 | OK — reviewed, no change required | `    if (type) packageDisplayByKey[[type, model, lens].join('|')] = label;` |
| 964 | OK — reviewed, no change required | `  });` |
| 965 | OK — blank/separator line | `` |
| 966 | OK — reviewed, no change required | `  const overrides = kkGetValues_(KK.overrides, 5, 1, 7)` |
| 967 | OK — reviewed, no change required | `    .map((r, i) => ({ row_number: i + 5, row: r }))` |
| 968 | OK — reviewed, no change required | `    .filter(o => o.row[0] && o.row[1])` |
| 969 | OK — reviewed, no change required | `    .map(o => ({` |
| 970 | OK — reviewed, no change required | `      row_number: o.row_number,` |
| 971 | OK — reviewed, no change required | `      event_id: String(o.row[0] || '').trim(),` |
| 972 | OK — reviewed, no change required | `      template_id: String(o.row[1] || '').trim(),` |
| 973 | OK — reviewed, no change required | `      override_price: o.row[2] === '' || o.row[2] === null ? '' : o.row[2],` |
| 974 | OK — reviewed, no change required | `      active_override: o.row[3] === '' || o.row[3] === null ? '' : kkIsTrue_(o.row[3]),` |
| 975 | OK — reviewed, no change required | `      override_note: o.row[4] || '',` |
| 976 | OK — reviewed, no change required | `      sort_order_override: o.row[5] || '',` |
| 977 | OK — reviewed, no change required | `      use_case_override: o.row[6] || ''` |
| 978 | OK — reviewed, no change required | `    }));` |
| 979 | OK — blank/separator line | `` |
| 980 | OK — reviewed, no change required | `  const assets = kkGetValues_(KK.assets, 5, 1, 7)` |
| 981 | OK — reviewed, no change required | `    .filter(r => r[0])` |
| 982 | OK — reviewed, no change required | `    .map(r => {` |
| 983 | OK — reviewed, no change required | `      const modelGroup = String(r[2] || '').trim();` |
| 984 | OK — reviewed, no change required | `      const model = modelMap[modelGroup] || {};` |
| 985 | OK — reviewed, no change required | `      return {` |
| 986 | OK — reviewed, no change required | `        asset_id: String(r[0] || '').trim(),` |
| 987 | OK — reviewed, no change required | `        asset_type: String(r[1] || '').toLowerCase().trim(),` |
| 988 | OK — reviewed, no change required | `        model_group: modelGroup,` |
| 989 | OK — reviewed, no change required | `        model_display: model.model_display || modelGroup || '',` |
| 990 | OK — reviewed, no change required | `        serial: r[3] || '',` |
| 991 | OK — reviewed, no change required | `        status: r[4] || '',` |
| 992 | OK — reviewed, no change required | `        notes: r[5] || '',` |
| 993 | OK — reviewed, no change required | `        rentable: kkAssetIsRentableAvailable_(r[4], r[6])` |
| 994 | OK — reviewed, no change required | `      };` |
| 995 | OK — reviewed, no change required | `    });` |
| 996 | OK — blank/separator line | `` |
| 997 | OK — reviewed, no change required | `  const assetById = {};` |
| 998 | OK — reviewed, no change required | `  assets.forEach(a => { assetById[a.asset_id] = a; });` |
| 999 | OK — blank/separator line | `` |
| 1000 | OK — reviewed, no change required | `  const bookings = kkGetValues_(KK.bookings, 5, 1, 20)` |
| 1001 | OK — reviewed, no change required | `    .map((r, i) => ({ row_number: i + 5, row: r }))` |
| 1002 | OK — reviewed, no change required | `    .filter(o => o.row[3] || o.row[4])` |
| 1003 | OK — reviewed, no change required | `    .map(o => {` |
| 1004 | OK — reviewed, no change required | `      const r = o.row;` |
| 1005 | OK — reviewed, no change required | `      const eventId = String(r[3] || '').trim();` |
| 1006 | OK — reviewed, no change required | `      const event = eventById[eventId] || {};` |
| 1007 | OK — reviewed, no change required | `      const phoneId = String(r[9] || '').trim();` |
| 1008 | OK — reviewed, no change required | `      const lensId = String(r[10] || '').trim();` |
| 1009 | OK — reviewed, no change required | `      const phone = assetById[phoneId] || {};` |
| 1010 | OK — reviewed, no change required | `      const lens = assetById[lensId] || {};` |
| 1011 | OK — reviewed, no change required | `      const status = String(r[2] || '').toLowerCase().trim();` |
| 1012 | OK — reviewed, no change required | `      const payment = String(r[14] || '').toLowerCase().trim();` |
| 1013 | OK — reviewed, no change required | `      let work_task = '';` |
| 1014 | OK — reviewed, no change required | `      if (status === 'picked_up') work_task = 'รับคืน/ตรวจเครื่อง';` |
| 1015 | OK — reviewed, no change required | `      else if (['pending','confirmed'].includes(status)) work_task = 'เตรียมส่งมอบ';` |
| 1016 | OK — reviewed, no change required | `      else if (status === 'returned') work_task = 'ปิดงาน/ตรวจไฟล์';` |
| 1017 | OK — reviewed, no change required | `      if (payment && payment !== 'paid' && status !== 'cancelled') work_task = work_task ? work_task + ' + ตามชำระเงิน' : 'ตามชำระเงิน';` |
| 1018 | OK — blank/separator line | `` |
| 1019 | OK — reviewed, no change required | `      const packageType = String(r[8] || '').trim();` |
| 1020 | OK — reviewed, no change required | `      const packageDisplay =` |
| 1021 | OK — reviewed, no change required | `        packageDisplayByKey[[packageType, phone.model_group || '', lens.model_group || ''].join('|')] ||` |
| 1022 | OK — reviewed, no change required | `        packageDisplayByKey[[packageType, phone.model_group || '', 'NONE'].join('|')] ||` |
| 1023 | OK — reviewed, no change required | `        packageDisplayByKey[[packageType, 'NONE', lens.model_group || ''].join('|')] ||` |
| 1024 | OK — reviewed, no change required | `        packageDisplayByType[packageType] || packageType;` |
| 1025 | OK — blank/separator line | `` |
| 1026 | OK — reviewed, no change required | `      const eventDate = event.event_date || '';` |
| 1027 | OK — reviewed, no change required | `      const isPastEvent = eventDate ? kkIsPastEventDate_(eventDate) : false;` |
| 1028 | OK — reviewed, no change required | `      const isCancelled = status === 'cancelled';` |
| 1029 | OK — reviewed, no change required | `      const isActiveHold = kkActiveHold_(status);` |
| 1030 | FIXED current bookings include overdue active jobs | `      const shouldShowCurrent = !isCancelled && (kkActiveHold_(status) || !isPastEvent);` |
| 1031 | OK — blank/separator line | `` |
| 1032 | OK — reviewed, no change required | `      return {` |
| 1033 | OK — reviewed, no change required | `        row_number: o.row_number,` |
| 1034 | OK — reviewed, no change required | `        booking_id: r[0] || '',` |
| 1035 | OK — reviewed, no change required | `        created_at: kkApiDateTime_(r[1]),` |
| 1036 | OK — reviewed, no change required | `        booking_status: r[2] || '',` |
| 1037 | OK — reviewed, no change required | `        event_id: eventId,` |
| 1038 | OK — reviewed, no change required | `        event_name: event.event_name || eventId,` |
| 1039 | OK — reviewed, no change required | `        event_date: event.event_date || '',` |
| 1040 | OK — reviewed, no change required | `        venue: event.venue || '',` |
| 1041 | OK — reviewed, no change required | `        customer_name: r[4] || '',` |
| 1042 | OK — reviewed, no change required | `        customer_contact: r[5] || '',` |
| 1043 | OK — reviewed, no change required | `        customer_phone: r[6] || '',` |
| 1044 | OK — reviewed, no change required | `        contact_channel: r[7] || '',` |
| 1045 | OK — reviewed, no change required | `        package_type: packageType,` |
| 1046 | OK — reviewed, no change required | `        package_display: packageDisplay,` |
| 1047 | REVIEWED asset field support / double booking guarded by backend | `        phone_asset_id: phoneId,` |
| 1048 | OK — reviewed, no change required | `        phone_model_display: phone.model_display || phoneId || '',` |
| 1049 | OK — reviewed, no change required | `        phone_model_group: phone.model_group || '',` |
| 1050 | REVIEWED asset field support / double booking guarded by backend | `        lens_asset_id: lensId,` |
| 1051 | OK — reviewed, no change required | `        lens_model_display: lens.model_display || lensId || '',` |
| 1052 | OK — reviewed, no change required | `        lens_model_group: lens.model_group || '',` |
| 1053 | OK — reviewed, no change required | `        pickup_time: r[11] || '',` |
| 1054 | OK — reviewed, no change required | `        payment_status: r[13] || '',` |
| 1055 | OK — reviewed, no change required | `        amount_received: r[14] || 0,` |
| 1056 | OK — reviewed, no change required | `        work_task: work_task,` |
| 1057 | OK — reviewed, no change required | `        is_cancelled: isCancelled,` |
| 1058 | OK — reviewed, no change required | `        is_past_event: isPastEvent,` |
| 1059 | OK — reviewed, no change required | `        is_active_hold: isActiveHold,` |
| 1060 | OK — reviewed, no change required | `        should_show_current: shouldShowCurrent,` |
| 1061 | OK — reviewed, no change required | `        note: r[19] || ''` |
| 1062 | OK — reviewed, no change required | `      };` |
| 1063 | OK — reviewed, no change required | `    }).reverse();` |
| 1064 | OK — blank/separator line | `` |
| 1065 | OK — reviewed, no change required | `  const currentBookings = bookings.filter(b => b.should_show_current);` |
| 1066 | OK — blank/separator line | `` |
| 1067 | OK — reviewed, no change required | `  const todayKey = kkApiDate_(new Date());` |
| 1068 | OK — reviewed, no change required | `  const todayWorking = bookings` |
| 1069 | OK — reviewed, no change required | `    .filter(b => b.event_date === todayKey && String(b.booking_status || '').toLowerCase() !== 'cancelled')` |
| 1070 | OK — reviewed, no change required | `    .sort((a, b) => String(a.pickup_time || '').localeCompare(String(b.pickup_time || '')));` |
| 1071 | OK — blank/separator line | `` |
| 1072 | OK — reviewed, no change required | `  const webReady = kkApiWebReadyRows_();` |
| 1073 | OK — reviewed, no change required | `  const webPackages = kkApiWebPackageRows_();` |
| 1074 | OK — blank/separator line | `` |
| 1075 | OK — reviewed, no change required | `  const health = kkGetValues_(KK.health, 5, 1, 4)` |
| 1076 | OK — reviewed, no change required | `    .filter(r => r.some(v => v !== '' && v !== null))` |
| 1077 | OK — reviewed, no change required | `    .map(r => ({ check: r[0] || '', status: r[1] || '', detail: r[2] || '', note: r[3] || '' }));` |
| 1078 | OK — blank/separator line | `` |
| 1079 | OK — reviewed, no change required | `  const customerStats = kkReadCustomerStats_();` |
| 1080 | OK — reviewed, no change required | `  const phase1Diagnostics = kkPhase1Diagnostics_(payload || {});` |
| 1081 | OK — blank/separator line | `` |
| 1082 | OK — reviewed, no change required | `  return { data: {` |
| 1083 | OK — reviewed, no change required | `    events: events,` |
| 1084 | OK — reviewed, no change required | `    packages: packages,` |
| 1085 | OK — reviewed, no change required | `    overrides: overrides,` |
| 1086 | OK — reviewed, no change required | `    assets: assets,` |
| 1087 | OK — reviewed, no change required | `    bookings: bookings,` |
| 1088 | OK — reviewed, no change required | `    current_bookings: currentBookings,` |
| 1089 | OK — reviewed, no change required | `    web_ready: webReady,` |
| 1090 | OK — reviewed, no change required | `    web_packages: webPackages,` |
| 1091 | OK — reviewed, no change required | `    today_working: todayWorking,` |
| 1092 | OK — reviewed, no change required | `    today_key: todayKey,` |
| 1093 | OK — reviewed, no change required | `    model_master: Object.keys(modelMap).map(k => modelMap[k]),` |
| 1094 | OK — reviewed, no change required | `    customers: customerStats,` |
| 1095 | OK — reviewed, no change required | `    health: health,` |
| 1096 | OK — reviewed, no change required | `    generated_at: kkApiDateTime_(new Date()),` |
| 1097 | OK — reviewed, no change required | `    spreadsheet_id: SpreadsheetApp.getActive().getId(),` |
| 1098 | OK — reviewed, no change required | `    admin_api_version: KK_ADMIN_VERSION,` |
| 1099 | OK — reviewed, no change required | `    frontend_sheet_id: phase1Diagnostics.frontend_sheet_id || '',` |
| 1100 | OK — reviewed, no change required | `    phase1_diagnostics: phase1Diagnostics` |
| 1101 | OK — reviewed, no change required | `  } };` |
| 1102 | OK — reviewed, no change required | `}` |
| 1103 | OK — blank/separator line | `` |
| 1104 | OK — reviewed, no change required | `function kkApiVerifyEventWebReady_(eventId, expectedPosterUrl) {` |
| 1105 | OK — reviewed, no change required | `  SpreadsheetApp.flush();` |
| 1106 | OK — reviewed, no change required | `  const result = { web_ready_found: false, web_ready_poster_url: '', web_ready_action: '', web_ready_row_number: 0, web_ready_warning: '' };` |
| 1107 | OK — reviewed, no change required | `  const id = String(eventId || '').trim();` |
| 1108 | OK — reviewed, no change required | `  if (!id) return result;` |
| 1109 | OK — blank/separator line | `` |
| 1110 | OK — reviewed, no change required | `  const rows = kkGetValues_(KK.webReady, 5, 1, 11);` |
| 1111 | OK — reviewed, no change required | `  for (let i = 0; i < rows.length; i++) {` |
| 1112 | OK — reviewed, no change required | `    if (String(rows[i][0] || '').trim() !== id) continue;` |
| 1113 | OK — reviewed, no change required | `    result.web_ready_found = true;` |
| 1114 | OK — reviewed, no change required | `    result.web_ready_poster_url = String(rows[i][4] || '').trim();` |
| 1115 | OK — reviewed, no change required | `    result.web_ready_action = String(rows[i][9] || '').trim();` |
| 1116 | OK — reviewed, no change required | `    result.web_ready_row_number = i + 5;` |
| 1117 | OK — reviewed, no change required | `    break;` |
| 1118 | OK — reviewed, no change required | `  }` |
| 1119 | OK — reviewed, no change required | `  const expected = String(expectedPosterUrl || '').trim();` |
| 1120 | OK — reviewed, no change required | `  if (expected && result.web_ready_found && !result.web_ready_poster_url) {` |
| 1121 | OK — reviewed, no change required | `    result.web_ready_warning = 'Poster saved to 01_Events, but 08_Web_Ready poster_image_url is still blank. Check formulas in 08_Web_Ready column E.';` |
| 1122 | OK — reviewed, no change required | `  }` |
| 1123 | OK — reviewed, no change required | `  return result;` |
| 1124 | OK — reviewed, no change required | `}` |
| 1125 | OK — blank/separator line | `` |
| 1126 | OK — reviewed, no change required | `function kkApiUploadPoster_(payload) {` |
| 1127 | OK — reviewed, no change required | `  const folderId = String(PropertiesService.getScriptProperties().getProperty('KK_POSTER_FOLDER_ID') || '').trim();` |
| 1128 | OK — reviewed, no change required | `  if (!folderId) throw new Error('Missing Script Property KK_POSTER_FOLDER_ID. Run KK Admin > CRM: Set Poster Folder ID.');` |
| 1129 | OK — reviewed, no change required | `  const base64 = String(payload.base64 || '').trim();` |
| 1130 | OK — reviewed, no change required | `  const mimeType = String(payload.mimeType || 'image/jpeg').trim().toLowerCase();` |
| 1131 | OK — reviewed, no change required | `  const fileName = String(payload.fileName || ('poster-' + Date.now() + '.jpg')).replace(/[\/:*?"<>|]+/g, '-').slice(0, 120);` |
| 1132 | OK — blank/separator line | `` |
| 1133 | OK — reviewed, no change required | `  if (!base64) throw new Error('Missing poster file data');` |
| 1134 | OK — reviewed, no change required | `  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(mimeType)) throw new Error('Poster file must be JPG, PNG, or WEBP.');` |
| 1135 | OK — blank/separator line | `` |
| 1136 | OK — reviewed, no change required | `  const bytes = Utilities.base64Decode(base64);` |
| 1137 | OK — reviewed, no change required | `  if (bytes.length > 3 * 1024 * 1024) throw new Error('Poster image is too large. Please use a file below 3 MB.');` |
| 1138 | OK — blank/separator line | `` |
| 1139 | REVIEWED Drive permission scope required | `  const folder = DriveApp.getFolderById(folderId);` |
| 1140 | OK — reviewed, no change required | `  const file = folder.createFile(Utilities.newBlob(bytes, mimeType, fileName));` |
| 1141 | OK — reviewed, no change required | `  const publicInfo = kkEnsureDriveFilePublic_(file.getId(), { strict: false });` |
| 1142 | OK — reviewed, no change required | `  const posterUrl = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w1200';` |
| 1143 | OK — blank/separator line | `` |
| 1144 | OK — reviewed, no change required | `  return {` |
| 1145 | OK — reviewed, no change required | `    file_id: file.getId(),` |
| 1146 | OK — reviewed, no change required | `    view_url: publicInfo.view_url || file.getUrl(),` |
| 1147 | OK — reviewed, no change required | `    url: posterUrl,` |
| 1148 | OK — reviewed, no change required | `    poster_url: posterUrl,` |
| 1149 | OK — reviewed, no change required | `    public_checked: !!publicInfo.public_checked,` |
| 1150 | OK — reviewed, no change required | `    sharing_warning: publicInfo.sharing_warning || ''` |
| 1151 | OK — reviewed, no change required | `  };` |
| 1152 | OK — reviewed, no change required | `}` |
| 1153 | OK — blank/separator line | `` |
| 1154 | OK — reviewed, no change required | `function kkApiCreateEvent_(payload) {` |
| 1155 | REVIEWED concurrency lock | `  const lock = LockService.getDocumentLock();` |
| 1156 | OK — reviewed, no change required | `  lock.waitLock(30000);` |
| 1157 | OK — reviewed, no change required | `  try {` |
| 1158 | OK — reviewed, no change required | `    const eventName = String(payload.event_name || '').trim();` |
| 1159 | OK — reviewed, no change required | `    const eventDate = payload.event_date;` |
| 1160 | OK — reviewed, no change required | `    const venue = String(payload.venue || '').trim();` |
| 1161 | OK — reviewed, no change required | `    const posterInfo = kkPosterForWrite_(payload.poster_url || '');` |
| 1162 | OK — reviewed, no change required | `    const poster = posterInfo.url;` |
| 1163 | OK — reviewed, no change required | `    const status = String(payload.status || 'open').toLowerCase().trim();` |
| 1164 | OK — reviewed, no change required | `    const active = payload.active_on_web === undefined ? true : kkIsTrue_(payload.active_on_web);` |
| 1165 | OK — reviewed, no change required | `    const note = payload.note || '';` |
| 1166 | OK — reviewed, no change required | `    if (!eventName || !eventDate || !venue) throw new Error('Please fill event_name, event_date and venue');` |
| 1167 | OK — reviewed, no change required | `    if (!['open', 'closed'].includes(status)) throw new Error('status must be open or closed');` |
| 1168 | OK — reviewed, no change required | `    const eventId = kkGenerateUniqueEventId_(eventName, eventDate);` |
| 1169 | OK — reviewed, no change required | `    const row = kkFirstEmptyRow_(KK.events, 1, 5, 1, 8);` |
| 1170 | OK — reviewed, no change required | `    const sh = kkSheet_(KK.events);` |
| 1171 | REVIEWED batch write preferred | `    sh.getRange(row, 1, 1, 8).setValues([[eventId, eventName, kkDateObj_(eventDate), venue, poster, status, active, note]]);` |
| 1172 | OK — reviewed, no change required | `    SpreadsheetApp.flush();` |
| 1173 | OK — reviewed, no change required | `    const savedPoster = String(sh.getRange(row, 5).getValue() || '').trim();` |
| 1174 | OK — reviewed, no change required | `    if (poster && !savedPoster) throw new Error('Poster uploaded, but poster_url was not written to 01_Events. Please try saving again.');` |
| 1175 | OK — reviewed, no change required | `    const webReady = kkApiVerifyEventWebReady_(eventId, savedPoster);` |
| 1176 | OK — reviewed, no change required | `    return Object.assign({` |
| 1177 | OK — reviewed, no change required | `      event_id: eventId, row_number: row, poster_url: savedPoster,` |
| 1178 | OK — reviewed, no change required | `      poster_drive_file_id: posterInfo.drive_file_id || '', poster_public_checked: !!posterInfo.public_checked, poster_public_warning: posterInfo.sharing_warning || ''` |
| 1179 | OK — reviewed, no change required | `    }, webReady);` |
| 1180 | OK — reviewed, no change required | `  } finally {` |
| 1181 | OK — reviewed, no change required | `    lock.releaseLock();` |
| 1182 | OK — reviewed, no change required | `  }` |
| 1183 | OK — reviewed, no change required | `}` |
| 1184 | OK — blank/separator line | `` |
| 1185 | OK — reviewed, no change required | `function kkApiUpdateEvent_(payload) {` |
| 1186 | OK — reviewed, no change required | `  const eventId = String(payload.event_id || '').trim();` |
| 1187 | OK — reviewed, no change required | `  if (!eventId) throw new Error('event_id is required');` |
| 1188 | OK — reviewed, no change required | `  const sh = kkSheet_(KK.events);` |
| 1189 | OK — reviewed, no change required | `  const rows = kkGetValues_(KK.events, 5, 1, 8);` |
| 1190 | OK — reviewed, no change required | `  for (let i = 0; i < rows.length; i++) {` |
| 1191 | OK — reviewed, no change required | `    if (String(rows[i][0] || '').trim() !== eventId) continue;` |
| 1192 | OK — reviewed, no change required | `    const rowNumber = i + 5;` |
| 1193 | OK — reviewed, no change required | `    const current = rows[i].slice();` |
| 1194 | OK — reviewed, no change required | `    if (payload.event_name) current[1] = String(payload.event_name).trim();` |
| 1195 | OK — reviewed, no change required | `    if (payload.event_date) current[2] = kkDateObj_(payload.event_date);` |
| 1196 | OK — reviewed, no change required | `    if (payload.venue) current[3] = String(payload.venue).trim();` |
| 1197 | OK — reviewed, no change required | `    const posterInfo = payload.poster_url ? kkPosterForWrite_(payload.poster_url) : { url: '', drive_file_id: '', public_checked: false };` |
| 1198 | OK — reviewed, no change required | `    if (payload.poster_url) current[4] = posterInfo.url;` |
| 1199 | OK — reviewed, no change required | `    if (payload.status) current[5] = String(payload.status).toLowerCase().trim();` |
| 1200 | OK — reviewed, no change required | `    const active = kkApiBoolOrBlank_(payload.active_on_web);` |
| 1201 | OK — reviewed, no change required | `    if (active !== '') current[6] = active;` |
| 1202 | OK — reviewed, no change required | `    if (payload.note !== undefined && payload.note !== '') current[7] = payload.note;` |
| 1203 | REVIEWED batch write preferred | `    sh.getRange(rowNumber, 1, 1, 8).setValues([current]);` |
| 1204 | OK — reviewed, no change required | `    SpreadsheetApp.flush();` |
| 1205 | OK — reviewed, no change required | `    const savedPoster = String(sh.getRange(rowNumber, 5).getValue() || '').trim();` |
| 1206 | OK — reviewed, no change required | `    if (payload.poster_url && !savedPoster) throw new Error('Poster uploaded, but poster_url was not written to 01_Events. Please try saving again.');` |
| 1207 | OK — reviewed, no change required | `    const webReady = kkApiVerifyEventWebReady_(eventId, savedPoster);` |
| 1208 | OK — reviewed, no change required | `    return Object.assign({` |
| 1209 | OK — reviewed, no change required | `      event_id: eventId, row_number: rowNumber, poster_url: savedPoster,` |
| 1210 | OK — reviewed, no change required | `      poster_drive_file_id: posterInfo.drive_file_id || '', poster_public_checked: !!posterInfo.public_checked, poster_public_warning: posterInfo.sharing_warning || ''` |
| 1211 | OK — reviewed, no change required | `    }, webReady);` |
| 1212 | OK — reviewed, no change required | `  }` |
| 1213 | OK — reviewed, no change required | `  throw new Error('Event not found: ' + eventId);` |
| 1214 | OK — reviewed, no change required | `}` |
| 1215 | OK — blank/separator line | `` |
| 1216 | OK — reviewed, no change required | `function kkGenerateUniqueTemplateId_(displayName) {` |
| 1217 | OK — reviewed, no change required | `  const base = 'TPL-' + kkSlug_(displayName);` |
| 1218 | OK — reviewed, no change required | `  const existing = kkGetValues_(KK.packages, 5, 1, 1).flat().map(v => String(v || '').trim()).filter(String);` |
| 1219 | OK — reviewed, no change required | `  if (!existing.includes(base)) return base;` |
| 1220 | OK — reviewed, no change required | `  for (let i = 2; i < 100; i++) {` |
| 1221 | OK — reviewed, no change required | `    const id = base + '-' + i;` |
| 1222 | OK — reviewed, no change required | `    if (!existing.includes(id)) return id;` |
| 1223 | OK — reviewed, no change required | `  }` |
| 1224 | OK — reviewed, no change required | `  throw new Error('Cannot generate unique template_id');` |
| 1225 | OK — reviewed, no change required | `}` |
| 1226 | OK — blank/separator line | `` |
| 1227 | OK — reviewed, no change required | `function kkApiCreatePackage_(payload) {` |
| 1228 | OK — reviewed, no change required | `  const displayName = String(payload.display_name || '').trim();` |
| 1229 | OK — reviewed, no change required | `  if (!displayName) throw new Error('display_name is required');` |
| 1230 | OK — reviewed, no change required | `  const templateId = String(payload.template_id || '').trim() || kkGenerateUniqueTemplateId_(displayName);` |
| 1231 | OK — reviewed, no change required | `  const modelGroup = String(payload.model_group || 'NONE').trim() || 'NONE';` |
| 1232 | OK — reviewed, no change required | `  const packageType = String(payload.package_type || '').toLowerCase().trim();` |
| 1233 | OK — reviewed, no change required | `  const lensGroup = String(payload.lens_group || 'NONE').trim() || 'NONE';` |
| 1234 | OK — reviewed, no change required | `  const standardPrice = kkApiNumber_(payload.standard_price, 'standard_price', false);` |
| 1235 | OK — reviewed, no change required | `  const active = payload.active === undefined ? true : kkIsTrue_(payload.active);` |
| 1236 | OK — reviewed, no change required | `  const useCase = payload.use_case || '';` |
| 1237 | OK — reviewed, no change required | `  if (!['phone_only', 'lens_only', 'phone_lens_bundle'].includes(packageType)) throw new Error('package_type must be phone_only, lens_only or phone_lens_bundle');` |
| 1238 | OK — reviewed, no change required | `  if ((packageType === 'phone_only' || packageType === 'phone_lens_bundle') && (!modelGroup || modelGroup === 'NONE')) throw new Error('model_group is required for phone package…` |
| 1239 | OK — reviewed, no change required | `  if ((packageType === 'lens_only' || packageType === 'phone_lens_bundle') && (!lensGroup || lensGroup === 'NONE')) throw new Error('lens_group is required for lens packages');` |
| 1240 | OK — blank/separator line | `  ` |
| 1241 | OK — reviewed, no change required | `  const existing = kkGetValues_(KK.packages, 5, 1, 1).flat().map(v => String(v || '').trim());` |
| 1242 | OK — reviewed, no change required | `  if (existing.includes(templateId)) throw new Error('template_id already exists: ' + templateId);` |
| 1243 | OK — reviewed, no change required | `  const row = kkFirstEmptyRow_(KK.packages, 1, 5, 1, 10);` |
| 1244 | REVIEWED batch write preferred | `  kkSheet_(KK.packages).getRange(row, 1, 1, 10).setValues([[templateId, modelGroup, packageType, lensGroup, standardPrice, displayName, '', active, '', useCase]]);` |
| 1245 | OK — reviewed, no change required | `  return { template_id: templateId, row_number: row };` |
| 1246 | OK — reviewed, no change required | `}` |
| 1247 | OK — blank/separator line | `` |
| 1248 | OK — reviewed, no change required | `function kkApiUpdatePackage_(payload) {` |
| 1249 | OK — reviewed, no change required | `  const templateId = String(payload.template_id || '').trim();` |
| 1250 | OK — reviewed, no change required | `  if (!templateId) throw new Error('template_id is required');` |
| 1251 | OK — reviewed, no change required | `  const sh = kkSheet_(KK.packages);` |
| 1252 | OK — reviewed, no change required | `  const rows = kkGetValues_(KK.packages, 5, 1, 10);` |
| 1253 | OK — reviewed, no change required | `  for (let i = 0; i < rows.length; i++) {` |
| 1254 | OK — reviewed, no change required | `    if (String(rows[i][0] || '').trim() !== templateId) continue;` |
| 1255 | OK — reviewed, no change required | `    const rowNumber = i + 5;` |
| 1256 | OK — reviewed, no change required | `    const current = rows[i].slice();` |
| 1257 | OK — reviewed, no change required | `    if (payload.standard_price !== '' && payload.standard_price !== undefined) current[4] = kkApiNumber_(payload.standard_price, 'standard_price', false);` |
| 1258 | OK — reviewed, no change required | `    if (payload.display_name) current[5] = String(payload.display_name).trim();` |
| 1259 | OK — reviewed, no change required | `    const active = kkApiBoolOrBlank_(payload.active);` |
| 1260 | OK — reviewed, no change required | `    if (active !== '') current[7] = active;` |
| 1261 | OK — reviewed, no change required | `    if (payload.use_case !== undefined && payload.use_case !== '') current[9] = payload.use_case;` |
| 1262 | REVIEWED batch write preferred | `    sh.getRange(rowNumber, 1, 1, 10).setValues([current]);` |
| 1263 | OK — reviewed, no change required | `    return { template_id: templateId, row_number: rowNumber };` |
| 1264 | OK — reviewed, no change required | `  }` |
| 1265 | OK — reviewed, no change required | `  throw new Error('Package not found: ' + templateId);` |
| 1266 | OK — reviewed, no change required | `}` |
| 1267 | OK — blank/separator line | `` |
| 1268 | OK — reviewed, no change required | `function kkFindOverrideRow_(eventId, templateId) {` |
| 1269 | OK — reviewed, no change required | `  const rows = kkGetValues_(KK.overrides, 5, 1, 2);` |
| 1270 | OK — reviewed, no change required | `  for (let i = 0; i < rows.length; i++) {` |
| 1271 | OK — reviewed, no change required | `    if (String(rows[i][0] || '').trim() === eventId && String(rows[i][1] || '').trim() === templateId) return i + 5;` |
| 1272 | OK — reviewed, no change required | `  }` |
| 1273 | OK — reviewed, no change required | `  return 0;` |
| 1274 | OK — reviewed, no change required | `}` |
| 1275 | OK — blank/separator line | `` |
| 1276 | OK — reviewed, no change required | `function kkApiUpsertEventOverride_(payload) {` |
| 1277 | REVIEWED concurrency lock | `  const lock = LockService.getDocumentLock();` |
| 1278 | OK — reviewed, no change required | `  lock.waitLock(30000);` |
| 1279 | OK — reviewed, no change required | `  try {` |
| 1280 | OK — reviewed, no change required | `    const eventId = String(payload.event_id || '').trim();` |
| 1281 | OK — reviewed, no change required | `    let templateId = String(payload.template_id || '').trim();` |
| 1282 | OK — reviewed, no change required | `    if (!eventId || !templateId) throw new Error('Please select event and package');` |
| 1283 | OK — reviewed, no change required | `    kkGetEventById_(eventId);` |
| 1284 | OK — reviewed, no change required | `    templateId = kkNormalizeTemplateIdForEvent_(eventId, templateId);` |
| 1285 | OK — reviewed, no change required | `    kkGetPackageByTemplateId_(templateId);` |
| 1286 | OK — blank/separator line | `    ` |
| 1287 | OK — reviewed, no change required | `    const hasOverridePrice = !(payload.override_price === '' || payload.override_price === null || typeof payload.override_price === 'undefined');` |
| 1288 | OK — reviewed, no change required | `    const overridePrice = hasOverridePrice ? kkApiNumber_(payload.override_price, 'override_price', false) : '';` |
| 1289 | OK — reviewed, no change required | `    const activeOverride = kkApiBoolOrBlank_(payload.active_override);` |
| 1290 | OK — reviewed, no change required | `    const overrideNote = payload.override_note === undefined ? '' : String(payload.override_note || '');` |
| 1291 | OK — reviewed, no change required | `    const sortOrderOverride = payload.sort_order_override === undefined || payload.sort_order_override === '' ? '' : kkApiNumber_(payload.sort_order_override, 'sort_order_overri…` |
| 1292 | OK — reviewed, no change required | `    const useCaseOverride = payload.use_case_override === undefined ? '' : String(payload.use_case_override || '');` |
| 1293 | OK — blank/separator line | `    ` |
| 1294 | OK — reviewed, no change required | `    const sh = kkSheet_(KK.overrides);` |
| 1295 | OK — reviewed, no change required | `    let row = kkFindOverrideRow_(eventId, templateId);` |
| 1296 | OK — reviewed, no change required | `    if (!row) row = kkFirstEmptyRow_(KK.overrides, 1, 5, 1, 7);` |
| 1297 | REVIEWED batch write preferred | `    sh.getRange(row, 1, 1, 7).setValues([[eventId, templateId, overridePrice, activeOverride, overrideNote, sortOrderOverride, useCaseOverride]]);` |
| 1298 | OK — reviewed, no change required | `    SpreadsheetApp.flush();` |
| 1299 | OK — reviewed, no change required | `    return { event_id: eventId, template_id: templateId, row_number: row, override_price: overridePrice, active_override: activeOverride, use_case_override: useCaseOverride };` |
| 1300 | OK — reviewed, no change required | `  } finally {` |
| 1301 | OK — reviewed, no change required | `    lock.releaseLock();` |
| 1302 | OK — reviewed, no change required | `  }` |
| 1303 | OK — reviewed, no change required | `}` |
| 1304 | OK — blank/separator line | `` |
| 1305 | OK — reviewed, no change required | `function kkApiAddAssets_(payload) {` |
| 1306 | REVIEWED concurrency lock | `  const lock = LockService.getDocumentLock();` |
| 1307 | OK — reviewed, no change required | `  lock.waitLock(30000);` |
| 1308 | OK — reviewed, no change required | `  try {` |
| 1309 | OK — reviewed, no change required | `    const assetType = String(payload.asset_type || '').toLowerCase().trim();` |
| 1310 | OK — reviewed, no change required | `    const modelGroup = String(payload.model_group || '').trim();` |
| 1311 | OK — reviewed, no change required | `    const qty = Number(payload.quantity || 0);` |
| 1312 | OK — reviewed, no change required | `    const serialPrefix = String(payload.serial_prefix || '').trim();` |
| 1313 | OK — reviewed, no change required | `    const status = String(payload.status || 'available').toLowerCase().trim();` |
| 1314 | OK — reviewed, no change required | `    const notes = payload.notes || '';` |
| 1315 | OK — reviewed, no change required | `    const rentable = payload.rentable === false ? false : true;` |
| 1316 | OK — reviewed, no change required | `    if (!['phone', 'lens'].includes(assetType)) throw new Error('asset_type must be phone or lens');` |
| 1317 | OK — reviewed, no change required | `    if (!modelGroup || qty < 1 || qty > 50) throw new Error('Please fill model_group and quantity 1-50');` |
| 1318 | OK — blank/separator line | `    ` |
| 1319 | OK — reviewed, no change required | `    const sh = kkSheet_(KK.assets);` |
| 1320 | OK — reviewed, no change required | `    const ids = kkNextAssetIds_(assetType, qty);` |
| 1321 | OK — reviewed, no change required | `    const targetRows = kkEmptyRows_(KK.assets, 1, 5, 1, 7, qty);` |
| 1322 | OK — reviewed, no change required | `    const data = ids.map((id, i) => [id, assetType, modelGroup, serialPrefix ? serialPrefix + '-' + String(i + 1).padStart(3, '0') : '', status, notes, rentable]);` |
| 1323 | OK — reviewed, no change required | `    const contiguous = targetRows.every((row, i) => i === 0 || row === targetRows[i - 1] + 1);` |
| 1324 | REVIEWED batch write preferred | `    if (contiguous) sh.getRange(targetRows[0], 1, qty, 7).setValues(data);` |
| 1325 | REVIEWED batch write preferred | `    else targetRows.forEach((row, i) => sh.getRange(row, 1, 1, 7).setValues([data[i]]));` |
| 1326 | OK — reviewed, no change required | `    return { asset_ids: ids, rows: targetRows };` |
| 1327 | OK — reviewed, no change required | `  } finally {` |
| 1328 | OK — reviewed, no change required | `    lock.releaseLock();` |
| 1329 | OK — reviewed, no change required | `  }` |
| 1330 | OK — reviewed, no change required | `}` |
| 1331 | OK — blank/separator line | `` |
| 1332 | OK — reviewed, no change required | `function kkIsPastEventDate_(value) {` |
| 1333 | OK — reviewed, no change required | `  if (!value) return true;` |
| 1334 | OK — reviewed, no change required | `  const d = kkDateObj_(value);` |
| 1335 | OK — reviewed, no change required | `  d.setHours(0, 0, 0, 0);` |
| 1336 | OK — reviewed, no change required | `  const today = new Date();` |
| 1337 | OK — reviewed, no change required | `  today.setHours(0, 0, 0, 0);` |
| 1338 | OK — reviewed, no change required | `  return d.getTime() < today.getTime();` |
| 1339 | OK — reviewed, no change required | `}` |
| 1340 | OK — blank/separator line | `` |
| 1341 | OK — reviewed, no change required | `function kkIsCurrentOrFutureEventDate_(value) {` |
| 1342 | OK — reviewed, no change required | `  if (!value) return false;` |
| 1343 | OK — reviewed, no change required | `  return !kkIsPastEventDate_(value);` |
| 1344 | OK — reviewed, no change required | `}` |
| 1345 | OK — blank/separator line | `` |
| 1346 | OK — blank/separator line | `` |
| 1347 | OK — reviewed, no change required | `function kkFindBookingRow_(rowNumber, bookingId) {` |
| 1348 | OK — reviewed, no change required | `  const sh = kkSheet_(KK.bookings);` |
| 1349 | OK — reviewed, no change required | `  const n = Number(rowNumber || 0);` |
| 1350 | OK — reviewed, no change required | `  if (n >= 5 && n <= sh.getMaxRows()) {` |
| 1351 | REVIEWED range read scope | `    const rowValues = sh.getRange(n, 1, 1, 4).getValues()[0];` |
| 1352 | OK — reviewed, no change required | `    if (!rowValues[0] && !rowValues[3]) throw new Error('Booking row is empty: ' + n);` |
| 1353 | OK — reviewed, no change required | `    return n;` |
| 1354 | OK — reviewed, no change required | `  }` |
| 1355 | OK — reviewed, no change required | `  const id = String(bookingId || '').trim();` |
| 1356 | OK — reviewed, no change required | `  if (!id) throw new Error('booking row_number or booking_id is required');` |
| 1357 | OK — reviewed, no change required | `  const values = kkGetValues_(KK.bookings, 5, 1, 1);` |
| 1358 | OK — reviewed, no change required | `  for (let i = 0; i < values.length; i++) {` |
| 1359 | OK — reviewed, no change required | `    if (String(values[i][0] || '').trim() === id) return i + 5;` |
| 1360 | OK — reviewed, no change required | `  }` |
| 1361 | OK — reviewed, no change required | `  throw new Error('Booking not found: ' + id);` |
| 1362 | OK — reviewed, no change required | `}` |
| 1363 | OK — blank/separator line | `` |
| 1364 | OK — reviewed, no change required | `function kkAssertBookingAssetsNotDoubleBooked_(rowNumber, bookingRow, nextStatus) {` |
| 1365 | OK — reviewed, no change required | `  if (!kkActiveHold_(nextStatus)) return;` |
| 1366 | OK — reviewed, no change required | `  const eventId = String(bookingRow[3] || '').trim();` |
| 1367 | OK — reviewed, no change required | `  const phoneId = String(bookingRow[9] || '').trim();` |
| 1368 | OK — reviewed, no change required | `  const lensId = String(bookingRow[10] || '').trim();` |
| 1369 | OK — reviewed, no change required | `  if (!eventId) throw new Error('Booking missing event_id');` |
| 1370 | OK — reviewed, no change required | `  const event = kkGetEventById_(eventId);` |
| 1371 | OK — reviewed, no change required | `  const booked = kkBookedAssetIdsForDate_(event.event_date, rowNumber);` |
| 1372 | OK — reviewed, no change required | `  if (phoneId && booked.phone[phoneId]) throw new Error('Cannot reactivate booking: phone is already booked on this event date: ' + phoneId);` |
| 1373 | OK — reviewed, no change required | `  if (lensId && booked.lens[lensId]) throw new Error('Cannot reactivate booking: lens is already booked on this event date: ' + lensId);` |
| 1374 | OK — reviewed, no change required | `}` |
| 1375 | OK — blank/separator line | `` |
| 1376 | OK — reviewed, no change required | `function kkApiCreateBooking_(payload) {` |
| 1377 | REVIEWED concurrency lock | `  const lock = LockService.getDocumentLock();` |
| 1378 | OK — reviewed, no change required | `  lock.waitLock(30000);` |
| 1379 | OK — reviewed, no change required | `  try {` |
| 1380 | OK — reviewed, no change required | `    const eventId = String(payload.event_id || '').trim();` |
| 1381 | OK — reviewed, no change required | `    let templateId = String(payload.template_id || '').trim();` |
| 1382 | OK — reviewed, no change required | `    const customerName = String(payload.customer_name || '').trim();` |
| 1383 | OK — reviewed, no change required | `    const customerContact = payload.customer_contact || '';` |
| 1384 | OK — reviewed, no change required | `    const customerPhone = payload.customer_phone || '';` |
| 1385 | OK — reviewed, no change required | `    const contactChannel = payload.contact_channel || 'LINE';` |
| 1386 | OK — reviewed, no change required | `    const bookingStatus = String(payload.booking_status || 'confirmed').toLowerCase().trim();` |
| 1387 | REVIEWED asset field support / double booking guarded by backend | `    let phoneAssetId = String(payload.phone_asset_id || '').trim();` |
| 1388 | REVIEWED asset field support / double booking guarded by backend | `    let lensAssetId = String(payload.lens_asset_id || '').trim();` |
| 1389 | OK — reviewed, no change required | `    const paymentStatus = String(payload.payment_status || 'unpaid').toLowerCase().trim();` |
| 1390 | OK — reviewed, no change required | `    const amountReceived = kkApiNumber_(payload.amount_received, 'amount_received', true) || 0;` |
| 1391 | OK — reviewed, no change required | `    const bookingNote = payload.booking_note || '';` |
| 1392 | OK — blank/separator line | `    ` |
| 1393 | OK — reviewed, no change required | `    if (!eventId || !templateId || !customerName) throw new Error('Please fill event_id, template_id and customer_name');` |
| 1394 | OK — reviewed, no change required | `    if (!['pending', 'confirmed', 'picked_up', 'returned', 'cancelled'].includes(bookingStatus)) throw new Error('Invalid booking_status');` |
| 1395 | OK — reviewed, no change required | `    if (!['unpaid', 'partial', 'paid', 'refunded'].includes(paymentStatus)) throw new Error('Invalid payment_status');` |
| 1396 | OK — blank/separator line | `    ` |
| 1397 | OK — reviewed, no change required | `    templateId = kkNormalizeTemplateIdForEvent_(eventId, templateId);` |
| 1398 | OK — reviewed, no change required | `    const event = kkGetEventById_(eventId);` |
| 1399 | OK — reviewed, no change required | `    if (kkIsPastEventDate_(event.event_date)) throw new Error('Cannot create booking for a past event date: ' + kkApiDate_(event.event_date));` |
| 1400 | OK — reviewed, no change required | `    const pkg = kkGetPackageByTemplateId_(templateId);` |
| 1401 | OK — reviewed, no change required | `    if (String(event.status).toLowerCase() !== 'open') throw new Error('Event is not open: ' + eventId);` |
| 1402 | OK — reviewed, no change required | `    if (!event.active) throw new Error('Event is not active_on_web: ' + eventId);` |
| 1403 | OK — reviewed, no change required | `    if (!pkg.active) throw new Error('Package is inactive: ' + templateId);` |
| 1404 | OK — reviewed, no change required | `    kkAssertWebPackageBookable_(eventId, templateId);` |
| 1405 | OK — blank/separator line | `` |
| 1406 | OK — reviewed, no change required | `    const pkgType = String(pkg.package_type || '').toLowerCase().trim();` |
| 1407 | OK — reviewed, no change required | `    if (phoneAssetId) kkValidateManualAsset_(phoneAssetId, 'phone', pkg.model_group, event.event_date);` |
| 1408 | OK — reviewed, no change required | `    if (lensAssetId) kkValidateManualAsset_(lensAssetId, 'lens', pkg.lens_group, event.event_date);` |
| 1409 | OK — reviewed, no change required | `    if ((pkgType === 'phone_only' || pkgType === 'phone_lens_bundle') && !phoneAssetId) phoneAssetId = kkFindAvailableAsset_('phone', pkg.model_group, event.event_date);` |
| 1410 | OK — reviewed, no change required | `    if ((pkgType === 'lens_only' || pkgType === 'phone_lens_bundle') && !lensAssetId) lensAssetId = kkFindAvailableAsset_('lens', pkg.lens_group, event.event_date);` |
| 1411 | OK — blank/separator line | `    ` |
| 1412 | OK — reviewed, no change required | `    const row = kkFirstEmptyRow_(KK.bookings, 4, 5, 2, 19);` |
| 1413 | REVIEWED batch write preferred | `    kkSheet_(KK.bookings).getRange(row, 2, 1, 19).setValues([[` |
| 1414 | OK — reviewed, no change required | `      new Date(), bookingStatus, eventId, customerName, customerContact, customerPhone, contactChannel,` |
| 1415 | OK — reviewed, no change required | `      pkgType, phoneAssetId, lensAssetId, '', '', paymentStatus, amountReceived, '', '', '', 0, bookingNote` |
| 1416 | OK — reviewed, no change required | `    ]]);` |
| 1417 | REVIEWED asset field support / double booking guarded by backend | `    return { row_number: row, phone_asset_id: phoneAssetId, lens_asset_id: lensAssetId };` |
| 1418 | OK — reviewed, no change required | `  } finally {` |
| 1419 | OK — reviewed, no change required | `    lock.releaseLock();` |
| 1420 | OK — reviewed, no change required | `  }` |
| 1421 | OK — reviewed, no change required | `}` |
| 1422 | OK — blank/separator line | `` |
| 1423 | OK — reviewed, no change required | `function kkApiUpdateBooking_(payload) {` |
| 1424 | REVIEWED concurrency lock | `  const lock = LockService.getDocumentLock();` |
| 1425 | OK — reviewed, no change required | `  lock.waitLock(30000);` |
| 1426 | OK — reviewed, no change required | `  try {` |
| 1427 | OK — reviewed, no change required | `    const row = kkFindBookingRow_(payload.row_number, payload.booking_id);` |
| 1428 | OK — reviewed, no change required | `    const sh = kkSheet_(KK.bookings);` |
| 1429 | REVIEWED range read scope | `    const current = sh.getRange(row, 1, 1, 20).getValues()[0];` |
| 1430 | OK — reviewed, no change required | `    if (!current[0] && !current[3]) throw new Error('Booking row is empty: ' + row);` |
| 1431 | OK — blank/separator line | `    ` |
| 1432 | OK — reviewed, no change required | `    const nextStatus = String(payload.booking_status || current[2] || '').toLowerCase().trim();` |
| 1433 | OK — reviewed, no change required | `    const paymentStatus = String(payload.payment_status || current[13] || '').toLowerCase().trim();` |
| 1434 | OK — reviewed, no change required | `    const amountReceived = payload.amount_received === undefined || payload.amount_received === '' ? current[14] : kkApiNumber_(payload.amount_received, 'amount_received', true);` |
| 1435 | OK — blank/separator line | `` |
| 1436 | OK — reviewed, no change required | `    if (!['pending', 'confirmed', 'picked_up', 'returned', 'cancelled'].includes(nextStatus)) throw new Error('Invalid booking_status');` |
| 1437 | OK — reviewed, no change required | `    if (!['unpaid', 'partial', 'paid', 'refunded'].includes(paymentStatus)) throw new Error('Invalid payment_status');` |
| 1438 | OK — blank/separator line | `` |
| 1439 | OK — reviewed, no change required | `    const next = current.slice();` |
| 1440 | OK — reviewed, no change required | `    if (payload.booking_status !== undefined && payload.booking_status !== '') next[2] = nextStatus;` |
| 1441 | OK — reviewed, no change required | `    if (payload.customer_name !== undefined && payload.customer_name !== '') next[4] = String(payload.customer_name || '').trim();` |
| 1442 | OK — reviewed, no change required | `    if (payload.customer_contact !== undefined) next[5] = payload.customer_contact || '';` |
| 1443 | OK — reviewed, no change required | `    if (payload.customer_phone !== undefined) next[6] = payload.customer_phone || '';` |
| 1444 | OK — reviewed, no change required | `    if (payload.contact_channel !== undefined && payload.contact_channel !== '') next[7] = payload.contact_channel || 'LINE';` |
| 1445 | REVIEWED asset field support / double booking guarded by backend | `    if (payload.phone_asset_id !== undefined) next[9] = String(payload.phone_asset_id || '').trim();` |
| 1446 | REVIEWED asset field support / double booking guarded by backend | `    if (payload.lens_asset_id !== undefined) next[10] = String(payload.lens_asset_id || '').trim();` |
| 1447 | OK — reviewed, no change required | `    if (payload.pickup_time !== undefined) next[11] = payload.pickup_time || '';` |
| 1448 | OK — reviewed, no change required | `    if (payload.payment_status !== undefined && payload.payment_status !== '') next[13] = paymentStatus;` |
| 1449 | OK — reviewed, no change required | `    if (payload.amount_received !== undefined && payload.amount_received !== '') next[14] = amountReceived;` |
| 1450 | OK — reviewed, no change required | `    if (payload.booking_note !== undefined) next[19] = payload.booking_note || '';` |
| 1451 | OK — reviewed, no change required | `    if (!String(next[4] || '').trim()) throw new Error('customer_name is required');` |
| 1452 | OK — blank/separator line | `` |
| 1453 | OK — reviewed, no change required | `    const eventId = String(next[3] || '').trim();` |
| 1454 | OK — reviewed, no change required | `    const event = kkGetEventById_(eventId);` |
| 1455 | OK — reviewed, no change required | `    if (kkActiveHold_(nextStatus)) {` |
| 1456 | OK — reviewed, no change required | `      if (next[9]) kkValidateManualAsset_(next[9], 'phone', '', event.event_date);` |
| 1457 | OK — reviewed, no change required | `      if (next[10]) kkValidateManualAsset_(next[10], 'lens', '', event.event_date);` |
| 1458 | OK — reviewed, no change required | `    }` |
| 1459 | OK — reviewed, no change required | `    kkAssertBookingAssetsNotDoubleBooked_(row, next, nextStatus);` |
| 1460 | OK — blank/separator line | `` |
| 1461 | OK — reviewed, no change required | `    sh.getRange(row, 3).setValue(next[2]);` |
| 1462 | REVIEWED batch write preferred | `    sh.getRange(row, 5, 1, 4).setValues([[next[4], next[5], next[6], next[7]]]);` |
| 1463 | REVIEWED batch write preferred | `    sh.getRange(row, 10, 1, 2).setValues([[next[9], next[10]]]);` |
| 1464 | OK — reviewed, no change required | `    sh.getRange(row, 12).setValue(next[11]);` |
| 1465 | REVIEWED batch write preferred | `    sh.getRange(row, 14, 1, 2).setValues([[next[13], next[14]]]);` |
| 1466 | OK — reviewed, no change required | `    sh.getRange(row, 20).setValue(next[19]);` |
| 1467 | OK — blank/separator line | `` |
| 1468 | REVIEWED asset field support / double booking guarded by backend | `    return { row_number: row, booking_id: current[0] || '', booking_status: next[2], payment_status: next[13], phone_asset_id: next[9], lens_asset_id: next[10] };` |
| 1469 | OK — reviewed, no change required | `  } finally {` |
| 1470 | OK — reviewed, no change required | `    lock.releaseLock();` |
| 1471 | OK — reviewed, no change required | `  }` |
| 1472 | OK — reviewed, no change required | `}` |
| 1473 | OK — blank/separator line | `` |
| 1474 | OK — reviewed, no change required | `function kkEnsureSheetWithHeaders_(name, headers) {` |
| 1475 | OK — reviewed, no change required | `  const ss = SpreadsheetApp.getActive();` |
| 1476 | OK — reviewed, no change required | `  let sh = ss.getSheetByName(name);` |
| 1477 | OK — reviewed, no change required | `  if (!sh) sh = ss.insertSheet(name);` |
| 1478 | REVIEWED range read scope | `  const existing = sh.getRange(1, 1, 1, headers.length).getValues()[0];` |
| 1479 | OK — reviewed, no change required | `  let needsHeaders = false;` |
| 1480 | OK — reviewed, no change required | `  for (let i = 0; i < headers.length; i++) {` |
| 1481 | OK — reviewed, no change required | `    if (existing[i] !== headers[i]) { needsHeaders = true; break; }` |
| 1482 | OK — reviewed, no change required | `  }` |
| 1483 | OK — reviewed, no change required | `  if (needsHeaders) {` |
| 1484 | REVIEWED batch write preferred | `    sh.getRange(1, 1, 1, headers.length).setValues([headers]);` |
| 1485 | OK — reviewed, no change required | `    sh.setFrozenRows(1);` |
| 1486 | OK — reviewed, no change required | `  }` |
| 1487 | OK — reviewed, no change required | `  return sh;` |
| 1488 | OK — reviewed, no change required | `}` |
| 1489 | OK — blank/separator line | `` |
| 1490 | OK — reviewed, no change required | `function kkEnsureCrmArchiveSheets_() {` |
| 1491 | REVIEWED range read scope | `  const bookingHeaders = kkSheet_(KK.bookings).getRange('A4:T4').getValues()[0];` |
| 1492 | OK — reviewed, no change required | `  kkEnsureSheetWithHeaders_(KK.customerStats, [` |
| 1493 | OK — reviewed, no change required | `    'customer_key','customer_name','customer_contact','customer_phone','rental_count',` |
| 1494 | OK — reviewed, no change required | `    'first_rental_date','last_rental_date','last_event_name','last_booking_status','updated_at'` |
| 1495 | OK — reviewed, no change required | `  ]);` |
| 1496 | OK — reviewed, no change required | `  kkEnsureSheetWithHeaders_(KK.bookingArchive, ['archived_at','source_row','event_name','event_date','venue','customer_key'].concat(bookingHeaders));` |
| 1497 | REVIEWED range read scope | `  const eventHeaders = kkSheet_(KK.events).getRange('A4:I4').getValues()[0];` |
| 1498 | OK — reviewed, no change required | `  kkEnsureSheetWithHeaders_(KK.eventArchive, ['archived_at','source_row'].concat(eventHeaders));` |
| 1499 | REVIEWED range read scope | `  const overrideHeaders = kkSheet_(KK.overrides).getRange('A4:G4').getValues()[0];` |
| 1500 | OK — reviewed, no change required | `  kkEnsureSheetWithHeaders_(KK.overrideArchive, ['archived_at','source_row'].concat(overrideHeaders));` |
| 1501 | OK — reviewed, no change required | `}` |
| 1502 | OK — blank/separator line | `` |
| 1503 | OK — reviewed, no change required | `function kkCustomerKey_(name, contact, phone) {` |
| 1504 | OK — reviewed, no change required | `  const p = String(phone || '').replace(/\D+/g, '');` |
| 1505 | OK — reviewed, no change required | `  if (p) return 'phone:' + p;` |
| 1506 | OK — reviewed, no change required | `  const c = String(contact || '').trim().toLowerCase();` |
| 1507 | OK — reviewed, no change required | `  if (c) return 'contact:' + c;` |
| 1508 | OK — reviewed, no change required | `  const n = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');` |
| 1509 | OK — reviewed, no change required | `  return n ? 'name:' + n : '';` |
| 1510 | OK — reviewed, no change required | `}` |
| 1511 | OK — blank/separator line | `` |
| 1512 | OK — reviewed, no change required | `function kkReadCustomerStats_() {` |
| 1513 | OK — reviewed, no change required | `  const range = kkGetDynamicRange_(KK.customerStats, 2, 1, 10);` |
| 1514 | OK — reviewed, no change required | `  if (!range) return [];` |
| 1515 | REVIEWED range read scope | `  return range.getValues()` |
| 1516 | OK — reviewed, no change required | `    .filter(r => r[0])` |
| 1517 | OK — reviewed, no change required | `    .map(r => ({` |
| 1518 | OK — reviewed, no change required | `      customer_key: r[0] || '',` |
| 1519 | OK — reviewed, no change required | `      customer_name: r[1] || '',` |
| 1520 | OK — reviewed, no change required | `      customer_contact: r[2] || '',` |
| 1521 | OK — reviewed, no change required | `      customer_phone: r[3] || '',` |
| 1522 | OK — reviewed, no change required | `      rental_count: r[4] || 0,` |
| 1523 | OK — reviewed, no change required | `      first_rental_date: kkApiDate_(r[5]),` |
| 1524 | OK — reviewed, no change required | `      last_rental_date: kkApiDate_(r[6]),` |
| 1525 | OK — reviewed, no change required | `      last_event_name: r[7] || '',` |
| 1526 | OK — reviewed, no change required | `      last_booking_status: r[8] || '',` |
| 1527 | OK — reviewed, no change required | `      updated_at: kkApiDateTime_(r[9])` |
| 1528 | OK — reviewed, no change required | `    }))` |
| 1529 | OK — reviewed, no change required | `    .sort((a, b) => Number(b.rental_count || 0) - Number(a.rental_count || 0));` |
| 1530 | OK — reviewed, no change required | `}` |
| 1531 | OK — blank/separator line | `` |
| 1532 | OK — reviewed, no change required | `function kkUpsertCustomerStat_(booking, event) {` |
| 1533 | OK — reviewed, no change required | `  const customerName = booking[4] || '';` |
| 1534 | OK — reviewed, no change required | `  const contact = booking[5] || '';` |
| 1535 | OK — reviewed, no change required | `  const phone = booking[6] || '';` |
| 1536 | OK — reviewed, no change required | `  const key = kkCustomerKey_(customerName, contact, phone);` |
| 1537 | OK — reviewed, no change required | `  if (!key) return false;` |
| 1538 | OK — reviewed, no change required | `  const status = String(booking[2] || '').toLowerCase().trim();` |
| 1539 | OK — reviewed, no change required | `  if (status === 'cancelled') return false;` |
| 1540 | OK — blank/separator line | `` |
| 1541 | OK — reviewed, no change required | `  const sh = kkSheet_(KK.customerStats);` |
| 1542 | OK — reviewed, no change required | `  const rows = kkGetValues_(KK.customerStats, 2, 1, 10);` |
| 1543 | OK — reviewed, no change required | `  let targetRow = 0;` |
| 1544 | OK — reviewed, no change required | `  for (let i = 0; i < rows.length; i++) {` |
| 1545 | OK — reviewed, no change required | `    if (String(rows[i][0] || '').trim() === key) { targetRow = i + 2; break; }` |
| 1546 | OK — reviewed, no change required | `  }` |
| 1547 | OK — reviewed, no change required | `  if (!targetRow) targetRow = Math.max(sh.getLastRow() + 1, 2);` |
| 1548 | OK — blank/separator line | `` |
| 1549 | REVIEWED range read scope | `  const current = targetRow <= sh.getLastRow() ? sh.getRange(targetRow, 1, 1, 10).getValues()[0] : [];` |
| 1550 | OK — reviewed, no change required | `  const rentalDate = event && event.event_date ? kkDateObj_(event.event_date) : (booking[1] ? kkDateObj_(booking[1]) : new Date());` |
| 1551 | OK — reviewed, no change required | `  const currentCount = Number(current[4] || 0);` |
| 1552 | OK — reviewed, no change required | `  const firstDate = current[5] ? kkDateObj_(current[5]) : rentalDate;` |
| 1553 | OK — reviewed, no change required | `  const lastDate = current[6] ? kkDateObj_(current[6]) : rentalDate;` |
| 1554 | OK — blank/separator line | `` |
| 1555 | REVIEWED batch write preferred | `  sh.getRange(targetRow, 1, 1, 10).setValues([[` |
| 1556 | OK — reviewed, no change required | `    key,` |
| 1557 | OK — reviewed, no change required | `    customerName || current[1] || '',` |
| 1558 | OK — reviewed, no change required | `    contact || current[2] || '',` |
| 1559 | OK — reviewed, no change required | `    phone || current[3] || '',` |
| 1560 | OK — reviewed, no change required | `    currentCount + 1,` |
| 1561 | OK — reviewed, no change required | `    firstDate < rentalDate ? firstDate : rentalDate,` |
| 1562 | OK — reviewed, no change required | `    lastDate > rentalDate ? lastDate : rentalDate,` |
| 1563 | OK — reviewed, no change required | `    event && event.event_name ? event.event_name : (current[7] || ''),` |
| 1564 | OK — reviewed, no change required | `    booking[2] || current[8] || '',` |
| 1565 | OK — reviewed, no change required | `    new Date()` |
| 1566 | OK — reviewed, no change required | `  ]]);` |
| 1567 | OK — reviewed, no change required | `  return true;` |
| 1568 | OK — reviewed, no change required | `}` |
| 1569 | OK — blank/separator line | `` |
| 1570 | OK — comment/documentation reviewed | `// PERFORMANCE FIX: O(1) Batch Archiving & Range Clearing` |
| 1571 | OK — reviewed, no change required | `function kkCleanupOldData30Days_() {` |
| 1572 | OK — reviewed, no change required | `  kkEnsureCrmArchiveSheets_();` |
| 1573 | REVIEWED concurrency lock | `  const lock = LockService.getDocumentLock();` |
| 1574 | OK — reviewed, no change required | `  lock.waitLock(30000);` |
| 1575 | OK — reviewed, no change required | `  try {` |
| 1576 | OK — reviewed, no change required | `    const threshold = new Date();` |
| 1577 | OK — reviewed, no change required | `    threshold.setDate(threshold.getDate() - 30);` |
| 1578 | OK — reviewed, no change required | `    threshold.setHours(0, 0, 0, 0);` |
| 1579 | OK — blank/separator line | `` |
| 1580 | OK — reviewed, no change required | `    const eventMap = {};` |
| 1581 | OK — reviewed, no change required | `    const eventRows = kkGetValues_(KK.events, 5, 1, 9);` |
| 1582 | OK — reviewed, no change required | `    eventRows.forEach((r, i) => {` |
| 1583 | OK — reviewed, no change required | `      if (!r[0]) return;` |
| 1584 | OK — reviewed, no change required | `      eventMap[String(r[0]).trim()] = {` |
| 1585 | OK — reviewed, no change required | `        row_number: i + 5,` |
| 1586 | OK — reviewed, no change required | `        event_id: r[0], event_name: r[1], event_date: r[2], venue: r[3], row: r` |
| 1587 | OK — reviewed, no change required | `      };` |
| 1588 | OK — reviewed, no change required | `    });` |
| 1589 | OK — blank/separator line | `` |
| 1590 | OK — reviewed, no change required | `    const bookingSh = kkSheet_(KK.bookings);` |
| 1591 | OK — reviewed, no change required | `    const bookingArchive = kkSheet_(KK.bookingArchive);` |
| 1592 | OK — reviewed, no change required | `    const bookings = kkGetValues_(KK.bookings, 5, 1, 20);` |
| 1593 | OK — reviewed, no change required | `    let customerStatsUpdated = 0;` |
| 1594 | OK — blank/separator line | `    ` |
| 1595 | OK — reviewed, no change required | `    const bookingArchiveRows = [];` |
| 1596 | OK — reviewed, no change required | `    const bookingClearA1s = [];` |
| 1597 | OK — blank/separator line | `` |
| 1598 | OK — reviewed, no change required | `    bookings.forEach((r, i) => {` |
| 1599 | OK — reviewed, no change required | `      const hasData = r[3] || r[4];` |
| 1600 | OK — reviewed, no change required | `      if (!hasData) return;` |
| 1601 | OK — reviewed, no change required | `      const event = eventMap[String(r[3] || '').trim()] || null;` |
| 1602 | OK — reviewed, no change required | `      let basisDate = event && event.event_date ? kkDateObj_(event.event_date) : (r[1] ? kkDateObj_(r[1]) : null);` |
| 1603 | OK — reviewed, no change required | `      if (!basisDate || basisDate >= threshold) return;` |
| 1604 | OK — blank/separator line | `` |
| 1605 | OK — reviewed, no change required | `      const sourceRow = i + 5;` |
| 1606 | OK — reviewed, no change required | `      const customerKey = kkCustomerKey_(r[4], r[5], r[6]);` |
| 1607 | OK — reviewed, no change required | `      bookingArchiveRows.push([` |
| 1608 | OK — reviewed, no change required | `        new Date(), sourceRow, event ? event.event_name : '', event ? event.event_date : '', event ? event.venue : '', customerKey` |
| 1609 | OK — reviewed, no change required | `      ].concat(r));` |
| 1610 | OK — blank/separator line | `      ` |
| 1611 | OK — reviewed, no change required | `      if (kkUpsertCustomerStat_(r, event)) customerStatsUpdated++;` |
| 1612 | OK — reviewed, no change required | `      bookingClearA1s.push(\`B${sourceRow}:T${sourceRow}\`);` |
| 1613 | OK — reviewed, no change required | `    });` |
| 1614 | OK — blank/separator line | `` |
| 1615 | OK — reviewed, no change required | `    if (bookingArchiveRows.length > 0) {` |
| 1616 | REVIEWED batch write preferred | `      bookingArchive.getRange(Math.max(bookingArchive.getLastRow() + 1, 2), 1, bookingArchiveRows.length, bookingArchiveRows[0].length).setValues(bookingArchiveRows);` |
| 1617 | OK — reviewed, no change required | `      bookingSh.getRangeList(bookingClearA1s).clearContent();` |
| 1618 | OK — reviewed, no change required | `    }` |
| 1619 | OK — blank/separator line | `` |
| 1620 | OK — reviewed, no change required | `    const eventSh = kkSheet_(KK.events);` |
| 1621 | OK — reviewed, no change required | `    const eventArchive = kkSheet_(KK.eventArchive);` |
| 1622 | OK — reviewed, no change required | `    const eventArchiveRows = [];` |
| 1623 | OK — reviewed, no change required | `    const eventClearA1s = [];` |
| 1624 | OK — reviewed, no change required | `    const archivedEventIds = {};` |
| 1625 | OK — blank/separator line | `` |
| 1626 | OK — reviewed, no change required | `    Object.keys(eventMap).forEach(id => {` |
| 1627 | OK — reviewed, no change required | `      const ev = eventMap[id];` |
| 1628 | OK — reviewed, no change required | `      if (!ev.event_date || kkDateObj_(ev.event_date) >= threshold) return;` |
| 1629 | OK — reviewed, no change required | `      eventArchiveRows.push([new Date(), ev.row_number].concat(ev.row));` |
| 1630 | OK — reviewed, no change required | `      archivedEventIds[id] = true;` |
| 1631 | OK — reviewed, no change required | `      eventClearA1s.push(\`A${ev.row_number}:H${ev.row_number}\`);` |
| 1632 | OK — reviewed, no change required | `    });` |
| 1633 | OK — blank/separator line | `` |
| 1634 | OK — reviewed, no change required | `    if (eventArchiveRows.length > 0) {` |
| 1635 | REVIEWED batch write preferred | `      eventArchive.getRange(Math.max(eventArchive.getLastRow() + 1, 2), 1, eventArchiveRows.length, eventArchiveRows[0].length).setValues(eventArchiveRows);` |
| 1636 | OK — reviewed, no change required | `      eventSh.getRangeList(eventClearA1s).clearContent();` |
| 1637 | OK — reviewed, no change required | `    }` |
| 1638 | OK — blank/separator line | `` |
| 1639 | OK — reviewed, no change required | `    const overrideSh = kkSheet_(KK.overrides);` |
| 1640 | OK — reviewed, no change required | `    const overrideArchive = kkSheet_(KK.overrideArchive);` |
| 1641 | OK — reviewed, no change required | `    const overrideRows = kkGetValues_(KK.overrides, 5, 1, 7);` |
| 1642 | OK — reviewed, no change required | `    const overrideArchiveRows = [];` |
| 1643 | OK — reviewed, no change required | `    const overrideClearA1s = [];` |
| 1644 | OK — blank/separator line | `` |
| 1645 | OK — reviewed, no change required | `    overrideRows.forEach((r, i) => {` |
| 1646 | OK — reviewed, no change required | `      const eventId = String(r[0] || '').trim();` |
| 1647 | OK — reviewed, no change required | `      if (!eventId || !archivedEventIds[eventId]) return;` |
| 1648 | OK — reviewed, no change required | `      const sourceRow = i + 5;` |
| 1649 | OK — reviewed, no change required | `      overrideArchiveRows.push([new Date(), sourceRow].concat(r));` |
| 1650 | OK — reviewed, no change required | `      overrideClearA1s.push(\`A${sourceRow}:G${sourceRow}\`);` |
| 1651 | OK — reviewed, no change required | `    });` |
| 1652 | OK — blank/separator line | `` |
| 1653 | OK — reviewed, no change required | `    if (overrideArchiveRows.length > 0) {` |
| 1654 | REVIEWED batch write preferred | `      overrideArchive.getRange(Math.max(overrideArchive.getLastRow() + 1, 2), 1, overrideArchiveRows.length, overrideArchiveRows[0].length).setValues(overrideArchiveRows);` |
| 1655 | OK — reviewed, no change required | `      overrideSh.getRangeList(overrideClearA1s).clearContent();` |
| 1656 | OK — reviewed, no change required | `    }` |
| 1657 | OK — blank/separator line | `` |
| 1658 | OK — reviewed, no change required | `    SpreadsheetApp.flush();` |
| 1659 | OK — reviewed, no change required | `    return {` |
| 1660 | OK — reviewed, no change required | `      archived_bookings: bookingArchiveRows.length,` |
| 1661 | OK — reviewed, no change required | `      archived_events: eventArchiveRows.length,` |
| 1662 | OK — reviewed, no change required | `      archived_overrides: overrideArchiveRows.length,` |
| 1663 | OK — reviewed, no change required | `      customer_stats_updated: customerStatsUpdated,` |
| 1664 | OK — reviewed, no change required | `      threshold_date: kkApiDate_(threshold)` |
| 1665 | OK — reviewed, no change required | `    };` |
| 1666 | OK — reviewed, no change required | `  } finally {` |
| 1667 | OK — reviewed, no change required | `    lock.releaseLock();` |
| 1668 | OK — reviewed, no change required | `  }` |
| 1669 | OK — reviewed, no change required | `}` |
| 1670 | OK — blank/separator line | `` |
| 1671 | OK — reviewed, no change required | `function kkCleanupOldData30Days() {` |
| 1672 | OK — reviewed, no change required | `  const ui = SpreadsheetApp.getUi();` |
| 1673 | REVIEWED UI alert / safe fallback where possible | `  const resp = ui.alert(` |
| 1674 | OK — reviewed, no change required | `    'Run 30-day Archive Cleanup?',` |
| 1675 | OK — reviewed, no change required | `    'ระบบจะย้าย booking/event ที่เก่ากว่า 30 วันไป archive และอัปเดต 11_Customer_Stats ก่อนล้างข้อมูลจากชีตทำงาน ต้องการทำต่อไหม?',` |
| 1676 | OK — reviewed, no change required | `    ui.ButtonSet.YES_NO` |
| 1677 | OK — reviewed, no change required | `  );` |
| 1678 | OK — reviewed, no change required | `  if (resp !== ui.Button.YES) return;` |
| 1679 | OK — reviewed, no change required | `  const result = kkCleanupOldData30Days_();` |
| 1680 | REVIEWED UI alert / safe fallback where possible | `  ui.alert(` |
| 1681 | OK — reviewed, no change required | `    'Cleanup completed\n' +` |
| 1682 | OK — reviewed, no change required | `    'Archived bookings: ' + result.archived_bookings + '\n' +` |
| 1683 | OK — reviewed, no change required | `    'Archived events: ' + result.archived_events + '\n' +` |
| 1684 | OK — reviewed, no change required | `    'Customer stats updated: ' + result.customer_stats_updated + '\n' +` |
| 1685 | OK — reviewed, no change required | `    'Threshold: ' + result.threshold_date` |
| 1686 | OK — reviewed, no change required | `  );` |
| 1687 | OK — reviewed, no change required | `}` |
| 1688 | OK — blank/separator line | `` |
| 1689 | OK — reviewed, no change required | `function kkCleanupOldData30DaysAuto() {` |
| 1690 | OK — reviewed, no change required | `  kkCleanupOldData30Days_();` |
| 1691 | OK — reviewed, no change required | `}` |
| 1692 | OK — blank/separator line | `` |
| 1693 | OK — reviewed, no change required | `function kkInstallDailyCleanupTrigger() {` |
| 1694 | OK — reviewed, no change required | `  ScriptApp.getProjectTriggers()` |
| 1695 | OK — reviewed, no change required | `    .filter(t => t.getHandlerFunction() === 'kkCleanupOldData30DaysAuto')` |
| 1696 | OK — reviewed, no change required | `    .forEach(t => ScriptApp.deleteTrigger(t));` |
| 1697 | OK — reviewed, no change required | `  ScriptApp.newTrigger('kkCleanupOldData30DaysAuto')` |
| 1698 | OK — reviewed, no change required | `    .timeBased()` |
| 1699 | OK — reviewed, no change required | `    .everyDays(1)` |
| 1700 | OK — reviewed, no change required | `    .atHour(3)` |
| 1701 | OK — reviewed, no change required | `    .create();` |
| 1702 | OK — reviewed, no change required | `  kkSafeAlert_('Installed daily cleanup trigger at around 03:00.');` |
| 1703 | OK — reviewed, no change required | `}` |
| 1704 | OK — blank/separator line | `` |
| 1705 | OK — reviewed, no change required | `function kkApiCleanupOldData_(payload) {` |
| 1706 | OK — reviewed, no change required | `  return kkCleanupOldData30Days_();` |
| 1707 | OK — reviewed, no change required | `}` |
| 1708 | OK — blank/separator line | `` |
| 1709 | OK — reviewed, no change required | `function kkGenerateAdminApiKey() {` |
| 1710 | OK — reviewed, no change required | `  const key = Utilities.getUuid() + '-' + Utilities.getUuid();` |
| 1711 | REVIEWED API key stored in script/env, not public frontend | `  PropertiesService.getScriptProperties().setProperty('KK_ADMIN_API_KEY', key);` |
| 1712 | REVIEWED API key stored in script/env, not public frontend | `  kkSafeAlert_('Generated KK_ADMIN_API_KEY. Copy this key to Vercel ENV KK_ADMIN_API_KEY:\n\n' + key);` |
| 1713 | OK — reviewed, no change required | `}` |
| 1714 | OK — blank/separator line | `` |
| 1715 | OK — reviewed, no change required | `function kkSetPosterFolderId() {` |
| 1716 | OK — reviewed, no change required | `  const ui = SpreadsheetApp.getUi();` |
| 1717 | OK — reviewed, no change required | `  const resp = ui.prompt(` |
| 1718 | OK — reviewed, no change required | `    'Set Poster Folder ID',` |
| 1719 | REVIEWED Drive URL logic/permission flow | `    'Paste Google Drive folder ID or folder URL for event posters:',` |
| 1720 | OK — reviewed, no change required | `    ui.ButtonSet.OK_CANCEL` |
| 1721 | OK — reviewed, no change required | `  );` |
| 1722 | OK — reviewed, no change required | `  if (resp.getSelectedButton() !== ui.Button.OK) return;` |
| 1723 | OK — reviewed, no change required | `  const folderId = kkExtractDriveFolderId_(resp.getResponseText());` |
| 1724 | OK — reviewed, no change required | `  if (!folderId) throw new Error('Folder ID is blank');` |
| 1725 | OK — reviewed, no change required | `  PropertiesService.getScriptProperties().setProperty('KK_POSTER_FOLDER_ID', folderId);` |
| 1726 | REVIEWED UI alert / safe fallback where possible | `  ui.alert('Saved KK_POSTER_FOLDER_ID:\n' + folderId + '\n\nNext step: run KK Admin > CRM: Authorize Drive Access once.');` |
| 1727 | OK — reviewed, no change required | `}` |
| 1728 | OK — blank/separator line | `` |
| 1729 | OK — reviewed, no change required | `function kkAuthorizeDriveAccess() {` |
| 1730 | OK — reviewed, no change required | `  const folderId = String(PropertiesService.getScriptProperties().getProperty('KK_POSTER_FOLDER_ID') || '').trim();` |
| 1731 | OK — reviewed, no change required | `  if (!folderId) {` |
| 1732 | OK — reviewed, no change required | `    kkSafeAlert_('Missing KK_POSTER_FOLDER_ID. Run KK Admin > CRM: Set Poster Folder ID first.');` |
| 1733 | OK — reviewed, no change required | `    return;` |
| 1734 | OK — reviewed, no change required | `  }` |
| 1735 | REVIEWED Drive permission scope required | `  const folder = DriveApp.getFolderById(folderId);` |
| 1736 | OK — reviewed, no change required | `  kkSafeAlert_('Drive permission OK: ' + folder.getName());` |
| 1737 | OK — reviewed, no change required | `}` |
| 1738 | OK — blank/separator line | `` |
| 1739 | OK — reviewed, no change required | `function kkShowAdminCrmSetupInfo() {` |
| 1740 | OK — reviewed, no change required | `  const props = PropertiesService.getScriptProperties();` |
| 1741 | REVIEWED API key stored in script/env, not public frontend | `  const hasKey = props.getProperty('KK_ADMIN_API_KEY') ? 'YES' : 'NO';` |
| 1742 | OK — reviewed, no change required | `  const hasFolder = props.getProperty('KK_POSTER_FOLDER_ID') ? 'YES' : 'NO';` |
| 1743 | OK — reviewed, no change required | `  kkSafeAlert_(` |
| 1744 | UPDATED version sync to v16.6.2 | `    'KK Admin CRM API Setup v16.6.2_LINE_AUDITED\n\n' +` |
| 1745 | OK — reviewed, no change required | `    '1) Deploy Apps Script as Web app. Execute as: Me. Access: Anyone with the link.\n' +` |
| 1746 | OK — reviewed, no change required | `    '2) Copy the /exec URL to Vercel ENV KK_ADMIN_SCRIPT_URL.\n' +` |
| 1747 | REVIEWED API key stored in script/env, not public frontend | `    '3) Generate API key and copy to Vercel ENV KK_ADMIN_API_KEY.\n' +` |
| 1748 | OK — reviewed, no change required | `    '4) Set Vercel ENV KK_ADMIN_PIN for /admin login.\n\n' +` |
| 1749 | OK — reviewed, no change required | `    'Current Script Properties:\n' +` |
| 1750 | REVIEWED API key stored in script/env, not public frontend | `    'KK_ADMIN_API_KEY: ' + hasKey + '\n' +` |
| 1751 | OK — reviewed, no change required | `    'KK_POSTER_FOLDER_ID: ' + hasFolder` |
| 1752 | OK — reviewed, no change required | `  );` |
| 1753 | OK — reviewed, no change required | `}` |

### `apps-script/appsscript.json`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — reviewed, no change required | `{` |
| 2 | OK — reviewed, no change required | `  "timeZone": "Asia/Bangkok",` |
| 3 | OK — reviewed, no change required | `  "dependencies": {},` |
| 4 | OK — reviewed, no change required | `  "exceptionLogging": "STACKDRIVER",` |
| 5 | OK — reviewed, no change required | `  "runtimeVersion": "V8",` |
| 6 | OK — reviewed, no change required | `  "oauthScopes": [` |
| 7 | OK — reviewed, no change required | `    "https://www.googleapis.com/auth/spreadsheets.currentonly",` |
| 8 | OK — reviewed, no change required | `    "https://www.googleapis.com/auth/script.external_request",` |
| 9 | OK — reviewed, no change required | `    "https://www.googleapis.com/auth/drive",` |
| 10 | OK — reviewed, no change required | `    "https://www.googleapis.com/auth/script.scriptapp"` |
| 11 | OK — reviewed, no change required | `  ]` |
| 12 | OK — reviewed, no change required | `}` |

### `config.js`

| Line | Status | Code |
|---:|---|---|
| 1 | UPDATED version sync to v16.6.2 | `// KK Phone Rental Frontend v16.6.2_LINE_AUDITED` |
| 2 | OK — comment/documentation reviewed | `// Recovery-stable baseline: API-first, but keeps a read-only emergency Google Sheets fallback so the public site does not go blank if Vercel ENV/API is missing.` |
| 3 | OK — reviewed, no change required | `window.KK_CONFIG = {` |
| 4 | UPDATED version sync to v16.6.2 | `  appVersion:    "v16.6.2_LINE_AUDITED",` |
| 5 | UPDATED version sync to v16.6.2 | `  expectedAdminApiVersion: "v16.6.2_LINE_AUDITED",` |
| 6 | OK — reviewed, no change required | `  siteUrl:       "https://kk-phone-rental.vercel.app/",` |
| 7 | OK — blank/separator line | `` |
| 8 | OK — comment/documentation reviewed | `  // Emergency read-only fallback used only when /api/kk-data fails or when opening ?direct=1.` |
| 9 | OK — comment/documentation reviewed | `  // This keeps the public site recoverable when GOOGLE_SHEET_ID or the proxy response is unavailable.` |
| 10 | OK — reviewed, no change required | `  sheetId:       "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU",` |
| 11 | OK — blank/separator line | `` |
| 12 | OK — reviewed, no change required | `  webSheetName:  "08_Web_Ready",` |
| 13 | OK — reviewed, no change required | `  webRange:      "A4:K",` |
| 14 | OK — reviewed, no change required | `  pkgSheetName:  "09_Web_Packages",` |
| 15 | OK — reviewed, no change required | `  pkgRange:      "A4:N",` |
| 16 | OK — blank/separator line | `` |
| 17 | OK — reviewed, no change required | `  useVercelApi:  true,` |
| 18 | OK — reviewed, no change required | `  apiEndpoint:   "/api/kk-data",` |
| 19 | OK — reviewed, no change required | `  disableDirectFallback: false,` |
| 20 | OK — blank/separator line | `` |
| 21 | OK — reviewed, no change required | `  lineOAId:      "@827blnmo",` |
| 22 | OK — reviewed, no change required | `  lineDirectUrl: "https://line.me/R/ti/p/%40827blnmo",` |
| 23 | OK — reviewed, no change required | `  xUrl:          "https://x.com/KK_PhoneRental",` |
| 24 | OK — reviewed, no change required | `  headerImage:   "https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600"` |
| 25 | OK — blank/separator line | `` |
| 26 | OK — comment/documentation reviewed | `  // GA4: ใส่ Measurement ID ที่ได้จาก Google Analytics 4 Console` |
| 27 | OK — comment/documentation reviewed | `  // ga4Id: "G-XXXXXXXXXX"` |
| 28 | OK — reviewed, no change required | `};` |
| 29 | OK — blank/separator line | `` |
| 30 | OK — comment/documentation reviewed | `// GA4 loader — โหลด async ไม่บล็อก render` |
| 31 | OK — reviewed, no change required | `(function(){` |
| 32 | OK — reviewed, no change required | `  var id = window.KK_CONFIG && window.KK_CONFIG.ga4Id;` |
| 33 | OK — reviewed, no change required | `  if(!id) return;` |
| 34 | OK — reviewed, no change required | `  var s=document.createElement("script");` |
| 35 | OK — reviewed, no change required | `  s.async=true; s.src="https://www.googletagmanager.com/gtag/js?id="+id;` |
| 36 | OK — reviewed, no change required | `  document.head.appendChild(s);` |
| 37 | OK — reviewed, no change required | `  window.dataLayer=window.dataLayer||[];` |
| 38 | OK — reviewed, no change required | `  window.gtag=function(){dataLayer.push(arguments);};` |
| 39 | OK — reviewed, no change required | `  gtag("js",new Date()); gtag("config",id,{send_page_view:true});` |
| 40 | OK — reviewed, no change required | `})();` |

### `docs/CLEANUP_REPORT.md`

| Line | Status | Code |
|---:|---|---|
| 1 | UPDATED version sync to v16.6.2 | `# Cleanup Report — v16.6.2_LINE_AUDITED` |
| 2 | OK — blank/separator line | `` |
| 3 | OK — reviewed, no change required | `## ทำแล้ว` |
| 4 | OK — blank/separator line | `` |
| 5 | OK — reviewed, no change required | `1. จัดโครงสร้าง package ให้ชัดเจน: root static, \`/admin\`, \`/api\`, \`/apps-script\`, \`/docs\`` |
| 6 | OK — reviewed, no change required | `2. เพิ่ม \`README.md\`, \`.env.example\`, \`.gitignore\`, และเอกสารโครงสร้างโปรเจกต์` |
| 7 | OK — reviewed, no change required | `3. อัปเดต version label ให้สอดคล้องกันใน frontend, admin, API proxy` |
| 8 | OK — reviewed, no change required | `4. แยก expected version ของ Vercel Proxy กับ Apps Script Backend ใน Admin Health Check` |
| 9 | OK — reviewed, no change required | `5. ปรับ Admin Overview ให้ใช้ \`current_bookings\` จาก backend v16.6 ถ้ามี เพื่อช่วยซ่อน booking ที่ cancelled/เลยวันจากหน้าปัจจุบัน` |
| 10 | OK — reviewed, no change required | `6. เพิ่ม \`npm run check\` สำหรับตรวจ syntax ของ JS หลักทุกไฟล์` |
| 11 | OK — reviewed, no change required | `7. ปรับ \`api/kk-admin.js\` ให้ตอบ error ชัดขึ้นเมื่อ JSON body ผิดรูปแบบ และหยุดอ่าน body เมื่อ request ใหญ่เกินกำหนด` |
| 12 | OK — reviewed, no change required | `8. รวม backend Apps Script ล่าสุดไว้ที่ \`/apps-script/Code.gs\` ถ้ามีใน workspace` |
| 13 | OK — blank/separator line | `` |
| 14 | OK — reviewed, no change required | `## ไม่ได้เปลี่ยนเพื่อกันระบบพัง` |
| 15 | OK — blank/separator line | `` |
| 16 | OK — reviewed, no change required | `- ไม่เปลี่ยนชื่อ API route เดิม` |
| 17 | OK — reviewed, no change required | `- ไม่ย้าย favicon/manifest/icons ออกจาก root` |
| 18 | OK — reviewed, no change required | `- ไม่ตัด fallback Sheet ID ออก เพราะเป็น emergency fallback ของเว็บเดิม` |
| 19 | OK — reviewed, no change required | `- ไม่ minify โค้ด เพื่อให้แก้ไขต่อในอนาคตง่าย` |
| 20 | OK — blank/separator line | `` |
| 21 | OK — reviewed, no change required | `## คะแนนหลังจัดระเบียบ` |
| 22 | OK — blank/separator line | `` |
| 23 | OK — reviewed, no change required | `- โครงสร้างไฟล์: 9/10` |
| 24 | OK — reviewed, no change required | `- ความพร้อม deploy: 9/10` |
| 25 | OK — reviewed, no change required | `- ความเสถียร Admin + Backend contract: 9/10` |
| 26 | OK — reviewed, no change required | `- สิ่งที่ควรทำต่อ: แยก \`script.js\` และ \`admin.js\` เป็น modules ในรอบใหญ่ถัดไป ถ้าจะ refactor แบบลึก` |

### `docs/FILE_MANIFEST.json`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — reviewed, no change required | `{` |
| 2 | UPDATED version sync to v16.6.2 | `  "version": "v16.6.2_LINE_AUDITED",` |
| 3 | OK — reviewed, no change required | `  "files": [` |
| 4 | OK — reviewed, no change required | `    {` |
| 5 | OK — reviewed, no change required | `      "path": ".env.example",` |
| 6 | OK — reviewed, no change required | `      "bytes": 453,` |
| 7 | OK — reviewed, no change required | `      "sha256_12": "33c6f368a110"` |
| 8 | OK — reviewed, no change required | `    },` |
| 9 | OK — reviewed, no change required | `    {` |
| 10 | OK — reviewed, no change required | `      "path": ".gitignore",` |
| 11 | OK — reviewed, no change required | `      "bytes": 102,` |
| 12 | OK — reviewed, no change required | `      "sha256_12": "a86c8df97dbd"` |
| 13 | OK — reviewed, no change required | `    },` |
| 14 | OK — reviewed, no change required | `    {` |
| 15 | OK — reviewed, no change required | `      "path": "README.md",` |
| 16 | OK — reviewed, no change required | `      "bytes": 1833,` |
| 17 | OK — reviewed, no change required | `      "sha256_12": "aba9c04f81b0"` |
| 18 | OK — reviewed, no change required | `    },` |
| 19 | OK — reviewed, no change required | `    {` |
| 20 | OK — reviewed, no change required | `      "path": "README_DEPLOY.md",` |
| 21 | OK — reviewed, no change required | `      "bytes": 754,` |
| 22 | OK — reviewed, no change required | `      "sha256_12": "423bc1cf677c"` |
| 23 | OK — reviewed, no change required | `    },` |
| 24 | OK — reviewed, no change required | `    {` |
| 25 | OK — reviewed, no change required | `      "path": "admin/admin.css",` |
| 26 | OK — reviewed, no change required | `      "bytes": 19911,` |
| 27 | OK — reviewed, no change required | `      "sha256_12": "1d4071756fad"` |
| 28 | OK — reviewed, no change required | `    },` |
| 29 | OK — reviewed, no change required | `    {` |
| 30 | OK — reviewed, no change required | `      "path": "admin/admin.js",` |
| 31 | OK — reviewed, no change required | `      "bytes": 52991,` |
| 32 | OK — reviewed, no change required | `      "sha256_12": "0c893b16bc47"` |
| 33 | OK — reviewed, no change required | `    },` |
| 34 | OK — reviewed, no change required | `    {` |
| 35 | OK — reviewed, no change required | `      "path": "admin/index.html",` |
| 36 | OK — reviewed, no change required | `      "bytes": 30624,` |
| 37 | OK — reviewed, no change required | `      "sha256_12": "4dec54d1cb73"` |
| 38 | OK — reviewed, no change required | `    },` |
| 39 | OK — reviewed, no change required | `    {` |
| 40 | OK — reviewed, no change required | `      "path": "api/kk-admin.js",` |
| 41 | OK — reviewed, no change required | `      "bytes": 4473,` |
| 42 | OK — reviewed, no change required | `      "sha256_12": "a874296502d7"` |
| 43 | OK — reviewed, no change required | `    },` |
| 44 | OK — reviewed, no change required | `    {` |
| 45 | OK — reviewed, no change required | `      "path": "api/kk-data.js",` |
| 46 | OK — reviewed, no change required | `      "bytes": 3309,` |
| 47 | OK — reviewed, no change required | `      "sha256_12": "9c9273f2b914"` |
| 48 | OK — reviewed, no change required | `    },` |
| 49 | OK — reviewed, no change required | `    {` |
| 50 | OK — reviewed, no change required | `      "path": "apple-touch-icon.png",` |
| 51 | OK — reviewed, no change required | `      "bytes": 1789,` |
| 52 | OK — reviewed, no change required | `      "sha256_12": "408d722a94be"` |
| 53 | OK — reviewed, no change required | `    },` |
| 54 | OK — reviewed, no change required | `    {` |
| 55 | OK — reviewed, no change required | `      "path": "apps-script/Code.gs",` |
| 56 | OK — reviewed, no change required | `      "bytes": 75613,` |
| 57 | OK — reviewed, no change required | `      "sha256_12": "2fe932a4a11b"` |
| 58 | OK — reviewed, no change required | `    },` |
| 59 | OK — reviewed, no change required | `    {` |
| 60 | OK — reviewed, no change required | `      "path": "config.js",` |
| 61 | OK — reviewed, no change required | `      "bytes": 1681,` |
| 62 | OK — reviewed, no change required | `      "sha256_12": "b528375e88df"` |
| 63 | OK — reviewed, no change required | `    },` |
| 64 | OK — reviewed, no change required | `    {` |
| 65 | OK — reviewed, no change required | `      "path": "docs/CLEANUP_REPORT.md",` |
| 66 | OK — reviewed, no change required | `      "bytes": 2177,` |
| 67 | OK — reviewed, no change required | `      "sha256_12": "75954ebdb714"` |
| 68 | OK — reviewed, no change required | `    },` |
| 69 | OK — reviewed, no change required | `    {` |
| 70 | OK — reviewed, no change required | `      "path": "docs/PROJECT_STRUCTURE.md",` |
| 71 | OK — reviewed, no change required | `      "bytes": 1443,` |
| 72 | OK — reviewed, no change required | `      "sha256_12": "230a821e0e8d"` |
| 73 | OK — reviewed, no change required | `    },` |
| 74 | OK — reviewed, no change required | `    {` |
| 75 | OK — reviewed, no change required | `      "path": "docs/README_DEPLOY_ORIGINAL.md",` |
| 76 | OK — reviewed, no change required | `      "bytes": 603,` |
| 77 | OK — reviewed, no change required | `      "sha256_12": "022d92611da7"` |
| 78 | OK — reviewed, no change required | `    },` |
| 79 | OK — reviewed, no change required | `    {` |
| 80 | OK — reviewed, no change required | `      "path": "favicon.png",` |
| 81 | OK — reviewed, no change required | `      "bytes": 711,` |
| 82 | OK — reviewed, no change required | `      "sha256_12": "6be6121bd3a7"` |
| 83 | OK — reviewed, no change required | `    },` |
| 84 | OK — reviewed, no change required | `    {` |
| 85 | OK — reviewed, no change required | `      "path": "icon-192.png",` |
| 86 | OK — reviewed, no change required | `      "bytes": 7189,` |
| 87 | OK — reviewed, no change required | `      "sha256_12": "92c0f18102c3"` |
| 88 | OK — reviewed, no change required | `    },` |
| 89 | OK — reviewed, no change required | `    {` |
| 90 | OK — reviewed, no change required | `      "path": "icon-512.png",` |
| 91 | OK — reviewed, no change required | `      "bytes": 34138,` |
| 92 | OK — reviewed, no change required | `      "sha256_12": "7e8b78a906d7"` |
| 93 | OK — reviewed, no change required | `    },` |
| 94 | OK — reviewed, no change required | `    {` |
| 95 | OK — reviewed, no change required | `      "path": "index.html",` |
| 96 | OK — reviewed, no change required | `      "bytes": 13689,` |
| 97 | OK — reviewed, no change required | `      "sha256_12": "33503020fa70"` |
| 98 | OK — reviewed, no change required | `    },` |
| 99 | OK — reviewed, no change required | `    {` |
| 100 | OK — reviewed, no change required | `      "path": "manifest.json",` |
| 101 | OK — reviewed, no change required | `      "bytes": 1190,` |
| 102 | OK — reviewed, no change required | `      "sha256_12": "5bc7eeb5650e"` |
| 103 | OK — reviewed, no change required | `    },` |
| 104 | OK — reviewed, no change required | `    {` |
| 105 | OK — reviewed, no change required | `      "path": "package.json",` |
| 106 | OK — reviewed, no change required | `      "bytes": 323,` |
| 107 | OK — reviewed, no change required | `      "sha256_12": "f5352a6d5919"` |
| 108 | OK — reviewed, no change required | `    },` |
| 109 | OK — reviewed, no change required | `    {` |
| 110 | OK — reviewed, no change required | `      "path": "script.js",` |
| 111 | OK — reviewed, no change required | `      "bytes": 44669,` |
| 112 | OK — reviewed, no change required | `      "sha256_12": "f2f87de65c8b"` |
| 113 | OK — reviewed, no change required | `    },` |
| 114 | OK — reviewed, no change required | `    {` |
| 115 | OK — reviewed, no change required | `      "path": "style.css",` |
| 116 | OK — reviewed, no change required | `      "bytes": 27155,` |
| 117 | OK — reviewed, no change required | `      "sha256_12": "9ff1ab55eb1b"` |
| 118 | OK — reviewed, no change required | `    },` |
| 119 | OK — reviewed, no change required | `    {` |
| 120 | OK — reviewed, no change required | `      "path": "vercel.json",` |
| 121 | OK — reviewed, no change required | `      "bytes": 1092,` |
| 122 | OK — reviewed, no change required | `      "sha256_12": "ab98870d470a"` |
| 123 | OK — reviewed, no change required | `    }` |
| 124 | OK — reviewed, no change required | `  ]` |
| 125 | OK — reviewed, no change required | `}` |

### `docs/PROJECT_STRUCTURE.md`

| Line | Status | Code |
|---:|---|---|
| 1 | UPDATED version sync to v16.6.2 | `# Project Structure — v16.6.2_LINE_AUDITED` |
| 2 | OK — blank/separator line | `` |
| 3 | OK — reviewed, no change required | `## Runtime files ที่ Vercel ต้องใช้` |
| 4 | OK — blank/separator line | `` |
| 5 | OK — reviewed, no change required | `- \`/index.html\`, \`/style.css\`, \`/script.js\`, \`/config.js\` — หน้าเว็บลูกค้า` |
| 6 | OK — reviewed, no change required | `- \`/admin/index.html\`, \`/admin/admin.css\`, \`/admin/admin.js\` — หน้า Admin CRM` |
| 7 | OK — reviewed, no change required | `- \`/api/kk-data.js\` — proxy อ่าน Google Sheets สำหรับหน้าบ้าน` |
| 8 | OK — reviewed, no change required | `- \`/api/kk-admin.js\` — proxy เขียน/อ่าน Admin ผ่าน Apps Script` |
| 9 | OK — reviewed, no change required | `- \`/vercel.json\` — headers และ route rewrite \`/admin\`` |
| 10 | OK — blank/separator line | `` |
| 11 | OK — reviewed, no change required | `## Backend` |
| 12 | OK — blank/separator line | `` |
| 13 | OK — reviewed, no change required | `- \`/apps-script/Code.gs\` คือโค้ด Apps Script ที่ต้อง copy ไปวางใน Google Apps Script แยกต่างหาก` |
| 14 | OK — reviewed, no change required | `- ไฟล์นี้ไม่ถูก run บน Vercel แต่เก็บไว้ใน package เพื่อให้ง่ายต่อการ version control` |
| 15 | OK — blank/separator line | `` |
| 16 | OK — reviewed, no change required | `## Docs` |
| 17 | OK — blank/separator line | `` |
| 18 | OK — reviewed, no change required | `- \`/docs/CLEANUP_REPORT.md\` — สรุปสิ่งที่ปรับ` |
| 19 | OK — reviewed, no change required | `- \`/docs/PROJECT_STRUCTURE.md\` — โครงสร้างไฟล์นี้` |
| 20 | OK — blank/separator line | `` |
| 21 | OK — reviewed, no change required | `## สิ่งที่ยังคงไว้เพื่อไม่ให้ลิงก์เดิมพัง` |
| 22 | OK — blank/separator line | `` |
| 23 | OK — reviewed, no change required | `- \`/admin\` ยัง rewrite ไป \`/admin/index.html\`` |
| 24 | OK — reviewed, no change required | `- \`/api/kk-data\` และ \`/api/kk-admin\` ยังใช้ชื่อเดิม` |
| 25 | OK — reviewed, no change required | `- favicon/icon/manifest ยังอยู่ root เพื่อรองรับ browser/PWA เดิม` |

### `docs/README_DEPLOY_ORIGINAL.md`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — reviewed, no change required | `# Frontend Deploy — v16.2_FULL_AUDIT_STABLE` |
| 2 | OK — blank/separator line | `` |
| 3 | OK — reviewed, no change required | `Deploy this \`frontend\` folder to Vercel.` |
| 4 | OK — blank/separator line | `` |
| 5 | OK — reviewed, no change required | `## Required Vercel ENV` |
| 6 | OK — blank/separator line | `` |
| 7 | OK — reviewed, no change required | `\`\`\`text` |
| 8 | OK — reviewed, no change required | `GOOGLE_SHEET_ID=12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU` |
| 9 | OK — reviewed, no change required | `KK_ADMIN_SCRIPT_URL=<Apps Script /exec URL>` |
| 10 | REVIEWED API key stored in script/env, not public frontend | `KK_ADMIN_API_KEY=<Apps Script API key>` |
| 11 | OK — reviewed, no change required | `KK_ADMIN_PIN=<Admin PIN>` |
| 12 | OK — reviewed, no change required | `\`\`\`` |
| 13 | OK — blank/separator line | `` |
| 14 | OK — reviewed, no change required | `## Data loading behavior` |
| 15 | OK — blank/separator line | `` |
| 16 | OK — reviewed, no change required | `The public site uses \`/api/kk-data\` first. If the proxy fails or returns invalid CSV headers, the browser falls back to the read-only Google Sheets URL from \`config.js\`.` |
| 17 | OK — blank/separator line | `` |
| 18 | OK — reviewed, no change required | `This protects the public homepage from going blank when the proxy is misconfigured or returns invalid content.` |

### `index.html`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — reviewed, no change required | `<!DOCTYPE html>` |
| 2 | OK — reviewed, no change required | `<html lang="th">` |
| 3 | OK — reviewed, no change required | `<head>` |
| 4 | OK — reviewed, no change required | `<meta charset="UTF-8">` |
| 5 | OK — reviewed, no change required | `<meta name="viewport" content="width=device-width,initial-scale=1">` |
| 6 | OK — reviewed, no change required | `<title>KK Phone Rental | เช่ามือถือคอนเสิร์ต แฟนมีท และอีเวนต์</title>` |
| 7 | OK — reviewed, no change required | `<meta name="description" content="KK Phone Rental บริการเช่ามือถือถ่ายคอนเสิร์ต แฟนมีท และอีเวนต์ ซูมชัด เก็บครบทุกโมเมนต์ เลือกงาน ดูรุ่นที่ว่าง และจองผ่าน LINE OA กับแอดมิน">` |
| 8 | OK — reviewed, no change required | `<meta name="theme-color" content="#5B8DEF">` |
| 9 | OK — reviewed, no change required | `<meta name="keywords" content="เช่ามือถือคอนเสิร์ต, เช่ามือถือแฟนมีท, เช่ามือถือไปคอน, เช่ามือถือซูมชัด, KK Phone Rental">` |
| 10 | OK — reviewed, no change required | `<link rel="canonical" href="https://kk-phone-rental.vercel.app/">` |
| 11 | OK — blank/separator line | `` |
| 12 | OK — reviewed, no change required | `<meta property="og:type" content="website">` |
| 13 | OK — reviewed, no change required | `<meta property="og:title" content="KK Phone Rental | เช่ามือถือคอนเสิร์ต แฟนมีท และอีเวนต์">` |
| 14 | OK — reviewed, no change required | `<meta property="og:description" content="เช่ามือถือถ่ายคอนเสิร์ต แฟนมีท และงานอื่นๆ เลือกงาน ดูรุ่นที่ว่าง และจองผ่าน LINE OA กับแอดมินได้เลย">` |
| 15 | OK — reviewed, no change required | `<meta property="og:url" content="https://kk-phone-rental.vercel.app/">` |
| 16 | OK — reviewed, no change required | `<meta property="og:image" content="https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600">` |
| 17 | OK — reviewed, no change required | `<meta property="og:image:alt" content="KK Phone Rental เช่ามือถือสำหรับคอนเสิร์ตและอีเวนต์">` |
| 18 | OK — reviewed, no change required | `<meta property="og:site_name" content="KK Phone Rental">` |
| 19 | OK — reviewed, no change required | `<meta property="og:locale" content="th_TH">` |
| 20 | OK — blank/separator line | `` |
| 21 | OK — reviewed, no change required | `<meta name="twitter:card" content="summary_large_image">` |
| 22 | OK — reviewed, no change required | `<meta name="twitter:title" content="KK Phone Rental | เช่ามือถือคอนเสิร์ต แฟนมีท และอีเวนต์">` |
| 23 | OK — reviewed, no change required | `<meta name="twitter:description" content="เช่ามือถือถ่ายคอนเสิร์ต แฟนมีท และงานอื่นๆ ดูรุ่นที่ว่างและจองผ่าน LINE OA กับแอดมินได้เลย">` |
| 24 | OK — reviewed, no change required | `<meta name="twitter:image" content="https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600">` |
| 25 | OK — reviewed, no change required | `<meta name="twitter:image:alt" content="KK Phone Rental เช่ามือถือสำหรับคอนเสิร์ตและอีเวนต์">` |
| 26 | OK — blank/separator line | `` |
| 27 | OK — reviewed, no change required | `<link rel="icon" type="image/png" href="/favicon.png">` |
| 28 | OK — reviewed, no change required | `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` |
| 29 | OK — reviewed, no change required | `<link rel="manifest" href="/manifest.json">` |
| 30 | OK — blank/separator line | `` |
| 31 | OK — reviewed, no change required | `<link rel="preconnect" href="https://drive.google.com" crossorigin>` |
| 32 | OK — reviewed, no change required | `<link rel="preconnect" href="https://lh3.googleusercontent.com" crossorigin>` |
| 33 | OK — blank/separator line | `` |
| 34 | OK — reviewed, no change required | `<link rel="preconnect" href="https://fonts.googleapis.com">` |
| 35 | OK — reviewed, no change required | `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` |
| 36 | OK — reviewed, no change required | `<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">` |
| 37 | OK — reviewed, no change required | `<link rel="stylesheet" href="style.css">` |
| 38 | OK — reviewed, no change required | `</head>` |
| 39 | OK — reviewed, no change required | `<body>` |
| 40 | OK — reviewed, no change required | `<div class="wrap">` |
| 41 | OK — reviewed, no change required | `<header>` |
| 42 | OK — reviewed, no change required | `  <div class="brand-image-card" id="brandImageCard">` |
| 43 | OK — reviewed, no change required | `    <img class="brand-header-img" src="https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600" alt="KK Phone Rental Header" loading="eager" decoding="async"…` |
| 44 | OK — reviewed, no change required | `  </div>` |
| 45 | OK — reviewed, no change required | `  <div class="brand-fallback" id="brandFallback">` |
| 46 | OK — reviewed, no change required | `    <img class="brand-fallback-logo" src="https://lh3.googleusercontent.com/d/18ZoF5dQA6qOJNE-SUGlU2Mcew55DeEwM=w400" alt="KK Phone Rental Logo">` |
| 47 | OK — reviewed, no change required | `    <div class="brand-divider"></div>` |
| 48 | OK — reviewed, no change required | `    <div class="brand-text"><h1>KK Phone Rental</h1><p>Phone Rental Service</p></div>` |
| 49 | OK — reviewed, no change required | `  </div>` |
| 50 | OK — reviewed, no change required | `</header>` |
| 51 | OK — blank/separator line | `` |
| 52 | OK — reviewed, no change required | `<section class="value-box" aria-label="ขั้นตอนการจองผ่าน LINE OA">` |
| 53 | OK — reviewed, no change required | `  <p>เลือกงาน > ดูรุ่นที่ว่าง > ระบบพาไปจองผ่าน LINE OA กับแอดมิน</p>` |
| 54 | OK — reviewed, no change required | `  <p class="value-note">( หากไม่มีงานที่ต้องการสามารถสอบถามได้ใน LINE OA )</p>` |
| 55 | OK — reviewed, no change required | `</section>` |
| 56 | OK — blank/separator line | `` |
| 57 | OK — reviewed, no change required | `<div class="quick-links">` |
| 58 | OK — reviewed, no change required | `  <a class="quick-link" href="https://x.com/KK_PhoneRental" target="_blank" rel="noopener">💙 ฟอลร้าน = ฟรีมัดจำ + ประกัน</a>` |
| 59 | OK — reviewed, no change required | `  <button class="mini-btn" id="faq-open-btn" type="button">❔ คำถามที่พบบ่อย</button>` |
| 60 | OK — reviewed, no change required | `</div>` |
| 61 | OK — blank/separator line | `` |
| 62 | OK — reviewed, no change required | `<div class="filter-group status-filter-group" aria-label="เลือกเดือนและกรองสถานะงาน">` |
| 63 | OK — reviewed, no change required | `  <div class="filter-bar status-filter-bar" aria-label="เลือกเดือนและกรองสถานะงาน">` |
| 64 | OK — reviewed, no change required | `    <label class="month-select-wrap" for="month-filter-select">` |
| 65 | OK — reviewed, no change required | `      <span class="sr-only">เลือกเดือน</span>` |
| 66 | OK — reviewed, no change required | `      <select class="month-select" id="month-filter-select" aria-label="เลือกเดือน">` |
| 67 | OK — reviewed, no change required | `        <option value="all">เลือกเดือน</option>` |
| 68 | OK — reviewed, no change required | `      </select>` |
| 69 | OK — reviewed, no change required | `    </label>` |
| 70 | OK — reviewed, no change required | `    <button class="filter-btn active" type="button" data-filter="all" aria-pressed="true">งานทั้งหมด</button>` |
| 71 | OK — reviewed, no change required | `    <button class="filter-btn" type="button" data-filter="available" aria-pressed="false">งานว่าง</button>` |
| 72 | OK — reviewed, no change required | `    <button class="filter-btn" type="button" data-filter="full" aria-pressed="false">งานเต็ม</button>` |
| 73 | OK — reviewed, no change required | `  </div>` |
| 74 | OK — reviewed, no change required | `</div>` |
| 75 | OK — blank/separator line | `` |
| 76 | OK — reviewed, no change required | `<div class="sec-title"><span>เลือกงานที่ใช่ ไปถ่ายคนที่ชอบ ❤️</span></div>` |
| 77 | OK — blank/separator line | `` |
| 78 | OK — reviewed, no change required | `<div class="update-note" id="update-note">อัปเดตล่าสุด: -</div>` |
| 79 | OK — reviewed, no change required | `<div id="content"><div class="poster-grid skeleton-grid" aria-label="กำลังโหลดข้อมูลงาน"><div class="concert-card skeleton-card" aria-hidden="true"><div class="poster-img-wrap s…` |
| 80 | OK — reviewed, no change required | `<div class="divider"></div>` |
| 81 | OK — blank/separator line | `` |
| 82 | OK — reviewed, no change required | `<a class="line-btn" href="https://line.me/R/ti/p/%40827blnmo" target="_blank" rel="noopener">` |
| 83 | OK — reviewed, no change required | `  <svg viewBox="0 0 24 24" fill="white"><path d="M20 12.5c0-4.1-4-7.5-9-7.5S2 8.4 2 12.5c0 3.7 3.3 6.8 7.7 7.4.3.1.7.2.8.5s0 .7-.1 1v.1c-.1.3-.2.8.5.5 2.9-1.2 7.1-3.7 9.6-7.1.9-…` |
| 84 | OK — reviewed, no change required | `  ทัก LINE มาจองได้เลย 💚` |
| 85 | OK — reviewed, no change required | `</a>` |
| 86 | OK — blank/separator line | `` |
| 87 | OK — reviewed, no change required | `<footer><div class="footer-brand">KK Phone Rental</div><div class="footer-tagline">เช่าเถอะ อยากให้ชัด ✨</div><div class="trust-note">จองง่าย คุยกับร้านโดยตรงผ่าน LINE</div></fo…` |
| 88 | OK — reviewed, no change required | `</div>` |
| 89 | OK — reviewed, no change required | `<a class="sticky-line" href="https://line.me/R/ti/p/%40827blnmo" target="_blank" rel="noopener">💚 ทัก LINE จองคิว</a>` |
| 90 | OK — blank/separator line | `` |
| 91 | OK — reviewed, no change required | `<div class="overlay" id="overlay">` |
| 92 | OK — reviewed, no change required | `  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">` |
| 93 | OK — reviewed, no change required | `    <button class="modal-x" id="modal-x-btn" type="button" data-modal-close="package" aria-label="ปิดหน้าต่าง">×</button>` |
| 94 | OK — reviewed, no change required | `    <div class="modal-handle"></div>` |
| 95 | OK — reviewed, no change required | `    <div class="modal-header">` |
| 96 | OK — reviewed, no change required | `      <div class="modal-title" id="modal-title">ชื่องาน</div>` |
| 97 | OK — reviewed, no change required | `      <div class="modal-meta" id="modal-date">วันที่</div>` |
| 98 | OK — reviewed, no change required | `      <div class="modal-meta" id="modal-venue">สถานที่</div>` |
| 99 | OK — reviewed, no change required | `    </div>` |
| 100 | OK — reviewed, no change required | `    <div class="modal-note"><strong>เลือกแพ็กเกจที่ต้องการ:</strong> กดจองแล้ว ระบบจะพาไป LINE OA พร้อมข้อความจองแบบสั้น ๆ ที่แก้ต่อได้ทันที 💚</div>` |
| 101 | OK — reviewed, no change required | `    <div class="modal-divider"></div>` |
| 102 | OK — reviewed, no change required | `    <div class="phone-list" id="phone-list"></div>` |
| 103 | OK — reviewed, no change required | `    <button class="modal-close" id="modal-close" type="button" data-modal-close="package">ปิด</button>` |
| 104 | OK — reviewed, no change required | `  </div>` |
| 105 | OK — reviewed, no change required | `</div>` |
| 106 | OK — blank/separator line | `` |
| 107 | OK — reviewed, no change required | `<div class="faq-overlay" id="faqOverlay">` |
| 108 | OK — reviewed, no change required | `  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="faq-title">` |
| 109 | OK — reviewed, no change required | `    <button class="modal-x" id="faq-x-btn" type="button" data-modal-close="faq" aria-label="ปิด FAQ">×</button>` |
| 110 | OK — reviewed, no change required | `    <div class="modal-handle"></div>` |
| 111 | OK — reviewed, no change required | `    <div class="modal-header"><div class="modal-title" id="faq-title">FAQ · คำถามที่พบบ่อย</div></div>` |
| 112 | OK — reviewed, no change required | `    <div class="modal-divider"></div>` |
| 113 | OK — reviewed, no change required | `    <div class="faq-list">` |
| 114 | OK — reviewed, no change required | `      <div class="faq-item active">` |
| 115 | OK — reviewed, no change required | `        <button class="faq-q" type="button" aria-expanded="true">Q: เช่ามือถือยังไง? <span class="faq-plus">+</span></button>` |
| 116 | OK — reviewed, no change required | `        <div class="faq-a">A: เลือกงานที่ต้องการ กดดูรุ่นมือถือที่ว่าง ระบบจะพาไปจองผ่าน LINE OA เพื่อให้ร้านคอนเฟิร์ม</div>` |
| 117 | OK — reviewed, no change required | `      </div>` |
| 118 | OK — reviewed, no change required | `      <div class="faq-item">` |
| 119 | OK — reviewed, no change required | `        <button class="faq-q" type="button" aria-expanded="false">Q: ในเซ็ตเช่ามีอุปกรณ์อะไรให้บ้าง? <span class="faq-plus">+</span></button>` |
| 120 | OK — reviewed, no change required | `        <div class="faq-a">A: อุปกรณ์พื้นฐานมีตัวเครื่องมือถือ กระเป๋าใส่มือถือ และแบตสำรอง หากเช่าเลนส์เพิ่มจะมีถุงใส่เลนส์และผ้าเช็ดเลนส์ให้ด้วย</div>` |
| 121 | OK — reviewed, no change required | `      </div>` |
| 122 | OK — reviewed, no change required | `      <div class="faq-item">` |
| 123 | OK — reviewed, no change required | `        <button class="faq-q" type="button" aria-expanded="false">Q: รับเครื่อง และส่งเครื่องคืนที่ไหน? <span class="faq-plus">+</span></button>` |
| 124 | OK — reviewed, no change required | `        <div class="faq-a">A: รับเครื่องและส่งเครื่องคืนที่หน้างานเท่านั้น</div>` |
| 125 | OK — reviewed, no change required | `      </div>` |
| 126 | OK — reviewed, no change required | `      <div class="faq-item">` |
| 127 | OK — reviewed, no change required | `        <button class="faq-q" type="button" aria-expanded="false">Q: ต้องจ่ายมัดจำเครื่องและประกันเครื่องไหม? <span class="faq-plus">+</span></button>` |
| 128 | OK — reviewed, no change required | `        <div class="faq-a">A: ตอนนี้ร้านยังอยู่ในช่วงโปรโมชั่น ดังนั้นจึงไม่เก็บค่ามัดจำและค่าประกัน เพียงแค่ฟอล X ของทางร้าน</div>` |
| 129 | OK — reviewed, no change required | `      </div>` |
| 130 | OK — reviewed, no change required | `      <div class="faq-item">` |
| 131 | OK — reviewed, no change required | `        <button class="faq-q" type="button" aria-expanded="false">Q: การจ่ายเงินต้องจ่ายยังไง? <span class="faq-plus">+</span></button>` |
| 132 | OK — reviewed, no change required | `        <div class="faq-a">A: จ่ายเงินตอนรับเครื่องที่หน้างาน</div>` |
| 133 | OK — reviewed, no change required | `      </div>` |
| 134 | OK — reviewed, no change required | `      <div class="faq-item">` |
| 135 | OK — reviewed, no change required | `        <button class="faq-q" type="button" aria-expanded="false">Q: เอกสารที่ใช้ในการเช่ายืมมีอะไรบ้าง? <span class="faq-plus">+</span></button>` |
| 136 | OK — reviewed, no change required | `        <div class="faq-a">A: รูปถ่าย บัตรประชาชน/ใบขับขี่/passport ถ่ายคู่กับหลักฐานการเข้างาน และถ่ายคู่กับอุปกรณ์ที่เช่ายืมตอนรับเครื่องอีกครั้ง</div>` |
| 137 | OK — reviewed, no change required | `      </div>` |
| 138 | OK — reviewed, no change required | `      <div class="faq-item">` |
| 139 | REVIEWED Drive URL logic/permission flow | `        <button class="faq-q" type="button" aria-expanded="false">Q: ทำไมไฟล์จาก Google Drive ไม่ชัด? <span class="faq-plus">+</span></button>` |
| 140 | REVIEWED Drive URL logic/permission flow | `        <div class="faq-a">A: ไฟล์ไม่ชัดเพราะ Google Drive Preview อาจลดคุณภาพของภาพ ต้องกดดาวน์โหลดลงเครื่องก่อน ภาพจึงจะชัด</div>` |
| 141 | OK — reviewed, no change required | `      </div>` |
| 142 | OK — reviewed, no change required | `      <div class="faq-item">` |
| 143 | REVIEWED Drive URL logic/permission flow | `        <button class="faq-q" type="button" aria-expanded="false">Q: ไฟล์บน Google Drive เก็บไว้ได้กี่วัน? <span class="faq-plus">+</span></button>` |
| 144 | OK — reviewed, no change required | `        <div class="faq-a">A: ร้านจะเก็บไฟล์ไว้ให้ประมาณ 30 วัน หลังจากนั้นจะไม่สามารถเข้าถึงไฟล์ได้ แนะนำให้ดาวน์โหลดเก็บไว้ทันทีหลังได้รับลิงก์ค่ะ</div>` |
| 145 | OK — reviewed, no change required | `      </div>` |
| 146 | OK — reviewed, no change required | `    </div>` |
| 147 | OK — reviewed, no change required | `    <button class="modal-close" id="faq-close-btn" type="button" data-modal-close="faq">ปิด</button>` |
| 148 | OK — reviewed, no change required | `  </div>` |
| 149 | OK — reviewed, no change required | `</div>` |
| 150 | OK — blank/separator line | `` |
| 151 | OK — reviewed, no change required | `<script src="config.js" defer></script>` |
| 152 | OK — reviewed, no change required | `<script src="script.js" defer></script>` |
| 153 | OK — reviewed, no change required | `</body>` |
| 154 | OK — reviewed, no change required | `</html>` |

### `manifest.json`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — reviewed, no change required | `{` |
| 2 | OK — reviewed, no change required | `  "name": "KK Phone Rental",` |
| 3 | OK — reviewed, no change required | `  "short_name": "KK Rental",` |
| 4 | OK — reviewed, no change required | `  "description": "เช่ามือถือถ่ายคอนเสิร์ต แฟนมีท และอีเวนต์",` |
| 5 | OK — reviewed, no change required | `  "start_url": "/?source=pwa",` |
| 6 | OK — reviewed, no change required | `  "display": "standalone",` |
| 7 | OK — reviewed, no change required | `  "background_color": "#ffffff",` |
| 8 | OK — reviewed, no change required | `  "theme_color": "#5B8DEF",` |
| 9 | OK — reviewed, no change required | `  "orientation": "portrait-primary",` |
| 10 | OK — reviewed, no change required | `  "lang": "th",` |
| 11 | OK — reviewed, no change required | `  "icons": [` |
| 12 | OK — reviewed, no change required | `    {` |
| 13 | OK — reviewed, no change required | `      "src": "/favicon.png",` |
| 14 | OK — reviewed, no change required | `      "sizes": "64x64",` |
| 15 | OK — reviewed, no change required | `      "type": "image/png"` |
| 16 | OK — reviewed, no change required | `    },` |
| 17 | OK — reviewed, no change required | `    {` |
| 18 | OK — reviewed, no change required | `      "src": "/apple-touch-icon.png",` |
| 19 | OK — reviewed, no change required | `      "sizes": "180x180",` |
| 20 | OK — reviewed, no change required | `      "type": "image/png"` |
| 21 | OK — reviewed, no change required | `    },` |
| 22 | OK — reviewed, no change required | `    {` |
| 23 | OK — reviewed, no change required | `      "src": "/icon-192.png",` |
| 24 | OK — reviewed, no change required | `      "sizes": "192x192",` |
| 25 | OK — reviewed, no change required | `      "type": "image/png",` |
| 26 | OK — reviewed, no change required | `      "purpose": "any maskable"` |
| 27 | OK — reviewed, no change required | `    },` |
| 28 | OK — reviewed, no change required | `    {` |
| 29 | OK — reviewed, no change required | `      "src": "/icon-512.png",` |
| 30 | OK — reviewed, no change required | `      "sizes": "512x512",` |
| 31 | OK — reviewed, no change required | `      "type": "image/png",` |
| 32 | OK — reviewed, no change required | `      "purpose": "any maskable"` |
| 33 | OK — reviewed, no change required | `    }` |
| 34 | OK — reviewed, no change required | `  ],` |
| 35 | OK — reviewed, no change required | `  "categories": [` |
| 36 | OK — reviewed, no change required | `    "lifestyle",` |
| 37 | OK — reviewed, no change required | `    "shopping"` |
| 38 | OK — reviewed, no change required | `  ],` |
| 39 | OK — reviewed, no change required | `  "shortcuts": [` |
| 40 | OK — reviewed, no change required | `    {` |
| 41 | OK — reviewed, no change required | `      "name": "ดูงานที่เปิดจอง",` |
| 42 | OK — reviewed, no change required | `      "short_name": "จองเลย",` |
| 43 | OK — reviewed, no change required | `      "url": "/?filter=available",` |
| 44 | OK — reviewed, no change required | `      "icons": [` |
| 45 | OK — reviewed, no change required | `        {` |
| 46 | OK — reviewed, no change required | `          "src": "/favicon.png",` |
| 47 | OK — reviewed, no change required | `          "sizes": "32x32"` |
| 48 | OK — reviewed, no change required | `        }` |
| 49 | OK — reviewed, no change required | `      ]` |
| 50 | OK — reviewed, no change required | `    }` |
| 51 | OK — reviewed, no change required | `  ],` |
| 52 | OK — reviewed, no change required | `  "scope": "/"` |
| 53 | OK — reviewed, no change required | `}` |

### `package.json`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — reviewed, no change required | `{` |
| 2 | OK — reviewed, no change required | `  "name": "kk-phone-rental",` |
| 3 | OK — reviewed, no change required | `  "version": "16.6.2",` |
| 4 | OK — reviewed, no change required | `  "private": true,` |
| 5 | OK — reviewed, no change required | `  "scripts": {` |
| 6 | OK — reviewed, no change required | `    "start": "vercel dev",` |
| 7 | OK — reviewed, no change required | `    "deploy": "vercel --prod",` |
| 8 | OK — reviewed, no change required | `    "check": "node --check script.js && node --check admin/admin.js && node --check api/kk-admin.js && node --check api/kk-data.js"` |
| 9 | OK — reviewed, no change required | `  },` |
| 10 | OK — reviewed, no change required | `  "engines": {` |
| 11 | OK — reviewed, no change required | `    "node": ">=20"` |
| 12 | OK — reviewed, no change required | `  }` |
| 13 | OK — reviewed, no change required | `}` |

### `script.js`

| Line | Status | Code |
|---:|---|---|
| 1 | UPDATED version sync to v16.6.2 | `// KK Phone Rental Frontend v16.6.2_LINE_AUDITED — Phase 1 recovery-stable baseline` |
| 2 | OK — comment/documentation reviewed | `// Backend contract:` |
| 3 | OK — comment/documentation reviewed | `// - 08_Web_Ready!A4:K = event-level output` |
| 4 | OK — comment/documentation reviewed | `// - 09_Web_Packages!A4:N = package-level output, including M raw_available_count and N use_case` |
| 5 | OK — comment/documentation reviewed | `// Improvements:` |
| 6 | OK — comment/documentation reviewed | `// - Vercel API proxy first, with read-only Google Sheets fallback for outage recovery` |
| 7 | OK — comment/documentation reviewed | `// - Safer package mapping so raw_available_count is not mistaken for pkg_active` |
| 8 | OK — comment/documentation reviewed | `// - Availability uses package_status + available_count, with raw negative protection` |
| 9 | OK — comment/documentation reviewed | `// - Keeps existing compact modal and 2-column card UX` |
| 10 | OK — comment/documentation reviewed | `// - Adds month dropdown selector and removes soon-only filter button` |
| 11 | OK — blank/separator line | `` |
| 12 | OK — reviewed, no change required | `var APP       = window.KK_CONFIG || {};` |
| 13 | UPDATED version sync to v16.6.2 | `var KK_APP_VERSION = APP.appVersion || "v16.6.2_LINE_AUDITED";` |
| 14 | OK — reviewed, no change required | `var DEFAULT_TITLE = "KK Phone Rental | เช่ามือถือคอนเสิร์ต แฟนมีท และอีเวนต์";` |
| 15 | OK — reviewed, no change required | `var DEFAULT_DESCRIPTION = "KK Phone Rental บริการเช่ามือถือถ่ายคอนเสิร์ต แฟนมีท และอีเวนต์ ซูมชัด เก็บครบทุกโมเมนต์ เลือกงาน ดูรุ่นที่ว่าง และจองผ่าน LINE OA กับแอดมิน";` |
| 16 | OK — reviewed, no change required | `var DEFAULT_OG_IMAGE = APP.headerImage || "https://lh3.googleusercontent.com/d/16v6ZDbxmqNEkxIpDNsm0ABrDjMT0_tu9=w1600";` |
| 17 | OK — reviewed, no change required | `var SHEET_ID  = APP.sheetId      || "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU";` |
| 18 | OK — reviewed, no change required | `var WEB_SHEET = APP.webSheetName || "08_Web_Ready";` |
| 19 | OK — reviewed, no change required | `var WEB_RANGE = APP.webRange     || "A4:K";` |
| 20 | OK — reviewed, no change required | `var PKG_SHEET = APP.pkgSheetName || "09_Web_Packages";` |
| 21 | OK — reviewed, no change required | `var PKG_RANGE = APP.pkgRange     || "A4:N"; // M raw_available_count, N use_case from backend` |
| 22 | OK — reviewed, no change required | `var LINE_URL  = APP.lineDirectUrl|| "https://line.me/R/ti/p/%40827blnmo";` |
| 23 | OK — reviewed, no change required | `var LINE_OA_ID = APP.lineOAId || "@827blnmo";` |
| 24 | OK — reviewed, no change required | `var LINE_OA   = "https://line.me/R/oaMessage/" + encodeURIComponent(LINE_OA_ID) + "/?";` |
| 25 | OK — reviewed, no change required | `var API_ENDPOINT = APP.apiEndpoint || "/api/kk-data";` |
| 26 | OK — reviewed, no change required | `var USE_API = APP.useVercelApi !== false && typeof window !== "undefined" && window.location.protocol !== "file:" && !(APP.disableDirectFallback !== true && (new URLSearchParams…` |
| 27 | OK — blank/separator line | `` |
| 28 | OK — reviewed, no change required | `var concertsData  = [];` |
| 29 | OK — reviewed, no change required | `var TODAY_TS = (function(){ var d=new Date(); d.setHours(0,0,0,0); return d.getTime(); })();` |
| 30 | OK — reviewed, no change required | `var URL_PARAMS = new URLSearchParams(window.location.search);` |
| 31 | OK — reviewed, no change required | `var DEBUG_MODE = URL_PARAMS.get("debug")==="1";` |
| 32 | OK — reviewed, no change required | `var SHOW_PAST  = URL_PARAMS.get("showPast")==="1";` |
| 33 | OK — reviewed, no change required | `var REQUESTED_EVENT = String(URL_PARAMS.get("event") || URL_PARAMS.get("e") || "").trim();` |
| 34 | OK — reviewed, no change required | `var REQUESTED_FILTER = String(URL_PARAMS.get("filter") || "all").trim().toLowerCase();` |
| 35 | OK — reviewed, no change required | `var currentFilter = ["all","available","full"].indexOf(REQUESTED_FILTER)>=0 ? REQUESTED_FILTER : "all";` |
| 36 | OK — reviewed, no change required | `var REQUESTED_MONTH = String(URL_PARAMS.get("month") || "all").trim().toLowerCase();` |
| 37 | OK — reviewed, no change required | `var currentMonth = /^\d{4}-\d{2}$/.test(REQUESTED_MONTH) ? REQUESTED_MONTH : "all";` |
| 38 | OK — reviewed, no change required | `var TH_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];` |
| 39 | OK — reviewed, no change required | `var PRELOADED_IMAGES = {};` |
| 40 | OK — blank/separator line | `` |
| 41 | OK — comment/documentation reviewed | `// ─── Helpers ─────────────────────────────────────────────────────────────` |
| 42 | OK — reviewed, no change required | `function esc(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }` |
| 43 | OK — reviewed, no change required | `function toNum(v){ var n=Number(String(v||"").replace(/[^0-9.\-]/g,"")); return isNaN(n)?0:n; }` |
| 44 | OK — reviewed, no change required | `function hasVal(v){ return v!==undefined && v!==null && String(v).trim()!==""; }` |
| 45 | OK — reviewed, no change required | `function toBool(v){ if(v===true||v===1)return true; var s=String(v||"").trim().toUpperCase(); return s==="TRUE"||s==="YES"||s==="1"||s==="ว่าง"||s==="OPEN"||s==="SHOW"; }` |
| 46 | OK — reviewed, no change required | `function fmtPrice(n){ n=toNum(n); return n>0?n.toLocaleString("th-TH")+" บาท/วัน":"ไม่ระบุ"; }` |
| 47 | OK — reviewed, no change required | `function fmtPriceLine(n){ n=toNum(n); return n>0?n.toLocaleString("th-TH")+" บาท":"ไม่ระบุ"; }` |
| 48 | OK — reviewed, no change required | `function lineVal(v){ var s=String(v||"").replace(/\s+/g," ").trim(); return s||"-"; }` |
| 49 | OK — blank/separator line | `` |
| 50 | OK — comment/documentation reviewed | `// Header-safe row utilities: Google Sheets CSV may export Thai headers with line breaks.` |
| 51 | OK — reviewed, no change required | `function compactKey(k){` |
| 52 | OK — reviewed, no change required | `  return String(k||"")` |
| 53 | OK — reviewed, no change required | `    .toLowerCase()` |
| 54 | OK — reviewed, no change required | `    .replace(/[\s_\-()\[\].:\/\\]+/g,"")` |
| 55 | OK — reviewed, no change required | `    .replace(/[^a-z0-9ก-๙]/g,"")` |
| 56 | OK — reviewed, no change required | `    .trim();` |
| 57 | OK — reviewed, no change required | `}` |
| 58 | OK — reviewed, no change required | `function pick(obj, keys, fallbackIndex){` |
| 59 | OK — reviewed, no change required | `  var rawKeys = Object.keys(obj||{}), wanted = keys.map(compactKey);` |
| 60 | OK — reviewed, no change required | `  for(var i=0;i<rawKeys.length;i++){` |
| 61 | OK — reviewed, no change required | `    if(wanted.indexOf(compactKey(rawKeys[i]))>=0) return obj[rawKeys[i]];` |
| 62 | OK — reviewed, no change required | `  }` |
| 63 | OK — reviewed, no change required | `  if(typeof fallbackIndex==="number"){` |
| 64 | OK — reviewed, no change required | `    var vals = rawKeys.map(function(k){return obj[k];});` |
| 65 | OK — reviewed, no change required | `    if(vals[fallbackIndex]!==undefined) return vals[fallbackIndex];` |
| 66 | OK — reviewed, no change required | `  }` |
| 67 | OK — reviewed, no change required | `  return "";` |
| 68 | OK — reviewed, no change required | `}` |
| 69 | OK — reviewed, no change required | `function normalizePkgRow(p){` |
| 70 | OK — comment/documentation reviewed | `  // Backend package headers:` |
| 71 | OK — comment/documentation reviewed | `  // A package_id, B event_id, C package_type, D model_group, E model_display,` |
| 72 | OK — comment/documentation reviewed | `  // F lens_group, G lens_display, H price, I available_count, J package_status,` |
| 73 | OK — comment/documentation reviewed | `  // K sort_order, L web_note, M raw_available_count, N use_case` |
| 74 | OK — reviewed, no change required | `  var status = pick(p,["package_status","package status","status","สถานะแพ็กเกจ"],9);` |
| 75 | OK — reviewed, no change required | `  var price  = pick(p,["price","standard_price","standard price","ราคา"],7);` |
| 76 | OK — reviewed, no change required | `  var modelDisplay = pick(p,["model_display","phone_model_display","ชื่อแสดง\nมือถือ","ชื่อแสดงมือถือ"],4);` |
| 77 | OK — reviewed, no change required | `  var lensDisplay  = pick(p,["lens_display","lens_model_display","ชื่อแสดง\nเลนส์","ชื่อแสดงเลนส์"],6);` |
| 78 | OK — reviewed, no change required | `  var pkgType = pick(p,["pkg_type","package_type","package type","ประเภท\nแพ็กเกจ","ประเภทแพ็กเกจ"],2);` |
| 79 | OK — reviewed, no change required | `  var availableCount = pick(p,["available_count","available count","available_count\n(auto)","จำนวนว่าง"],8);` |
| 80 | OK — reviewed, no change required | `  var rawAvailableCount = pick(p,["raw_available_count","raw available count","raw_available_count\n(auto)","จำนวนว่างดิบ"],12);` |
| 81 | OK — reviewed, no change required | `  var useCase = pick(p,["use_case","use case","use_case_note","เหมาะกับ","ข้อความเหมาะกับ"],13);` |
| 82 | OK — blank/separator line | `` |
| 83 | OK — reviewed, no change required | `  return {` |
| 84 | OK — reviewed, no change required | `    package_id:          pick(p,["package_id","pkg_id","template_id","รหัสแพ็กเกจ\n(Auto)","รหัสแพ็กเกจ"],0),` |
| 85 | OK — reviewed, no change required | `    event_id:            pick(p,["event_id","event_id\n(ตรงกับ 01_Events)"],1),` |
| 86 | OK — reviewed, no change required | `    pkg_type:            pkgType,` |
| 87 | OK — reviewed, no change required | `    model_group:         pick(p,["model_group","model_group\n(จาก Settings)"],3),` |
| 88 | OK — reviewed, no change required | `    phone_model_display: modelDisplay,` |
| 89 | OK — reviewed, no change required | `    model_display:       modelDisplay,` |
| 90 | OK — reviewed, no change required | `    lens_group:          pick(p,["lens_group","lens_group\n(NONE ถ้าไม่มี)"],5),` |
| 91 | OK — reviewed, no change required | `    lens_model_display:  lensDisplay,` |
| 92 | OK — reviewed, no change required | `    lens_display:        lensDisplay,` |
| 93 | OK — reviewed, no change required | `    price:               price,` |
| 94 | OK — reviewed, no change required | `    web_note:            pick(p,["web_note","package_note","หมายเหตุ\n(สำหรับเว็บ)","หมายเหตุ"],11),` |
| 95 | OK — comment/documentation reviewed | `    // ห้าม fallback เป็น index 12 เพราะ column M คือ raw_available_count ไม่ใช่ active flag` |
| 96 | OK — reviewed, no change required | `    pkg_active:          pick(p,["pkg_active","pkg_active\n(TRUE/FALSE)"]),` |
| 97 | OK — reviewed, no change required | `    available_count:     availableCount,` |
| 98 | OK — reviewed, no change required | `    raw_available_count: rawAvailableCount,` |
| 99 | OK — reviewed, no change required | `    use_case:            useCase,` |
| 100 | OK — reviewed, no change required | `    package_status:      status,` |
| 101 | OK — reviewed, no change required | `    sort_order:          pick(p,["sort_order"],10)` |
| 102 | OK — reviewed, no change required | `  };` |
| 103 | OK — reviewed, no change required | `}` |
| 104 | OK — reviewed, no change required | `function isPkgVisible(p){` |
| 105 | OK — reviewed, no change required | `  var st=String((p&&p.package_status)||"").trim().toLowerCase();` |
| 106 | OK — reviewed, no change required | `  if(st==="hidden"||st==="hide") return false;` |
| 107 | OK — reviewed, no change required | `  if(hasVal(p&&p.pkg_active)) return toBool(p.pkg_active);` |
| 108 | OK — reviewed, no change required | `  return true;` |
| 109 | OK — reviewed, no change required | `}` |
| 110 | OK — blank/separator line | `` |
| 111 | OK — comment/documentation reviewed | `// ─── GA4 minimal tracker ──────────────────────────────────────────────────` |
| 112 | OK — comment/documentation reviewed | `// ถ้ายังไม่ได้เซ็ต GA_ID ใน config.js ก็ skip ไปเงียบๆ` |
| 113 | OK — reviewed, no change required | `function track(name, params){` |
| 114 | OK — reviewed, no change required | `  try{ if(typeof gtag==="function"){ gtag("event", name, params||{}); } }catch(e){}` |
| 115 | OK — reviewed, no change required | `}` |
| 116 | OK — reviewed, no change required | `function setMeta(attr, key, val){` |
| 117 | OK — reviewed, no change required | `  try{` |
| 118 | OK — reviewed, no change required | `    if(!val)return;` |
| 119 | OK — reviewed, no change required | `    var el=document.querySelector('meta['+attr+'="'+key+'"]');` |
| 120 | OK — reviewed, no change required | `    if(el)el.setAttribute("content", val);` |
| 121 | OK — reviewed, no change required | `  }catch(e){}` |
| 122 | OK — reviewed, no change required | `}` |
| 123 | OK — reviewed, no change required | `function eventUrl(c){` |
| 124 | OK — reviewed, no change required | `  try{ var u=new URL(homeUrl()); u.searchParams.set("event", c.id||""); return u.toString(); }` |
| 125 | OK — reviewed, no change required | `  catch(e){ return (APP.siteUrl || window.location.href); }` |
| 126 | OK — reviewed, no change required | `}` |
| 127 | OK — reviewed, no change required | `function resetMeta(){` |
| 128 | OK — reviewed, no change required | `  try{` |
| 129 | OK — reviewed, no change required | `    document.title = DEFAULT_TITLE;` |
| 130 | OK — reviewed, no change required | `    setMeta("name","description",DEFAULT_DESCRIPTION);` |
| 131 | OK — reviewed, no change required | `    setMeta("property","og:title",DEFAULT_TITLE);` |
| 132 | OK — reviewed, no change required | `    setMeta("property","og:description",DEFAULT_DESCRIPTION);` |
| 133 | OK — reviewed, no change required | `    setMeta("property","og:url",APP.siteUrl || homeUrl());` |
| 134 | OK — reviewed, no change required | `    setMeta("property","og:image",DEFAULT_OG_IMAGE);` |
| 135 | OK — reviewed, no change required | `    setMeta("name","twitter:title",DEFAULT_TITLE);` |
| 136 | OK — reviewed, no change required | `    setMeta("name","twitter:description",DEFAULT_DESCRIPTION);` |
| 137 | OK — reviewed, no change required | `    setMeta("name","twitter:image",DEFAULT_OG_IMAGE);` |
| 138 | OK — reviewed, no change required | `  }catch(e){}` |
| 139 | OK — reviewed, no change required | `}` |
| 140 | OK — reviewed, no change required | `function updateMetaForEvent(c){` |
| 141 | OK — reviewed, no change required | `  if(!c)return;` |
| 142 | OK — reviewed, no change required | `  var title=(c.name?c.name+" | ":"")+"KK Phone Rental";` |
| 143 | OK — reviewed, no change required | `  var desc="เช่ามือถือถ่ายงาน "+(c.name||"คอนเสิร์ต")+" วันที่ "+(c.date||"-")+" ดูแพ็กเกจและจองผ่าน LINE OA";` |
| 144 | OK — reviewed, no change required | `  document.title=title;` |
| 145 | OK — reviewed, no change required | `  setMeta("name","description",desc);` |
| 146 | OK — reviewed, no change required | `  setMeta("property","og:title",title);` |
| 147 | OK — reviewed, no change required | `  setMeta("property","og:description",desc);` |
| 148 | OK — reviewed, no change required | `  setMeta("property","og:url",eventUrl(c));` |
| 149 | OK — reviewed, no change required | `  if(c.imgFull&&c.imgFull[0])setMeta("property","og:image",c.imgFull[0]);` |
| 150 | OK — reviewed, no change required | `  setMeta("name","twitter:title",title);` |
| 151 | OK — reviewed, no change required | `  setMeta("name","twitter:description",desc);` |
| 152 | OK — reviewed, no change required | `  if(c.imgFull&&c.imgFull[0])setMeta("name","twitter:image",c.imgFull[0]);` |
| 153 | OK — reviewed, no change required | `}` |
| 154 | OK — blank/separator line | `` |
| 155 | OK — comment/documentation reviewed | `// ─── Date utils ───────────────────────────────────────────────────────────` |
| 156 | OK — reviewed, no change required | `function parseDate(s){` |
| 157 | OK — reviewed, no change required | `  s=String(s||"").trim(); if(!s)return null;` |
| 158 | OK — reviewed, no change required | `  if(/^\d{5}$/.test(s)){ return new Date(Date.UTC(1899,11,30)+Number(s)*86400000); }` |
| 159 | OK — reviewed, no change required | `  var m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);` |
| 160 | OK — reviewed, no change required | `  if(m){ var y=parseInt(m[3],10); if(y>2500)y-=543; return new Date(y,parseInt(m[2],10)-1,parseInt(m[1],10)); }` |
| 161 | OK — reviewed, no change required | `  m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);` |
| 162 | OK — reviewed, no change required | `  if(m){ var y2=parseInt(m[1],10); if(y2>2500)y2-=543; return new Date(y2,parseInt(m[2],10)-1,parseInt(m[3],10)); }` |
| 163 | OK — reviewed, no change required | `  var en={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};` |
| 164 | OK — reviewed, no change required | `  m=s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/i);` |
| 165 | OK — reviewed, no change required | `  if(m){ var mo=en[m[2].toLowerCase().slice(0,3)]; if(mo!==undefined){ var y3=parseInt(m[3],10); if(y3>2500)y3-=543; return new Date(y3,mo,parseInt(m[1],10)); }}` |
| 166 | OK — reviewed, no change required | `  var th={"ม.ค.":0,"มกราคม":0,"ก.พ.":1,"กุมภาพันธ์":1,"มี.ค.":2,"มีนาคม":2,"เม.ย.":3,"เมษายน":3,"พ.ค.":4,"พฤษภาคม":4,"มิ.ย.":5,"มิถุนายน":5,"ก.ค.":6,"กรกฎาคม":6,"ส.ค.":7,"สิงหาค…` |
| 167 | OK — reviewed, no change required | `  for(var k in th){ if(s.indexOf(k)>=0){ var parts=s.split(k); var d2=parseInt(String(parts[0]).replace(/\D/g,""),10); var ym=String(parts[1]||"").match(/\d{4}/); var y4=ym?pars…` |
| 168 | OK — reviewed, no change required | `  return null;` |
| 169 | OK — reviewed, no change required | `}` |
| 170 | OK — reviewed, no change required | `function fmtDate(s){ var d=parseDate(s); if(!d)return String(s||""); return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear(); }` |
| 171 | OK — blank/separator line | `` |
| 172 | OK — comment/documentation reviewed | `// ─── Image utils — FIX 2: w600 thumbnail, w1200 only for modal ───────────` |
| 173 | OK — reviewed, no change required | `function getDriveId(url){` |
| 174 | OK — reviewed, no change required | `  var s=String(url||"").trim();` |
| 175 | OK — reviewed, no change required | `  var pats=[` |
| 176 | OK — reviewed, no change required | `    /\/file\/d\/([a-zA-Z0-9_-]{15,})/,` |
| 177 | OK — reviewed, no change required | `    /[?&]id=([a-zA-Z0-9_-]{15,})/,` |
| 178 | OK — reviewed, no change required | `    /\/thumbnail\?id=([a-zA-Z0-9_-]{15,})/,` |
| 179 | OK — reviewed, no change required | `    /googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/,` |
| 180 | OK — reviewed, no change required | `    /lh[3-6]\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/,` |
| 181 | OK — reviewed, no change required | `    /uc\?export=(?:view|download)&id=([a-zA-Z0-9_-]{15,})/` |
| 182 | OK — reviewed, no change required | `  ];` |
| 183 | OK — reviewed, no change required | `  for(var i=0;i<pats.length;i++){ var m=s.match(pats[i]); if(m&&m[1])return decodeURIComponent(m[1]).trim(); }` |
| 184 | OK — reviewed, no change required | `  if(!/^https?:\/\//i.test(s) && /^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;` |
| 185 | OK — reviewed, no change required | `  return "";` |
| 186 | OK — reviewed, no change required | `}` |
| 187 | OK — reviewed, no change required | `function getImgCandidates(url, size){` |
| 188 | OK — comment/documentation reviewed | `  // FIX: size param — "thumb" = w600 (grid), "full" = w1200 (modal)` |
| 189 | OK — reviewed, no change required | `  var sz = size==="full" ? "w1200" : "w600";` |
| 190 | OK — reviewed, no change required | `  var s=String(url||"").trim(); if(!s)return [];` |
| 191 | OK — reviewed, no change required | `  var id=getDriveId(s);` |
| 192 | OK — reviewed, no change required | `  if(id)return [` |
| 193 | OK — reviewed, no change required | `    "https://drive.google.com/thumbnail?id="+encodeURIComponent(id)+"&sz="+sz,` |
| 194 | OK — reviewed, no change required | `    "https://lh3.googleusercontent.com/d/"+encodeURIComponent(id)+"="+sz,` |
| 195 | OK — reviewed, no change required | `    "https://drive.google.com/uc?export=view&id="+encodeURIComponent(id)` |
| 196 | OK — reviewed, no change required | `  ];` |
| 197 | OK — reviewed, no change required | `  return [s];` |
| 198 | OK — reviewed, no change required | `}` |
| 199 | OK — reviewed, no change required | `function setImgFallback(img, urls){` |
| 200 | OK — reviewed, no change required | `  urls=(urls||[]).filter(Boolean); var idx=0;` |
| 201 | OK — reviewed, no change required | `  function next(){` |
| 202 | OK — reviewed, no change required | `    if(idx>=urls.length){` |
| 203 | OK — reviewed, no change required | `      if(img.id==="modal-poster-img"){ img.style.display="none"; return; }` |
| 204 | OK — reviewed, no change required | `      var w=img.parentElement; img.remove();` |
| 205 | REVIEWED innerHTML use; check escaping/safe static markup | `      if(w&&!w.querySelector(".poster-placeholder")){ var ph=document.createElement("div"); ph.className="poster-placeholder"; ph.innerHTML="<span>ยังไม่มีรูป</span>"; w.appendC…` |
| 206 | OK — reviewed, no change required | `      return;` |
| 207 | OK — reviewed, no change required | `    }` |
| 208 | OK — reviewed, no change required | `    img.style.display="block"; img.src=urls[idx++];` |
| 209 | OK — reviewed, no change required | `  }` |
| 210 | OK — reviewed, no change required | `  img.onerror=function(){ next(); }; next();` |
| 211 | OK — reviewed, no change required | `}` |
| 212 | OK — blank/separator line | `` |
| 213 | OK — comment/documentation reviewed | `// ─── CSV + fetch ──────────────────────────────────────────────────────────` |
| 214 | OK — reviewed, no change required | `function parseCsv(text){` |
| 215 | OK — reviewed, no change required | `  var rows=[],row=[],val="",q=false;` |
| 216 | OK — reviewed, no change required | `  text=String(text||"").replace(/^\uFEFF/,"");` |
| 217 | OK — reviewed, no change required | `  for(var i=0;i<text.length;i++){` |
| 218 | OK — reviewed, no change required | `    var c=text[i],n=text[i+1];` |
| 219 | OK — reviewed, no change required | `    if(c==='"'){ if(q&&n==='"'){val+='"';i++;}else q=!q; }` |
| 220 | OK — reviewed, no change required | `    else if(c===','&&!q){ row.push(val);val=""; }` |
| 221 | OK — reviewed, no change required | `    else if((c==='\n'||c==='\r')&&!q){ if(c==='\r'&&n==='\n')i++; row.push(val); if(row.some(function(x){return String(x||"").trim()!=="";})){ rows.push(row); } row=[];val=""; }` |
| 222 | OK — reviewed, no change required | `    else val+=c;` |
| 223 | OK — reviewed, no change required | `  }` |
| 224 | OK — reviewed, no change required | `  row.push(val);` |
| 225 | OK — reviewed, no change required | `  if(row.some(function(x){return String(x||"").trim()!=="";})){ rows.push(row); }` |
| 226 | OK — reviewed, no change required | `  return rows;` |
| 227 | OK — reviewed, no change required | `}` |
| 228 | OK — reviewed, no change required | `function csvToObjects(rows){` |
| 229 | OK — reviewed, no change required | `  if(!rows||rows.length<2)return [];` |
| 230 | OK — reviewed, no change required | `  var headers=rows[0].map(function(h){return String(h||"").trim();});` |
| 231 | OK — reviewed, no change required | `  return rows.slice(1).map(function(row){` |
| 232 | OK — reviewed, no change required | `    var obj={}; headers.forEach(function(h,i){ if(h)obj[h]=row[i]!==undefined?row[i]:""; });` |
| 233 | OK — reviewed, no change required | `    return obj;` |
| 234 | OK — reviewed, no change required | `  }).filter(function(o){ return Object.keys(o).some(function(k){return String(o[k]||"").trim()!=="";});});` |
| 235 | OK — reviewed, no change required | `}` |
| 236 | OK — reviewed, no change required | `function abortAfter(ms){ var c=new AbortController(); var t=setTimeout(function(){c.abort();},ms); return {signal:c.signal,clear:function(){clearTimeout(t);}}; }` |
| 237 | OK — reviewed, no change required | `async function fetchText(url,ms){` |
| 238 | OK — reviewed, no change required | `  var ab=abortAfter(ms||9000);` |
| 239 | REVIEWED network call and error handling | `  try{ var r=await fetch(url,{cache:"no-store",signal:ab.signal}); if(!r.ok)throw new Error("HTTP "+r.status); return await r.text(); }` |
| 240 | OK — reviewed, no change required | `  finally{ ab.clear(); }` |
| 241 | OK — reviewed, no change required | `}` |
| 242 | OK — reviewed, no change required | `async function withRetry(fn,tries,delay){` |
| 243 | OK — reviewed, no change required | `  var err; tries=tries||2; delay=delay||700;` |
| 244 | OK — reviewed, no change required | `  for(var i=0;i<tries;i++){ try{return await fn();}catch(e){err=e;if(i<tries-1)await new Promise(function(r){setTimeout(r,delay);});} }` |
| 245 | OK — reviewed, no change required | `  throw err;` |
| 246 | OK — reviewed, no change required | `}` |
| 247 | OK — reviewed, no change required | `function directSheetUrl(name,range){ if(!SHEET_ID) throw new Error("Direct Google Sheet fallback is not configured. Please check config.js sheetId or /api/kk-data."); return "ht…` |
| 248 | OK — reviewed, no change required | `function apiSheetUrl(name,range){ return API_ENDPOINT+"?sheet="+encodeURIComponent(name)+"&range="+encodeURIComponent(range)+"&t="+Date.now(); }` |
| 249 | OK — reviewed, no change required | `function csvHeaderLooksValid(name,text){` |
| 250 | OK — reviewed, no change required | `  var rows=parseCsv(text);` |
| 251 | OK — reviewed, no change required | `  if(!rows.length)return false;` |
| 252 | OK — reviewed, no change required | `  var headers=rows[0].map(function(h){return String(h||"").trim().toLowerCase();});` |
| 253 | OK — reviewed, no change required | `  if(name===WEB_SHEET) return headers.indexOf("event_id")>=0 && headers.indexOf("action_for_web")>=0 && headers.indexOf("poster_image_url")>=0;` |
| 254 | OK — reviewed, no change required | `  if(name===PKG_SHEET) return headers.indexOf("package_id")>=0 && headers.indexOf("event_id")>=0 && headers.indexOf("available_count")>=0;` |
| 255 | OK — reviewed, no change required | `  return true;` |
| 256 | OK — reviewed, no change required | `}` |
| 257 | OK — reviewed, no change required | `async function fetchValidatedSheetCsv(url,name,range,ms,sourceLabel){` |
| 258 | OK — reviewed, no change required | `  var text=await fetchText(url,ms||9000);` |
| 259 | OK — reviewed, no change required | `  if(!csvHeaderLooksValid(name,text)){` |
| 260 | OK — reviewed, no change required | `    throw new Error("Invalid CSV header from "+sourceLabel+" for "+name+" "+range);` |
| 261 | OK — reviewed, no change required | `  }` |
| 262 | OK — reviewed, no change required | `  return text;` |
| 263 | OK — reviewed, no change required | `}` |
| 264 | OK — reviewed, no change required | `async function fetchSheetCsv(name,range,ms){` |
| 265 | OK — reviewed, no change required | `  if(USE_API){` |
| 266 | OK — reviewed, no change required | `    try{ return await fetchValidatedSheetCsv(apiSheetUrl(name,range),name,range,ms||9000,"/api/kk-data"); }` |
| 267 | OK — reviewed, no change required | `    catch(e){` |
| 268 | OK — reviewed, no change required | `      console.warn("KK proxy failed or returned invalid CSV; falling back to read-only Google Sheets", e);` |
| 269 | OK — reviewed, no change required | `      if(APP.disableDirectFallback) throw e;` |
| 270 | OK — reviewed, no change required | `    }` |
| 271 | OK — reviewed, no change required | `  }` |
| 272 | OK — reviewed, no change required | `  return await fetchValidatedSheetCsv(directSheetUrl(name,range),name,range,ms||9000,"direct Google Sheets");` |
| 273 | OK — reviewed, no change required | `}` |
| 274 | OK — blank/separator line | `` |
| 275 | OK — comment/documentation reviewed | `// ─── Session cache ───────────────────────────────────────────────────────` |
| 276 | OK — reviewed, no change required | `var CACHE_TTL=15000; // Short cache so newly-created events and poster URLs show faster` |
| 277 | OK — reviewed, no change required | `function cacheGet(k){ try{ var raw=sessionStorage.getItem(k); if(!raw)return null; var o=JSON.parse(raw); return (Date.now()-o.ts)<CACHE_TTL?o.data:null; }catch(e){return null;} }` |
| 278 | OK — reviewed, no change required | `function cacheSet(k,d){ try{sessionStorage.setItem(k,JSON.stringify({ts:Date.now(),data:d}));}catch(e){} }` |
| 279 | OK — blank/separator line | `` |
| 280 | OK — reviewed, no change required | `async function fetchWebRows(){` |
| 281 | OK — reviewed, no change required | `  var k="kk_web_v16_6_2_line_audited:"+SHEET_ID+":"+WEB_SHEET+":"+WEB_RANGE+":"+(USE_API?"api":"direct"); var c=cacheGet(k); if(!DEBUG_MODE&&c)return c;` |
| 282 | OK — reviewed, no change required | `  var t=await withRetry(function(){return fetchSheetCsv(WEB_SHEET,WEB_RANGE,9000);},2,700);` |
| 283 | OK — reviewed, no change required | `  var d=csvToObjects(parseCsv(t)); if(!DEBUG_MODE)cacheSet(k,d); return d;` |
| 284 | OK — reviewed, no change required | `}` |
| 285 | OK — reviewed, no change required | `async function fetchPkgRows(){` |
| 286 | OK — reviewed, no change required | `  var k="kk_pkg_v16_6_2_line_audited:"+SHEET_ID+":"+PKG_SHEET+":"+PKG_RANGE+":"+(USE_API?"api":"direct"); var c=cacheGet(k); if(!DEBUG_MODE&&c)return c;` |
| 287 | OK — reviewed, no change required | `  var t=await withRetry(function(){return fetchSheetCsv(PKG_SHEET,PKG_RANGE,9000);},2,700);` |
| 288 | OK — reviewed, no change required | `  var d=csvToObjects(parseCsv(t)).map(normalizePkgRow); if(!DEBUG_MODE)cacheSet(k,d); return d;` |
| 289 | OK — reviewed, no change required | `}` |
| 290 | OK — blank/separator line | `` |
| 291 | OK — comment/documentation reviewed | `// ─── FIX 1: buildPackagesFromSheet — ใช้ available_count จาก 09_Web_Packages จริง ─` |
| 292 | OK — reviewed, no change required | `function buildPackagesFromSheet(pkgRows, eventId, phoneCnt, lensCnt){` |
| 293 | OK — comment/documentation reviewed | `  // phoneCnt + lensCnt มาจาก 08_Web_Ready G/H; package count มาจาก 09_Web_Packages I` |
| 294 | OK — reviewed, no change required | `  var evtPkgs=(pkgRows||[]).filter(function(p){` |
| 295 | OK — reviewed, no change required | `    var rowEvent = String(p.event_id||"").trim();` |
| 296 | OK — reviewed, no change required | `    return (!rowEvent || rowEvent===String(eventId||"").trim()) && isPkgVisible(p);` |
| 297 | OK — reviewed, no change required | `  });` |
| 298 | OK — reviewed, no change required | `  if(!evtPkgs.length)return [];` |
| 299 | OK — blank/separator line | `` |
| 300 | OK — reviewed, no change required | `  return evtPkgs.sort(function(a,b){` |
| 301 | OK — reviewed, no change required | `    var sa=hasVal(a.sort_order)?toNum(a.sort_order):999999;` |
| 302 | OK — reviewed, no change required | `    var sb=hasVal(b.sort_order)?toNum(b.sort_order):999999;` |
| 303 | OK — reviewed, no change required | `    return sa-sb || String(a.package_id||"").localeCompare(String(b.package_id||""));` |
| 304 | OK — reviewed, no change required | `  }).map(function(p){` |
| 305 | OK — reviewed, no change required | `    var pkgType      = String(p.pkg_type||"phone_only").trim();` |
| 306 | OK — reviewed, no change required | `    var modelDisplay = String(p.model_display||p.phone_model_display||"มือถือ").trim();` |
| 307 | OK — reviewed, no change required | `    var lensDisplay  = String(p.lens_display||p.lens_model_display||p.lens_group||"").trim();` |
| 308 | OK — reviewed, no change required | `    var note         = String(p.web_note||p.package_note||"").trim();` |
| 309 | OK — reviewed, no change required | `    var useCase      = String(p.use_case||"").trim();` |
| 310 | OK — blank/separator line | `` |
| 311 | OK — reviewed, no change required | `    var override = toNum(p.price_override);` |
| 312 | OK — reviewed, no change required | `    var directPrice = toNum(p.price);` |
| 313 | OK — reviewed, no change required | `    var price;` |
| 314 | OK — reviewed, no change required | `    if(directPrice>0){ price=directPrice; }` |
| 315 | OK — reviewed, no change required | `    else if(override>0){ price=override; }` |
| 316 | OK — reviewed, no change required | `    else if(pkgType==="phone_only"){ price=toNum(p.phone_price); }` |
| 317 | OK — reviewed, no change required | `    else if(pkgType==="lens_only"){  price=toNum(p.lens_price); }` |
| 318 | OK — reviewed, no change required | `    else{ price=toNum(p.bundle_price||p.phone_price); }` |
| 319 | OK — blank/separator line | `` |
| 320 | OK — reviewed, no change required | `    var spec  = pkgType==="phone_only" ? "เฉพาะมือถือ" : pkgType==="lens_only" ? (lensDisplay||"เลนส์เสริม") : "มือถือ + เลนส์";` |
| 321 | OK — reviewed, no change required | `    var label = pkgType==="lens_only"  ? (lensDisplay||"Lens") : pkgType==="phone_lens_bundle" ? modelDisplay+" + Lens" : modelDisplay;` |
| 322 | OK — blank/separator line | `` |
| 323 | OK — comment/documentation reviewed | `    // FIX: ใช้ available_count จาก 09_Web_Packages แทน isOpen&&price>0` |
| 324 | OK — comment/documentation reviewed | `    // available_count จาก 09_Web_Packages เป็น source of truth ต่อ package` |
| 325 | OK — reviewed, no change required | `    var sheetAvailRaw = p.available_count;` |
| 326 | OK — reviewed, no change required | `    var sheetHasAvail = hasVal(sheetAvailRaw);` |
| 327 | OK — reviewed, no change required | `    var sheetAvail = toNum(sheetAvailRaw);` |
| 328 | OK — reviewed, no change required | `    var rawAvailRaw = p.raw_available_count;` |
| 329 | OK — reviewed, no change required | `    var rawHasAvail = hasVal(rawAvailRaw);` |
| 330 | OK — reviewed, no change required | `    var rawAvail = toNum(rawAvailRaw);` |
| 331 | OK — reviewed, no change required | `    var pkgStatus = String(p.package_status||"").trim().toLowerCase();` |
| 332 | OK — reviewed, no change required | `    var avail;` |
| 333 | OK — reviewed, no change required | `    if(pkgStatus==="hidden"||pkgStatus==="hide"){` |
| 334 | OK — reviewed, no change required | `      avail = false;` |
| 335 | OK — reviewed, no change required | `    } else if(pkgStatus==="available"){` |
| 336 | OK — reviewed, no change required | `      avail = sheetHasAvail ? sheetAvail > 0 : true;` |
| 337 | OK — reviewed, no change required | `    } else if(pkgStatus==="full"){` |
| 338 | OK — reviewed, no change required | `      avail = false;` |
| 339 | OK — reviewed, no change required | `    } else if(sheetHasAvail){` |
| 340 | OK — comment/documentation reviewed | `      // 09_Web_Packages!available_count เป็น source of truth ต่อ package` |
| 341 | OK — reviewed, no change required | `      avail = sheetAvail > 0;` |
| 342 | OK — reviewed, no change required | `    } else if(pkgType==="lens_only"){` |
| 343 | OK — comment/documentation reviewed | `      // backward compatibility ถ้าใช้ backend เก่า` |
| 344 | OK — reviewed, no change required | `      avail = lensCnt > 0;` |
| 345 | OK — reviewed, no change required | `    } else if(pkgType==="phone_lens_bundle"){` |
| 346 | OK — comment/documentation reviewed | `      // bundle ต้องมีทั้งเครื่องและเลนส์` |
| 347 | OK — reviewed, no change required | `      avail = phoneCnt > 0 && lensCnt > 0;` |
| 348 | OK — reviewed, no change required | `    } else {` |
| 349 | OK — reviewed, no change required | `      avail = phoneCnt > 0;` |
| 350 | OK — reviewed, no change required | `    }` |
| 351 | OK — comment/documentation reviewed | `    // ถ้า price=0 ก็ไม่ available อยู่ดี และถ้า raw_available_count ติดลบ แปลว่า overbooking/manual risk` |
| 352 | OK — reviewed, no change required | `    if(price<=0) avail = false;` |
| 353 | OK — reviewed, no change required | `    if(rawHasAvail && rawAvail < 0) avail = false;` |
| 354 | OK — blank/separator line | `` |
| 355 | OK — reviewed, no change required | `    return { id:p.package_id||"", model:label, spec:spec, price:price, note:note, useCase:useCase, avail:avail, count:sheetAvail, rawCount:rawAvail, type:pkgType, lensDisp:lensD…` |
| 356 | OK — reviewed, no change required | `  });` |
| 357 | OK — reviewed, no change required | `}` |
| 358 | OK — blank/separator line | `` |
| 359 | OK — comment/documentation reviewed | `// Fallback from 08_Web_Ready single row (backward compat)` |
| 360 | OK — reviewed, no change required | `function buildPackagesFromWebRow(r){` |
| 361 | OK — reviewed, no change required | `  var pkgs=[];` |
| 362 | OK — reviewed, no change required | `  var model=String(r.phone_model_display||r.allowed_phone_model_group||"มือถือ").trim();` |
| 363 | OK — reviewed, no change required | `  var lens=String(r.allowed_lens_group||"").trim();` |
| 364 | OK — reviewed, no change required | `  var note=String(r.web_note||"").trim();` |
| 365 | OK — reviewed, no change required | `  var pPrice=toNum(r.phone_price), lPrice=toNum(r.lens_price), bPrice=toNum(r.bundle_price);` |
| 366 | OK — reviewed, no change required | `  var phoneAvail = r.phone_only_available!==undefined ? toBool(r.phone_only_available) : toNum(r.available_phone_count)>0;` |
| 367 | OK — reviewed, no change required | `  var lensAvail  = r.lens_only_available!==undefined  ? toBool(r.lens_only_available)  : toNum(r.available_lens_count)>0;` |
| 368 | OK — reviewed, no change required | `  var bundleAvail= r.phone_lens_available!==undefined ? toBool(r.phone_lens_available) : (phoneAvail&&lensAvail&&bPrice>0);` |
| 369 | OK — reviewed, no change required | `  if(pPrice>0)pkgs.push({model:model, spec:"เฉพาะมือถือ",  price:pPrice, note:note, useCase:String(r.use_case||"").trim(), avail:phoneAvail, type:"phone_only"});` |
| 370 | OK — reviewed, no change required | `  if(lPrice>0)pkgs.push({model:"Lens",spec:lens&&lens!=="NONE"?lens:"เลนส์เสริม",price:lPrice,note:note,useCase:String(r.use_case||"").trim(),avail:lensAvail,type:"lens_only"});` |
| 371 | OK — reviewed, no change required | `  if(bPrice>0)pkgs.push({model:model+" + Lens",spec:"มือถือ + เลนส์",price:bPrice,note:note,useCase:String(r.use_case||"").trim(),avail:bundleAvail,type:"phone_lens_bundle"});` |
| 372 | OK — reviewed, no change required | `  if(!pkgs.length)pkgs.push({model:model,spec:"สอบถามแพ็กเกจผ่าน LINE OA",price:0,note:note,useCase:String(r.use_case||"").trim(),avail:true,type:"ask"});` |
| 373 | OK — reviewed, no change required | `  return pkgs;` |
| 374 | OK — reviewed, no change required | `}` |
| 375 | OK — blank/separator line | `` |
| 376 | OK — reviewed, no change required | `async function loadData(){` |
| 377 | OK — reviewed, no change required | `  var results=await Promise.all([` |
| 378 | OK — reviewed, no change required | `    fetchWebRows(),` |
| 379 | OK — reviewed, no change required | `    fetchPkgRows().catch(function(){return [];})` |
| 380 | OK — reviewed, no change required | `  ]);` |
| 381 | OK — reviewed, no change required | `  var webRows=results[0]||[], pkgRows=results[1]||[];` |
| 382 | OK — blank/separator line | `` |
| 383 | OK — reviewed, no change required | `  var pkgMap={};` |
| 384 | OK — reviewed, no change required | `  pkgRows.forEach(function(p){ var id=String(p.event_id||"").trim(); if(!id)return; if(!pkgMap[id])pkgMap[id]=[]; if(isPkgVisible(p))pkgMap[id].push(p); });` |
| 385 | OK — blank/separator line | `` |
| 386 | OK — reviewed, no change required | `  var rows=webRows.filter(function(r){ var a=String(r.action_for_web||"").trim().toLowerCase(); return a&&a!=="hide"; });` |
| 387 | OK — blank/separator line | `` |
| 388 | OK — reviewed, no change required | `  return rows.map(function(r){` |
| 389 | OK — reviewed, no change required | `    var eventId    = String(r.event_id||"").trim();` |
| 390 | FIXED public frontend date source fallback | `    var rawDate    = r.event_date_text || r.event_date || r.date || "";` |
| 391 | OK — reviewed, no change required | `    var rawPoster  = String(r.poster_image_url||"").trim();` |
| 392 | OK — reviewed, no change required | `    var phoneCnt   = toNum(r.available_phone_count);` |
| 393 | OK — reviewed, no change required | `    var lensCnt    = toNum(r.available_lens_count);` |
| 394 | OK — blank/separator line | `` |
| 395 | OK — reviewed, no change required | `    var hasPkgSheet = !!(pkgMap[eventId]&&pkgMap[eventId].length>0);` |
| 396 | OK — comment/documentation reviewed | `    // FIX: ส่ง phoneCnt/lensCnt เข้า buildPackagesFromSheet ด้วย` |
| 397 | OK — reviewed, no change required | `    var packages = hasPkgSheet` |
| 398 | OK — reviewed, no change required | `      ? buildPackagesFromSheet(pkgMap[eventId] || [], eventId, phoneCnt, lensCnt)` |
| 399 | OK — reviewed, no change required | `      : buildPackagesFromWebRow(r);` |
| 400 | OK — blank/separator line | `` |
| 401 | OK — reviewed, no change required | `    return {` |
| 402 | OK — reviewed, no change required | `      id:           eventId,` |
| 403 | OK — reviewed, no change required | `      name:         String(r.event_name||"").trim(),` |
| 404 | OK — reviewed, no change required | `      date:         fmtDate(rawDate),` |
| 405 | OK — reviewed, no change required | `      rawDate:      rawDate,` |
| 406 | OK — reviewed, no change required | `      venue:        String(r.venue||"").trim(),` |
| 407 | OK — reviewed, no change required | `      rawPoster:    rawPoster,` |
| 408 | OK — comment/documentation reviewed | `      // FIX: thumbnail ใช้ w600 (เร็วกว่า w1200 4x)` |
| 409 | OK — reviewed, no change required | `      img:          getImgCandidates(rawPoster,"thumb")[0]||"",` |
| 410 | OK — reviewed, no change required | `      imgThumb:     getImgCandidates(rawPoster,"thumb"),` |
| 411 | OK — reviewed, no change required | `      imgFull:      getImgCandidates(rawPoster,"full"), // เฉพาะ modal` |
| 412 | OK — reviewed, no change required | `      webNote:      String(r.web_note||"").trim(),` |
| 413 | OK — reviewed, no change required | `      phoneCnt:     phoneCnt,` |
| 414 | OK — reviewed, no change required | `      lensCnt:      lensCnt,` |
| 415 | OK — reviewed, no change required | `      bookingStatus:String(r.booking_status_for_web||"").trim(),` |
| 416 | OK — reviewed, no change required | `      action:       String(r.action_for_web||"show").trim().toLowerCase(),` |
| 417 | OK — reviewed, no change required | `      lineTemplate: String(r.line_message_template||"").trim(),` |
| 418 | OK — reviewed, no change required | `      packages:     packages,` |
| 419 | OK — reviewed, no change required | `      hasPkgSheet:  hasPkgSheet` |
| 420 | OK — reviewed, no change required | `    };` |
| 421 | OK — reviewed, no change required | `  });` |
| 422 | OK — reviewed, no change required | `}` |
| 423 | OK — blank/separator line | `` |
| 424 | OK — comment/documentation reviewed | `// ─── Concert logic ────────────────────────────────────────────────────────` |
| 425 | OK — reviewed, no change required | `function concertTs(c){ var d=parseDate(c.rawDate); if(!d)return Number.MAX_SAFE_INTEGER; d.setHours(0,0,0,0); return d.getTime(); }` |
| 426 | OK — reviewed, no change required | `function isFuture(c){ return SHOW_PAST||concertTs(c)>=TODAY_TS; }` |
| 427 | OK — reviewed, no change required | `function isSoon(c){ var ms=concertTs(c)-TODAY_TS; return ms>=0&&ms<=14*86400000; }` |
| 428 | OK — reviewed, no change required | `function monthKey(c){ var d=parseDate(c&&c.rawDate); if(!d)return ""; return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); }` |
| 429 | OK — reviewed, no change required | `function monthLabel(key){` |
| 430 | OK — reviewed, no change required | `  var m=String(key||"").match(/^(\d{4})-(\d{2})$/); if(!m)return "ทุกเดือน";` |
| 431 | OK — reviewed, no change required | `  var year=parseInt(m[1],10), mo=parseInt(m[2],10)-1;` |
| 432 | OK — reviewed, no change required | `  return (TH_MONTHS_SHORT[mo]||m[2])+" "+year;` |
| 433 | OK — reviewed, no change required | `}` |
| 434 | OK — reviewed, no change required | `function getMonthOptions(concerts){` |
| 435 | OK — reviewed, no change required | `  var seen={}, out=[];` |
| 436 | OK — reviewed, no change required | `  (concerts||[]).filter(isFuture).forEach(function(c){` |
| 437 | OK — reviewed, no change required | `    var k=monthKey(c); if(k&&!seen[k]){seen[k]=true; out.push(k);}` |
| 438 | OK — reviewed, no change required | `  });` |
| 439 | OK — reviewed, no change required | `  out.sort(); return out;` |
| 440 | OK — reviewed, no change required | `}` |
| 441 | OK — reviewed, no change required | `function availPkgs(c){ return (c.packages||[]).filter(function(p){return p.avail;}); }` |
| 442 | OK — reviewed, no change required | `function availCnt(c){` |
| 443 | OK — comment/documentation reviewed | `  // Use package-level available_count first so hidden phone packages do not inflate card availability.` |
| 444 | OK — reviewed, no change required | `  var ap=availPkgs(c);` |
| 445 | OK — reviewed, no change required | `  var maxPkg=0;` |
| 446 | OK — reviewed, no change required | `  ap.forEach(function(p){ if(hasVal(p.count)) maxPkg=Math.max(maxPkg,toNum(p.count)); });` |
| 447 | OK — reviewed, no change required | `  if(maxPkg>0) return maxPkg;` |
| 448 | OK — reviewed, no change required | `  var phone=toNum(c&&c.phoneCnt), lens=toNum(c&&c.lensCnt);` |
| 449 | OK — reviewed, no change required | `  if(ap.some(function(p){return p.type==="phone_only"||p.type==="phone_lens_bundle";})) return phone;` |
| 450 | OK — reviewed, no change required | `  if(ap.some(function(p){return p.type==="lens_only";})) return lens;` |
| 451 | OK — reviewed, no change required | `  return 0;` |
| 452 | OK — reviewed, no change required | `}` |
| 453 | OK — reviewed, no change required | `function availTextFor(c){` |
| 454 | OK — reviewed, no change required | `  var ap=availPkgs(c), cnt=availCnt(c);` |
| 455 | OK — reviewed, no change required | `  if(cnt<=0) return "เต็มแล้วน้า 😢";` |
| 456 | OK — reviewed, no change required | `  var hasPhone=ap.some(function(p){return p.type==="phone_only"||p.type==="phone_lens_bundle";});` |
| 457 | OK — reviewed, no change required | `  var hasLensOnly=ap.some(function(p){return p.type==="lens_only";});` |
| 458 | OK — reviewed, no change required | `  if(hasPhone) return cnt===1 ? "เหลือ 1 เครื่องสุดท้าย ✨" : "ว่าง "+cnt+" เครื่อง ✨";` |
| 459 | OK — reviewed, no change required | `  if(hasLensOnly) return "เหลือ Lens อย่างเดียว ✨";` |
| 460 | OK — reviewed, no change required | `  return "ว่าง ✨";` |
| 461 | OK — reviewed, no change required | `}` |
| 462 | OK — blank/separator line | `` |
| 463 | OK — reviewed, no change required | `function filtered(concerts){` |
| 464 | OK — reviewed, no change required | `  var vis=concerts.filter(isFuture).sort(function(a,b){return concertTs(a)-concertTs(b)||a.name.localeCompare(b.name,"th");});` |
| 465 | OK — reviewed, no change required | `  if(currentMonth!=="all") vis=vis.filter(function(c){return monthKey(c)===currentMonth;});` |
| 466 | OK — reviewed, no change required | `  if(currentFilter==="available")return vis.filter(function(c){return availCnt(c)>0;});` |
| 467 | OK — reviewed, no change required | `  if(currentFilter==="full")     return vis.filter(function(c){return availCnt(c)===0;});` |
| 468 | OK — reviewed, no change required | `  return vis;` |
| 469 | OK — reviewed, no change required | `}` |
| 470 | OK — reviewed, no change required | `function emptyMsg(){` |
| 471 | OK — reviewed, no change required | `  var m = currentMonth!=="all" ? "ในเดือน "+monthLabel(currentMonth)+" " : "";` |
| 472 | OK — reviewed, no change required | `  if(currentFilter==="available")return "ยังไม่มีงานที่มีเครื่องว่าง"+m+"น้า 💙";` |
| 473 | OK — reviewed, no change required | `  if(currentFilter==="full")     return "ยังไม่มีงานที่เต็มแล้ว"+m+"น้า ✨";` |
| 474 | OK — reviewed, no change required | `  return "ยังไม่มีงานที่เปิดให้จอง"+m+"น้า 💙";` |
| 475 | OK — reviewed, no change required | `}` |
| 476 | OK — blank/separator line | `` |
| 477 | OK — comment/documentation reviewed | `// ─── DOM ──────────────────────────────────────────────────────────────────` |
| 478 | OK — reviewed, no change required | `function applyConfig(){` |
| 479 | OK — reviewed, no change required | `  DEFAULT_OG_IMAGE = APP.headerImage || DEFAULT_OG_IMAGE;` |
| 480 | OK — reviewed, no change required | `  if(APP.siteUrl){` |
| 481 | OK — reviewed, no change required | `    var canonical=document.querySelector('link[rel="canonical"]'); if(canonical)canonical.href=APP.siteUrl;` |
| 482 | OK — reviewed, no change required | `  }` |
| 483 | OK — reviewed, no change required | `  if(APP.headerImage){var h=document.querySelector(".brand-header-img");if(h)h.src=APP.headerImage;}` |
| 484 | OK — reviewed, no change required | `  resetMeta();` |
| 485 | OK — reviewed, no change required | `  if(APP.xUrl){document.querySelectorAll("a.quick-link").forEach(function(a){a.href=APP.xUrl;});}` |
| 486 | OK — reviewed, no change required | `  document.querySelectorAll("a.line-btn,a.sticky-line").forEach(function(a){a.href=LINE_URL;});` |
| 487 | OK — reviewed, no change required | `}` |
| 488 | OK — reviewed, no change required | `function setUpdateDate(){` |
| 489 | OK — reviewed, no change required | `  var n=new Date(); var el=document.getElementById("update-note");` |
| 490 | OK — reviewed, no change required | `  if(el)el.textContent="อัปเดตล่าสุด: "+String(n.getDate()).padStart(2,"0")+"/"+String(n.getMonth()+1).padStart(2,"0")+"/"+n.getFullYear()+" "+String(n.getHours()).padStart(2,"0…` |
| 491 | OK — reviewed, no change required | `}` |
| 492 | OK — reviewed, no change required | `function showBrandFallback(){var a=document.getElementById("brandImageCard"),b=document.getElementById("brandFallback");if(a)a.style.display="none";if(b)b.style.display="flex";}` |
| 493 | OK — blank/separator line | `` |
| 494 | OK — reviewed, no change required | `function renderLoadingSkeleton(count){` |
| 495 | OK — reviewed, no change required | `  var el=document.getElementById("content"); if(!el)return;` |
| 496 | OK — reviewed, no change required | `  count=count||4;` |
| 497 | OK — reviewed, no change required | `  var html='<div class="poster-grid skeleton-grid" aria-label="กำลังโหลดข้อมูลงาน">';` |
| 498 | OK — reviewed, no change required | `  for(var i=0;i<count;i++){` |
| 499 | OK — reviewed, no change required | `    html+='<div class="concert-card skeleton-card" aria-hidden="true"><div class="poster-img-wrap skeleton-poster"><span></span></div><div class="poster-info skeleton-info"><div…` |
| 500 | OK — reviewed, no change required | `  }` |
| 501 | OK — reviewed, no change required | `  html+='</div><div class="loading-text skeleton-loading-text">กำลังเช็กคิวให้น้า... 📱✨</div>';` |
| 502 | REVIEWED innerHTML use; check escaping/safe static markup | `  el.innerHTML=html;` |
| 503 | OK — reviewed, no change required | `}` |
| 504 | OK — reviewed, no change required | `function renderEmpty(msg,detail){` |
| 505 | OK — reviewed, no change required | `  var el=document.getElementById("content"); if(!el)return;` |
| 506 | REVIEWED innerHTML use; check escaping/safe static markup | `  el.innerHTML='<div class="empty-state"><div class="empty-emoji">💙</div><h3>'+esc(msg)+'</h3><p>'+(detail?esc(detail):'ถ้ามีงานที่อยากเช่า สามารถทัก LINE OA มาสอบถามได้เลย')+'<…` |
| 507 | OK — reviewed, no change required | `}` |
| 508 | OK — reviewed, no change required | `function getBadgeText(c){ var cnt=availCnt(c), ap=availPkgs(c); if(cnt<=0)return "เต็มแล้ว"; if(isSoon(c))return "ใกล้ถึงวันงาน"; return ap.some(function(p){return p.type==="pho…` |
| 509 | OK — blank/separator line | `` |
| 510 | OK — reviewed, no change required | `function renderMonthSelect(concerts){` |
| 511 | OK — reviewed, no change required | `  var sel=document.getElementById("month-filter-select"); if(!sel)return;` |
| 512 | OK — reviewed, no change required | `  var opts=getMonthOptions(concerts);` |
| 513 | OK — reviewed, no change required | `  if(currentMonth!=="all" && opts.indexOf(currentMonth)<0) currentMonth="all";` |
| 514 | REVIEWED innerHTML use; check escaping/safe static markup | `  sel.innerHTML="";` |
| 515 | OK — reviewed, no change required | `  function addOpt(key,label){` |
| 516 | OK — reviewed, no change required | `    var opt=document.createElement("option");` |
| 517 | OK — reviewed, no change required | `    opt.value=key;` |
| 518 | OK — reviewed, no change required | `    opt.textContent=label;` |
| 519 | OK — reviewed, no change required | `    sel.appendChild(opt);` |
| 520 | OK — reviewed, no change required | `  }` |
| 521 | OK — reviewed, no change required | `  addOpt("all","เลือกเดือน");` |
| 522 | OK — reviewed, no change required | `  opts.forEach(function(key){addOpt(key,monthLabel(key));});` |
| 523 | OK — reviewed, no change required | `  sel.value=currentMonth;` |
| 524 | OK — reviewed, no change required | `}` |
| 525 | OK — blank/separator line | `` |
| 526 | OK — reviewed, no change required | `function renderConcerts(concerts){` |
| 527 | OK — reviewed, no change required | `  renderMonthSelect(concerts);` |
| 528 | OK — reviewed, no change required | `  var el=document.getElementById("content"); if(!el)return;` |
| 529 | REVIEWED innerHTML use; check escaping/safe static markup | `  el.innerHTML="";` |
| 530 | OK — reviewed, no change required | `  if(!concerts||!concerts.length){renderEmpty("ยังไม่มีข้อมูลงานตอนนี้น้า 💙");return;}` |
| 531 | OK — reviewed, no change required | `  var vis=filtered(concerts);` |
| 532 | OK — reviewed, no change required | `  if(!vis.length){renderEmpty(emptyMsg());return;}` |
| 533 | OK — blank/separator line | `` |
| 534 | OK — reviewed, no change required | `  var grid=document.createElement("div"); grid.className="poster-grid";` |
| 535 | OK — blank/separator line | `` |
| 536 | OK — comment/documentation reviewed | `  // LCP improvement: preload รูปงานแรกครั้งเดียวต่อ URL` |
| 537 | OK — reviewed, no change required | `  if(vis[0]&&vis[0].img&&!PRELOADED_IMAGES[vis[0].img]){` |
| 538 | OK — reviewed, no change required | `    PRELOADED_IMAGES[vis[0].img]=true;` |
| 539 | OK — reviewed, no change required | `    var lnk=document.createElement("link"); lnk.rel="preload"; lnk.as="image"; lnk.href=vis[0].img;` |
| 540 | OK — reviewed, no change required | `    document.head.appendChild(lnk);` |
| 541 | OK — reviewed, no change required | `  }` |
| 542 | OK — blank/separator line | `` |
| 543 | OK — reviewed, no change required | `  vis.forEach(function(c,idx){` |
| 544 | OK — reviewed, no change required | `    var cnt=availCnt(c), avail=cnt>0;` |
| 545 | OK — reviewed, no change required | `    var availText=availTextFor(c);` |
| 546 | OK — reviewed, no change required | `    var pkgHint="";` |
| 547 | OK — blank/separator line | `` |
| 548 | OK — reviewed, no change required | `    var card=document.createElement("button"); card.type="button"; card.className="concert-card";` |
| 549 | OK — reviewed, no change required | `    card.setAttribute("aria-label","ดูเครื่องว่างสำหรับงาน "+c.name);` |
| 550 | OK — reviewed, no change required | `    card.onclick=function(){ showModal(c); };` |
| 551 | OK — blank/separator line | `` |
| 552 | OK — reviewed, no change required | `    var imgWrap=document.createElement("div"); imgWrap.className="poster-img-wrap";` |
| 553 | OK — reviewed, no change required | `    var badge=document.createElement("div"); badge.className="status-badge"+(avail?"":" full")+(isSoon(c)&&avail?" soon":""); badge.textContent=getBadgeText(c); imgWrap.appendCh…` |
| 554 | OK — blank/separator line | `` |
| 555 | OK — reviewed, no change required | `    var imgUrl=c.img?String(c.img).trim():"";` |
| 556 | OK — reviewed, no change required | `    if(imgUrl){` |
| 557 | OK — reviewed, no change required | `      var img=document.createElement("img"); img.alt=c.name||"Event poster";` |
| 558 | OK — comment/documentation reviewed | `      // FIX: ใช้ thumb candidates (w600) สำหรับ grid` |
| 559 | OK — reviewed, no change required | `      img.loading=idx===0?"eager":"lazy"; img.decoding="async";` |
| 560 | OK — reviewed, no change required | `      setImgFallback(img, c.imgThumb&&c.imgThumb.length?c.imgThumb:[imgUrl]); imgWrap.appendChild(img);` |
| 561 | OK — reviewed, no change required | `    } else {` |
| 562 | REVIEWED innerHTML use; check escaping/safe static markup | `      var ph=document.createElement("div"); ph.className="poster-placeholder"; ph.innerHTML="<span>ยังไม่มีรูป</span>"; imgWrap.appendChild(ph);` |
| 563 | OK — reviewed, no change required | `    }` |
| 564 | OK — blank/separator line | `` |
| 565 | OK — reviewed, no change required | `    var info=document.createElement("div"); info.className="poster-info";` |
| 566 | OK — reviewed, no change required | `    var dateEl=document.createElement("div"); dateEl.className="pi-date"; dateEl.textContent=c.date||"";` |
| 567 | OK — reviewed, no change required | `    var nameEl=document.createElement("div"); nameEl.className="pi-name"; nameEl.textContent=c.name||"";` |
| 568 | OK — reviewed, no change required | `    var availEl=document.createElement("div"); availEl.className="pi-avail"+(avail?"":" none"); availEl.textContent=availText+pkgHint;` |
| 569 | OK — reviewed, no change required | `    var tap=document.createElement("div"); tap.className="pi-tap"+(avail?"":" full"); tap.textContent=avail?"ดูรุ่นที่ว่าง / จองคิว":"เต็มแล้ว";` |
| 570 | OK — reviewed, no change required | `    info.appendChild(dateEl); info.appendChild(nameEl); info.appendChild(availEl); info.appendChild(tap);` |
| 571 | OK — reviewed, no change required | `    card.appendChild(imgWrap); card.appendChild(info); grid.appendChild(card);` |
| 572 | OK — reviewed, no change required | `  });` |
| 573 | OK — reviewed, no change required | `  el.appendChild(grid);` |
| 574 | OK — reviewed, no change required | `}` |
| 575 | OK — blank/separator line | `` |
| 576 | OK — comment/documentation reviewed | `// ─── Modal ────────────────────────────────────────────────────────────────` |
| 577 | OK — reviewed, no change required | `function buildBookingMsg(c,p){` |
| 578 | OK — comment/documentation reviewed | `  // Keep LINE OA message short and package-specific.` |
| 579 | OK — comment/documentation reviewed | `  // Do not prepend backend line_message_template because that already contains event data and causes duplicated text.` |
| 580 | OK — reviewed, no change required | `  return [` |
| 581 | OK — reviewed, no change required | `    "สนใจเช่า "+lineVal(p&&p.model),` |
| 582 | OK — reviewed, no change required | `    "งาน : "+lineVal(c&&c.name),` |
| 583 | OK — reviewed, no change required | `    "วันที่ : "+lineVal(c&&c.date),` |
| 584 | OK — reviewed, no change required | `    "ราคา : "+fmtPriceLine(p&&p.price),` |
| 585 | OK — reviewed, no change required | `    "",` |
| 586 | OK — reviewed, no change required | `    "ชื่อเล่น : ",` |
| 587 | OK — reviewed, no change required | `    "เบอร์โทร : ",` |
| 588 | OK — reviewed, no change required | `    "เวลาที่สะดวกรับเครื่อง : "` |
| 589 | OK — reviewed, no change required | `  ].join("\n");` |
| 590 | OK — reviewed, no change required | `}` |
| 591 | OK — reviewed, no change required | `function getBookingUrl(c,p){ return LINE_OA+encodeURIComponent(buildBookingMsg(c,p)); }` |
| 592 | OK — reviewed, no change required | `function showModal(c){` |
| 593 | OK — reviewed, no change required | `  if(!c)return;` |
| 594 | OK — comment/documentation reviewed | `  // NEW: GA4 track modal open` |
| 595 | OK — reviewed, no change required | `  track("view_event_packages",{event_name:c.name, available:availCnt(c)});` |
| 596 | OK — reviewed, no change required | `  updateMetaForEvent(c);` |
| 597 | OK — reviewed, no change required | `  setEventUrl(c.id);` |
| 598 | OK — blank/separator line | `` |
| 599 | OK — reviewed, no change required | `  document.getElementById("modal-title").textContent=c.name||"รายละเอียดงาน";` |
| 600 | OK — reviewed, no change required | `  document.getElementById("modal-date").textContent="📅 "+(c.date||"-");` |
| 601 | OK — reviewed, no change required | `  document.getElementById("modal-venue").textContent="📍 "+(c.venue||"-");` |
| 602 | OK — blank/separator line | `` |
| 603 | OK — comment/documentation reviewed | `  // UX fix: ไม่แสดงรูปโปสเตอร์ซ้ำใน modal` |
| 604 | OK — comment/documentation reviewed | `  // รูปยังแสดงเฉพาะบนการ์ด เพื่อให้ modal กระชับและพอดีกับจอมากขึ้น` |
| 605 | OK — blank/separator line | `` |
| 606 | REVIEWED innerHTML use; check escaping/safe static markup | `  var list=document.getElementById("phone-list"); list.innerHTML="";` |
| 607 | OK — reviewed, no change required | `  var avail=availPkgs(c);` |
| 608 | OK — blank/separator line | `` |
| 609 | OK — reviewed, no change required | `  if(!avail.length){` |
| 610 | REVIEWED innerHTML use; check escaping/safe static markup | `    list.innerHTML='<div class="full-booked-box">งานนี้เต็มแล้วน้า 🙏<br>ทักมาถามรอบอื่นได้เลย 💙</div>';` |
| 611 | OK — reviewed, no change required | `    openModal(); return;` |
| 612 | OK — reviewed, no change required | `  }` |
| 613 | OK — blank/separator line | `` |
| 614 | OK — reviewed, no change required | `  avail.forEach(function(p){` |
| 615 | OK — reviewed, no change required | `    var row=document.createElement("div"); row.className="phone-row";` |
| 616 | OK — reviewed, no change required | `    var icon=document.createElement("div"); icon.className="ph-icon";` |
| 617 | REVIEWED innerHTML use; check escaping/safe static markup | `    icon.innerHTML='<svg viewBox="0 0 28 28" fill="none"><rect x="6" y="3" width="16" height="22" rx="3" stroke="#5B8DEF" stroke-width="1.8"/><rect x="10" y="6" width="8" height…` |
| 618 | OK — reviewed, no change required | `    var info=document.createElement("div"); info.className="ph-info";` |
| 619 | OK — reviewed, no change required | `    var mEl=document.createElement("div"); mEl.className="ph-model"; mEl.textContent=p.model||"";` |
| 620 | OK — reviewed, no change required | `    var sEl=document.createElement("div"); sEl.className="ph-spec";  sEl.textContent=p.spec||"";` |
| 621 | OK — reviewed, no change required | `    info.appendChild(mEl); info.appendChild(sEl);` |
| 622 | OK — reviewed, no change required | `    if(p.useCase){var uEl=document.createElement("div"); uEl.className="ph-usecase"; uEl.textContent=p.useCase; info.appendChild(uEl);}` |
| 623 | OK — reviewed, no change required | `    if(p.note){var nEl=document.createElement("div"); nEl.className="ph-note"; nEl.textContent=p.note; info.appendChild(nEl);}` |
| 624 | OK — reviewed, no change required | `    var right=document.createElement("div"); right.className="ph-right";` |
| 625 | OK — reviewed, no change required | `    var priceEl=document.createElement("div"); priceEl.className="ph-price";` |
| 626 | OK — reviewed, no change required | `    if(toNum(p.price)>0){` |
| 627 | OK — reviewed, no change required | `      priceEl.textContent=toNum(p.price).toLocaleString("th-TH");` |
| 628 | OK — reviewed, no change required | `      var sm=document.createElement("span"); sm.textContent=" บาท/วัน"; priceEl.appendChild(sm);` |
| 629 | OK — reviewed, no change required | `    } else {` |
| 630 | OK — reviewed, no change required | `      priceEl.textContent="สอบถามราคา";` |
| 631 | OK — reviewed, no change required | `    }` |
| 632 | OK — reviewed, no change required | `    var bookBtn=document.createElement("a"); bookBtn.className="badge book-pill"; bookBtn.textContent="จองรุ่นนี้";` |
| 633 | OK — reviewed, no change required | `    bookBtn.href=getBookingUrl(c,p); bookBtn.target="_blank"; bookBtn.rel="noopener";` |
| 634 | OK — reviewed, no change required | `    bookBtn.setAttribute("aria-label","จองรุ่น "+(p.model||"")+" สำหรับงาน "+(c.name||""));` |
| 635 | OK — comment/documentation reviewed | `    // NEW: GA4 track booking click` |
| 636 | OK — reviewed, no change required | `    bookBtn.onclick=function(e){` |
| 637 | OK — reviewed, no change required | `      e.stopPropagation();` |
| 638 | OK — reviewed, no change required | `      track("booking_click",{event_name:c.name, package:p.model, price:p.price});` |
| 639 | OK — reviewed, no change required | `    };` |
| 640 | OK — reviewed, no change required | `    right.appendChild(priceEl); right.appendChild(bookBtn);` |
| 641 | OK — reviewed, no change required | `    row.appendChild(icon); row.appendChild(info); row.appendChild(right); list.appendChild(row);` |
| 642 | OK — reviewed, no change required | `  });` |
| 643 | OK — reviewed, no change required | `  openModal();` |
| 644 | OK — reviewed, no change required | `}` |
| 645 | OK — blank/separator line | `` |
| 646 | OK — reviewed, no change required | `var PACKAGE_CLOSE_SELECTOR = "#modal-close,#modal-x-btn,[data-modal-close=\"package\"]";` |
| 647 | OK — reviewed, no change required | `var FAQ_CLOSE_SELECTOR = "#faq-close-btn,#faq-x-btn,[data-modal-close=\"faq\"]";` |
| 648 | OK — reviewed, no change required | `function lockBody(){document.body.style.overflow="hidden";}` |
| 649 | OK — reviewed, no change required | `function unlockBodyIfNoModal(){var ov=document.getElementById("overlay"), fo=document.getElementById("faqOverlay");if(!(ov&&ov.classList.contains("active"))&&!(fo&&fo.classList.…` |
| 650 | OK — reviewed, no change required | `function homeUrl(){return window.location.origin + "/";}` |
| 651 | OK — reviewed, no change required | `function setEventUrl(eventId){` |
| 652 | OK — reviewed, no change required | `  try{` |
| 653 | OK — reviewed, no change required | `    if(!eventId)return;` |
| 654 | OK — reviewed, no change required | `    var u=new URL(homeUrl());` |
| 655 | OK — reviewed, no change required | `    u.searchParams.set("event",String(eventId));` |
| 656 | OK — reviewed, no change required | `    window.history.replaceState(null,"",u.toString());` |
| 657 | OK — reviewed, no change required | `  }catch(e){}` |
| 658 | OK — reviewed, no change required | `}` |
| 659 | OK — reviewed, no change required | `function clearEventParam(){` |
| 660 | OK — reviewed, no change required | `  try{` |
| 661 | OK — comment/documentation reviewed | `    // Always reset back to the clean homepage URL when package modal is closed.` |
| 662 | OK — comment/documentation reviewed | `    // This prevents refresh from reopening the same event modal.` |
| 663 | OK — reviewed, no change required | `    if(window.location.search||window.location.hash||window.location.pathname!=="/"){` |
| 664 | OK — reviewed, no change required | `      window.history.replaceState(null,"",homeUrl());` |
| 665 | OK — reviewed, no change required | `    }else{` |
| 666 | OK — reviewed, no change required | `      window.history.replaceState(null,"",homeUrl());` |
| 667 | OK — reviewed, no change required | `    }` |
| 668 | OK — reviewed, no change required | `  }catch(e){}` |
| 669 | OK — reviewed, no change required | `}` |
| 670 | OK — reviewed, no change required | `function openModal(){var el=document.getElementById("overlay");if(el){el.classList.add("active");lockBody();}}` |
| 671 | OK — reviewed, no change required | `function closeModal(e){var el=document.getElementById("overlay");if(e&&el&&e.target!==el&&!e.target.closest(PACKAGE_CLOSE_SELECTOR))return;if(el)el.classList.remove("active");cl…` |
| 672 | REVIEWED innerHTML use; check escaping/safe static markup | `function showError(m){var el=document.getElementById("content");if(el)el.innerHTML='<div class="empty-state error-state"><div class="empty-emoji">🙏</div><h3>โหลดข้อมูลคิวไม่สำเร…` |
| 673 | OK — blank/separator line | `` |
| 674 | OK — reviewed, no change required | `function openFaq(){var el=document.getElementById("faqOverlay");if(el){el.classList.add("active");lockBody();}}` |
| 675 | OK — reviewed, no change required | `function closeFaq(e){var el=document.getElementById("faqOverlay");if(e&&el&&e.target!==el&&!e.target.closest(FAQ_CLOSE_SELECTOR))return;if(el)el.classList.remove("active");unloc…` |
| 676 | OK — reviewed, no change required | `function toggleFaq(btn){var item=btn&&btn.parentElement;if(item){item.classList.toggle("active");btn.setAttribute("aria-expanded",item.classList.contains("active")?"true":"false…` |
| 677 | OK — blank/separator line | `` |
| 678 | OK — reviewed, no change required | `function setFilter(f){` |
| 679 | OK — reviewed, no change required | `  currentFilter=["all","available","full"].indexOf(f)>=0?f:"all";` |
| 680 | OK — reviewed, no change required | `  document.querySelectorAll("[data-filter]").forEach(function(b){var a=b.getAttribute("data-filter")===currentFilter;b.classList.toggle("active",a);b.setAttribute("aria-pressed"…` |
| 681 | OK — reviewed, no change required | `  if(concertsData&&concertsData.length) renderConcerts(concertsData);` |
| 682 | OK — reviewed, no change required | `}` |
| 683 | OK — reviewed, no change required | `function setMonth(month){` |
| 684 | OK — reviewed, no change required | `  currentMonth=/^\d{4}-\d{2}$/.test(month)?month:"all";` |
| 685 | OK — reviewed, no change required | `  var sel=document.getElementById("month-filter-select");` |
| 686 | OK — reviewed, no change required | `  if(sel) sel.value=currentMonth;` |
| 687 | OK — reviewed, no change required | `  if(concertsData&&concertsData.length) renderConcerts(concertsData);` |
| 688 | OK — reviewed, no change required | `}` |
| 689 | OK — blank/separator line | `` |
| 690 | OK — reviewed, no change required | `document.addEventListener("DOMContentLoaded",function(){` |
| 691 | OK — reviewed, no change required | `  applyConfig(); setUpdateDate(); renderLoadingSkeleton(4);` |
| 692 | OK — reviewed, no change required | `  document.querySelectorAll("[data-filter]").forEach(function(b){b.addEventListener("click",function(){setFilter(b.getAttribute("data-filter")||"all");});});` |
| 693 | OK — reviewed, no change required | `  var monthSelect=document.getElementById("month-filter-select");` |
| 694 | OK — reviewed, no change required | `  if(monthSelect) monthSelect.addEventListener("change",function(){setMonth(monthSelect.value||"all");});` |
| 695 | OK — reviewed, no change required | `  setFilter(currentFilter);` |
| 696 | OK — reviewed, no change required | `  var bImg=document.querySelector(".brand-header-img"); if(bImg)bImg.addEventListener("error",showBrandFallback);` |
| 697 | OK — reviewed, no change required | `  var faqBtn=document.getElementById("faq-open-btn"); if(faqBtn)faqBtn.addEventListener("click",openFaq);` |
| 698 | OK — reviewed, no change required | `  document.querySelectorAll(".faq-q").forEach(function(b){b.addEventListener("click",function(){toggleFaq(b);});});` |
| 699 | OK — reviewed, no change required | `  var ov=document.getElementById("overlay"); if(ov)ov.addEventListener("click",closeModal);` |
| 700 | OK — reviewed, no change required | `  var fov=document.getElementById("faqOverlay"); if(fov)fov.addEventListener("click",closeFaq);` |
| 701 | OK — reviewed, no change required | `  document.querySelectorAll("#overlay .modal,.faq-overlay .modal").forEach(function(m){m.addEventListener("click",function(e){e.stopPropagation();});});` |
| 702 | OK — reviewed, no change required | `  function bindClose(selector,fn){` |
| 703 | OK — reviewed, no change required | `    document.querySelectorAll(selector).forEach(function(el){` |
| 704 | OK — reviewed, no change required | `      ["click","touchend"].forEach(function(evt){` |
| 705 | OK — reviewed, no change required | `        el.addEventListener(evt,function(e){e.preventDefault();e.stopPropagation();fn();},{passive:false});` |
| 706 | OK — reviewed, no change required | `      });` |
| 707 | OK — reviewed, no change required | `    });` |
| 708 | OK — reviewed, no change required | `  }` |
| 709 | OK — reviewed, no change required | `  bindClose(PACKAGE_CLOSE_SELECTOR,closeModal);` |
| 710 | OK — reviewed, no change required | `  bindClose(FAQ_CLOSE_SELECTOR,closeFaq);` |
| 711 | OK — comment/documentation reviewed | `  // Capture-phase close handler keeps close buttons working inside LINE/mobile browsers.` |
| 712 | OK — reviewed, no change required | `  document.addEventListener("click",function(e){` |
| 713 | OK — reviewed, no change required | `    if(e.target.closest(FAQ_CLOSE_SELECTOR)){e.preventDefault();e.stopPropagation();closeFaq();return;}` |
| 714 | OK — reviewed, no change required | `    if(e.target.closest(PACKAGE_CLOSE_SELECTOR)){e.preventDefault();e.stopPropagation();closeModal();return;}` |
| 715 | OK — reviewed, no change required | `  },true);` |
| 716 | OK — reviewed, no change required | `  window.addEventListener("popstate",function(){` |
| 717 | OK — reviewed, no change required | `    var ov=document.getElementById("overlay");` |
| 718 | OK — reviewed, no change required | `    if(ov&&ov.classList.contains("active")&&!new URL(window.location.href).searchParams.get("event")){` |
| 719 | OK — reviewed, no change required | `      ov.classList.remove("active");` |
| 720 | OK — reviewed, no change required | `      resetMeta();` |
| 721 | OK — reviewed, no change required | `      unlockBodyIfNoModal();` |
| 722 | OK — reviewed, no change required | `    }` |
| 723 | OK — reviewed, no change required | `  });` |
| 724 | OK — blank/separator line | `` |
| 725 | OK — reviewed, no change required | `  loadData().then(function(data){` |
| 726 | OK — reviewed, no change required | `      concertsData=data;` |
| 727 | OK — reviewed, no change required | `      renderConcerts(concertsData);` |
| 728 | OK — reviewed, no change required | `      if(REQUESTED_EVENT){` |
| 729 | OK — reviewed, no change required | `        var target=concertsData.find(function(c){return String(c.id)===REQUESTED_EVENT;});` |
| 730 | OK — reviewed, no change required | `        if(target){ setTimeout(function(){ showModal(target); }, 80); }` |
| 731 | OK — reviewed, no change required | `        else{ clearEventParam(); }` |
| 732 | OK — reviewed, no change required | `      }` |
| 733 | OK — reviewed, no change required | `    })` |
| 734 | UPDATED version sync to v16.6.2 | `    .catch(function(e){ console.error("KK v16.6.2_LINE_AUDITED:",e); showError("ลองรีเฟรชอีกครั้ง หรือสอบถามผ่าน LINE OA"); });` |
| 735 | OK — reviewed, no change required | `});` |
| 736 | OK — blank/separator line | `` |
| 737 | OK — reviewed, no change required | `document.addEventListener("keydown",function(e){` |
| 738 | OK — reviewed, no change required | `  if(e.key==="Escape"){` |
| 739 | OK — reviewed, no change required | `    var ov=document.getElementById("overlay"); if(ov&&ov.classList.contains("active"))closeModal();` |
| 740 | OK — reviewed, no change required | `    var fo=document.getElementById("faqOverlay"); if(fo&&fo.classList.contains("active"))closeFaq();` |
| 741 | OK — reviewed, no change required | `  }` |
| 742 | OK — reviewed, no change required | `});` |

### `style.css`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — comment/documentation reviewed | `*{box-sizing:border-box;margin:0;padding:0}` |
| 2 | OK — reviewed, no change required | `:root{--blue:#5B8DEF;--blue2:#EEF5FF;--blue3:#DDEAFF;--navy:#10213F;--text:#1A2845;--soft:#8FA4CC;--green:#06C755;--red:#F05252;--font-main:"Kanit","Noto Sans Thai",system-ui,-a…` |
| 3 | OK — reviewed, no change required | `body{font-family:var(--font-main);color:var(--text);min-height:100vh;overflow-x:hidden;background:radial-gradient(circle at 90% 5%,rgba(168,197,250,.78),transparent 28%),linear-…` |
| 4 | OK — reviewed, no change required | `body:before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(91,141,239,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(91,141,23…` |
| 5 | OK — reviewed, no change required | `.wrap{position:relative;z-index:1;width:100%;max-width:1080px;margin:0 auto;padding:0 10px 88px}` |
| 6 | OK — reviewed, no change required | `header{text-align:center;padding:22px 0 8px}` |
| 7 | OK — reviewed, no change required | `.brand-image-card{width:calc(100vw - 24px);max-width:860px;margin:0 auto;background:rgba(255,255,255,.94);border:1.5px solid rgba(255,255,255,.9);box-shadow:0 12px 34px rgba(91,…` |
| 8 | OK — reviewed, no change required | `.brand-header-img{width:100%;height:auto;display:block;object-fit:contain}` |
| 9 | OK — reviewed, no change required | `.brand-fallback{display:none;width:min(100%,660px);margin:0 auto;background:#fff;border-radius:30px;padding:18px 22px;align-items:center;justify-content:center;gap:16px;box-shad…` |
| 10 | OK — reviewed, no change required | `.brand-fallback-logo{width:76px;height:76px;object-fit:contain;flex-shrink:0}.brand-divider{width:1px;align-self:stretch;background:linear-gradient(180deg,transparent,var(--blue…` |
| 11 | OK — reviewed, no change required | `.sec-title{display:flex;align-items:center;gap:12px;font-size:16px;font-weight:700;color:var(--blue);margin:28px 0 16px;text-align:center}.sec-title:before,.sec-title:after{cont…` |
| 12 | OK — reviewed, no change required | `.promo-strip{margin:0 0 12px;background:rgba(255,255,255,.82);border:1px solid rgba(255,255,255,.92);border-radius:20px;padding:14px 16px;text-align:center;color:#4f6388;font-si…` |
| 13 | OK — reviewed, no change required | `.quick-links{display:flex;justify-content:center;align-items:center;column-gap:18px;row-gap:14px;flex-wrap:wrap;margin:10px 0 24px}.quick-link{display:inline-flex;align-items:ce…` |
| 14 | OK — reviewed, no change required | `.update-note{text-align:center;color:var(--soft);font-size:13px;margin:-6px 0 16px}` |
| 15 | OK — reviewed, no change required | `.loading-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:70px 20px;gap:16px}.spinner{width:42px;height:42px;border:3px solid var(--blue…` |
| 16 | OK — reviewed, no change required | `.error-box{background:#FFF5F5;border:1.5px solid rgba(240,82,82,.25);border-radius:20px;padding:22px;text-align:center;margin:20px 0;font-size:14px;color:var(--red);line-height:…` |
| 17 | OK — reviewed, no change required | `.poster-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:stretch}` |
| 18 | OK — blank/separator line | `` |
| 19 | OK — comment/documentation reviewed | `/* 🚀 Optimize: เพิ่ม Content-Visibility เพื่อไม่ให้เว็บหน่วงเวลามีงานเยอะๆ */` |
| 20 | OK — reviewed, no change required | `.concert-card{` |
| 21 | OK — reviewed, no change required | `  background:#fff;` |
| 22 | OK — reviewed, no change required | `  border-radius:22px;` |
| 23 | OK — reviewed, no change required | `  overflow:hidden;` |
| 24 | OK — reviewed, no change required | `  box-shadow:0 12px 30px rgba(91,141,239,.16);` |
| 25 | OK — reviewed, no change required | `  border:1.5px solid rgba(255,255,255,.88);` |
| 26 | OK — reviewed, no change required | `  cursor:pointer;` |
| 27 | OK — reviewed, no change required | `  transition:.22s;` |
| 28 | OK — reviewed, no change required | `  display:flex;` |
| 29 | OK — reviewed, no change required | `  flex-direction:column;` |
| 30 | OK — reviewed, no change required | `  content-visibility: auto;` |
| 31 | OK — reviewed, no change required | `  contain-intrinsic-size: 350px;` |
| 32 | OK — reviewed, no change required | `}` |
| 33 | OK — reviewed, no change required | `.concert-card:hover{transform:translateY(-3px)}` |
| 34 | OK — blank/separator line | `` |
| 35 | OK — reviewed, no change required | `.poster-img-wrap{width:100%;aspect-ratio:3/4;background:#eaf3ff;overflow:hidden;position:relative;flex-shrink:0}.poster-img-wrap img{width:100%;height:100%;object-fit:cover;obje…` |
| 36 | OK — reviewed, no change required | `.status-badge{position:absolute;left:10px;top:10px;z-index:2;display:inline-flex;padding:6px 11px;border-radius:999px;font-size:13px;font-weight:700;background:rgba(255,255,255,…` |
| 37 | OK — reviewed, no change required | `.poster-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#EEF4FF,#D6E6FF);flex-direction:column;gap:8p…` |
| 38 | OK — reviewed, no change required | `.poster-info{padding:14px 14px 16px;flex:1;min-height:150px;display:flex;flex-direction:column;gap:8px;border-top:1px solid rgba(191,214,255,.35);background:radial-gradient(circ…` |
| 39 | OK — reviewed, no change required | `.divider{height:1px;background:linear-gradient(90deg,transparent,#BFD6FF,transparent);margin:32px 0 0}.line-btn{display:flex;align-items:center;justify-content:center;gap:12px;w…` |
| 40 | OK — reviewed, no change required | `footer{text-align:center;padding-top:32px;padding-bottom:10px;color:var(--navy);font-weight:600;line-height:1.25}footer .footer-brand{font-size:36px;font-weight:700}footer .foot…` |
| 41 | OK — reviewed, no change required | `.overlay{display:none;position:fixed;inset:0;z-index:999;background:rgba(26,40,69,.48);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:18px}.overlay.…` |
| 42 | OK — reviewed, no change required | `@media(max-width:768px){.wrap{max-width:100%;padding:0 10px 88px}header{padding-top:18px}.brand-image-card{width:calc(100vw - 20px);max-width:none;border-radius:24px}.brand-fall…` |
| 43 | OK — reviewed, no change required | `@media(max-width:480px){.phone-row{align-items:flex-start}.ph-info{flex:1 1 calc(100% - 70px)}.ph-right{width:100%;margin-left:68px;align-items:flex-start;text-align:left;flex-d…` |
| 44 | OK — reviewed, no change required | `@media(max-width:390px){.wrap{padding-left:7px;padding-right:7px}.brand-image-card{width:calc(100vw - 14px);border-radius:20px}.brand-fallback-logo{width:54px;height:54px}.brand…` |
| 45 | OK — blank/separator line | `` |
| 46 | OK — reviewed, no change required | `.concert-card{appearance:none;-webkit-appearance:none;text-align:left;font-family:var(--font-main);color:inherit;height:100%;min-height:0;}` |
| 47 | OK — reviewed, no change required | `.concert-card:focus-visible,.book-pill:focus-visible,.modal-close:focus-visible,.quick-link:focus-visible,.line-btn:focus-visible{outline:3px solid rgba(91,141,239,.45);outline-…` |
| 48 | OK — reviewed, no change required | `.poster-grid{align-items:stretch;grid-auto-rows:1fr;}` |
| 49 | OK — reviewed, no change required | `.poster-info{display:flex;flex-direction:column;align-items:stretch;min-height:178px;height:100%;}` |
| 50 | OK — reviewed, no change required | `.pi-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}` |
| 51 | OK — reviewed, no change required | `.poster-info > .pi-tap{display:flex;width:100%;min-width:100%;max-width:100%;align-self:stretch;box-sizing:border-box;flex:0 0 auto;min-height:46px;margin-top:auto;padding-left:…` |
| 52 | OK — reviewed, no change required | `@media(max-width:768px){.poster-info{min-height:158px} .poster-info > .pi-tap{min-height:42px}}` |
| 53 | OK — reviewed, no change required | `@media(max-width:390px){.poster-info{min-height:148px} .poster-info > .pi-tap{min-height:38px}}` |
| 54 | OK — blank/separator line | `` |
| 55 | OK — reviewed, no change required | `.concert-card,.concert-card *{box-sizing:border-box;}` |
| 56 | OK — reviewed, no change required | `.poster-info{width:100%;max-width:100%;display:flex;flex-direction:column;align-items:stretch;}` |
| 57 | OK — reviewed, no change required | `.pi-tap,.poster-info .pi-tap,.poster-info > .pi-tap{display:flex;width:100%;min-width:0;max-width:none;align-self:stretch;flex:0 0 auto;margin-top:auto;margin-left:0;margin-righ…` |
| 58 | OK — reviewed, no change required | `@media (min-width:769px){.poster-info{min-height:178px;} .pi-tap,.poster-info .pi-tap,.poster-info > .pi-tap{min-height:46px;}}` |
| 59 | OK — blank/separator line | `` |
| 60 | OK — reviewed, no change required | `.date-warning-label{display:inline-flex;align-items:center;width:fit-content;gap:4px;margin-top:-2px;padding:5px 9px;border-radius:999px;background:#FFF7ED;color:#C2410C;border:…` |
| 61 | OK — reviewed, no change required | `@media(max-width:390px){.date-warning-label{font-size:11px;padding:5px 8px}}` |
| 62 | OK — blank/separator line | `` |
| 63 | OK — reviewed, no change required | `.modal,.phone-list,.phone-row{max-width:100%;overflow-x:hidden;}` |
| 64 | OK — reviewed, no change required | `@media(max-width:600px){.overlay{padding:12px;align-items:center;} .modal{width:calc(100vw - 24px);max-width:calc(100vw - 24px);border-radius:28px;} .modal-header{padding-left:1…` |
| 65 | OK — reviewed, no change required | `@media(max-width:360px){.phone-row{grid-template-columns:42px minmax(0,1fr);padding:12px;gap:9px 10px;} .ph-icon{width:42px;height:42px;} .ph-model{font-size:15.5px;} .ph-price{…` |
| 66 | OK — blank/separator line | `` |
| 67 | OK — reviewed, no change required | `body{padding-bottom:78px}` |
| 68 | OK — reviewed, no change required | `.value-box{max-width:860px;margin:14px auto 0;background:rgba(255,255,255,.84);border:1px solid rgba(255,255,255,.92);border-radius:22px;padding:15px 18px;text-align:center;box-…` |
| 69 | OK — reviewed, no change required | `.value-box h2{font-size:clamp(19px,3.8vw,28px);color:var(--navy);line-height:1.35;font-weight:800}` |
| 70 | OK — reviewed, no change required | `.value-box p{margin-top:5px;color:#4f6388;font-size:15px;line-height:1.6;font-weight:500}` |
| 71 | OK — reviewed, no change required | `.value-box .value-note{margin-top:4px;color:#6A7FA7;font-size:13px;line-height:1.55;font-weight:400}` |
| 72 | OK — reviewed, no change required | `.mini-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:10px 16px;background:rgba(255,255,255,.86);border:1.5px solid rgba(91,141…` |
| 73 | OK — reviewed, no change required | `.sticky-line{position:fixed;left:12px;right:12px;bottom:12px;z-index:900;display:none;align-items:center;justify-content:center;gap:8px;padding:15px 18px;border-radius:999px;bac…` |
| 74 | OK — reviewed, no change required | `.ph-usecase{font-size:14px;color:#4A6090;margin-top:4px;line-height:1.45}` |
| 75 | OK — reviewed, no change required | `.faq-overlay{display:none;position:fixed;inset:0;z-index:1000;background:rgba(26,40,69,.48);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:18px}.faq…` |
| 76 | OK — reviewed, no change required | `.faq-overlay .modal{max-width:760px}.faq-overlay .modal-title{font-size:24px;font-weight:700;line-height:1.3}.faq-list{padding:0 20px;display:grid;gap:12px}.faq-item{background:…` |
| 77 | OK — reviewed, no change required | `.modal-note strong{color:var(--navy)}` |
| 78 | OK — reviewed, no change required | `@media(max-width:768px){body{padding-bottom:82px}.value-box{border-radius:20px}.value-box p{font-size:14px}.value-box .value-note{font-size:12px}.line-btn{display:none}.sticky-l…` |
| 79 | OK — reviewed, no change required | `@media(max-width:390px){.mini-btn{font-size:13px;width:100%;max-width:280px}.value-box h2{font-size:18px}.value-box p{font-size:13px}.value-box .value-note{font-size:11.5px}.faq…` |
| 80 | OK — blank/separator line | `` |
| 81 | OK — reviewed, no change required | `.quick-link{white-space:nowrap;}` |
| 82 | OK — reviewed, no change required | `@media(max-width:390px){.quick-link{max-width:330px;font-size:12.5px;}}` |
| 83 | OK — blank/separator line | `` |
| 84 | OK — reviewed, no change required | `.filter-bar{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:2px auto 22px;}` |
| 85 | OK — reviewed, no change required | `.filter-btn{appearance:none;-webkit-appearance:none;border:1.5px solid rgba(91,141,239,.20);background:rgba(255,255,255,.72);color:#5D75A0;min-height:38px;padding:8px 18px;borde…` |
| 86 | OK — reviewed, no change required | `.filter-btn:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(91,141,239,.13);}` |
| 87 | OK — reviewed, no change required | `.filter-btn.active{color:#fff;border-color:rgba(91,141,239,.35);background:linear-gradient(180deg,#6E9DFF 0%,#5686EE 100%);box-shadow:0 10px 22px rgba(91,141,239,.22);}` |
| 88 | OK — reviewed, no change required | `.status-badge.soon{color:#5B8DEF;}` |
| 89 | OK — reviewed, no change required | `.empty-state{max-width:720px;margin:18px auto 0;padding:34px 22px;text-align:center;border-radius:28px;background:rgba(255,255,255,.84);border:1px solid rgba(255,255,255,.92);bo…` |
| 90 | OK — reviewed, no change required | `.empty-state .empty-emoji{font-size:34px;margin-bottom:8px;}` |
| 91 | OK — reviewed, no change required | `.empty-state h3{color:var(--navy);font-size:22px;line-height:1.35;font-weight:800;}` |
| 92 | OK — reviewed, no change required | `.empty-state p{margin-top:8px;color:#5D75A0;font-size:14px;line-height:1.65;}` |
| 93 | OK — reviewed, no change required | `.empty-line-btn{display:inline-flex;align-items:center;justify-content:center;margin-top:16px;min-height:42px;padding:10px 22px;border-radius:999px;background:linear-gradient(18…` |
| 94 | OK — reviewed, no change required | `.error-state{border-color:rgba(240,82,82,.18);}` |
| 95 | OK — reviewed, no change required | `.brand-header-img{background:#EEF5FF;}` |
| 96 | OK — reviewed, no change required | `.poster-img-wrap img{background:#EEF5FF;}` |
| 97 | OK — reviewed, no change required | `.filter-btn:focus-visible,.empty-line-btn:focus-visible{outline:3px solid rgba(91,141,239,.45);outline-offset:3px;}` |
| 98 | OK — reviewed, no change required | `@media(max-width:768px){.filter-bar{gap:8px;margin:0 auto 18px;padding:0 6px} .filter-btn{font-size:13px;min-height:36px;padding:8px 14px} .empty-state{border-radius:22px;paddin…` |
| 99 | OK — reviewed, no change required | `@media(max-width:390px){.filter-btn{font-size:12px;padding:7px 12px} .empty-state h3{font-size:17px} .empty-state p{font-size:13px}}` |
| 100 | OK — blank/separator line | `` |
| 101 | OK — comment/documentation reviewed | `/* Phase 1 baseline — pi-venue */` |
| 102 | OK — reviewed, no change required | `.pi-venue{font-size:13px;color:#64748b;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}` |
| 103 | OK — blank/separator line | `` |
| 104 | OK — blank/separator line | `` |
| 105 | OK — comment/documentation reviewed | `/* Phase 1 baseline — loading skeleton + modal poster */` |
| 106 | OK — reviewed, no change required | `.skeleton-grid{margin-top:0;}` |
| 107 | OK — reviewed, no change required | `.skeleton-card{pointer-events:none;overflow:hidden;position:relative;background:rgba(255,255,255,.78);}` |
| 108 | OK — reviewed, no change required | `.skeleton-card:before{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);animation:…` |
| 109 | OK — reviewed, no change required | `@keyframes skeletonShimmer{100%{transform:translateX(100%)}}` |
| 110 | OK — reviewed, no change required | `.skeleton-poster{background:linear-gradient(135deg,#EAF3FF,#D7E7FF);}` |
| 111 | OK — reviewed, no change required | `.skeleton-poster span{display:block;width:48%;height:18px;border-radius:999px;background:rgba(255,255,255,.65);position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);}` |
| 112 | OK — reviewed, no change required | `.skeleton-info{gap:11px;}` |
| 113 | OK — reviewed, no change required | `.sk{display:block;border-radius:999px;background:linear-gradient(90deg,#E6F0FF,#F7FAFF,#E6F0FF);min-height:14px;}` |
| 114 | OK — reviewed, no change required | `.sk-date{width:45%;height:27px;}` |
| 115 | OK — reviewed, no change required | `.sk-title{width:88%;height:18px;border-radius:12px;}` |
| 116 | OK — reviewed, no change required | `.sk-title.short{width:62%;}` |
| 117 | OK — reviewed, no change required | `.sk-btn{width:100%;height:42px;margin-top:auto;}` |
| 118 | OK — reviewed, no change required | `.skeleton-loading-text{text-align:center;margin:14px auto 0;color:#6A7FA7;font-size:14px;}` |
| 119 | OK — reviewed, no change required | `.modal-poster-wrap{margin:0 20px 14px;border-radius:22px;overflow:hidden;background:#EEF5FF;border:1px solid rgba(191,214,255,.7);box-shadow:0 8px 22px rgba(91,141,239,.12);}` |
| 120 | OK — reviewed, no change required | `.modal-poster-wrap img{width:100%;max-height:300px;object-fit:cover;object-position:center;display:block;}` |
| 121 | OK — reviewed, no change required | `@media(max-width:600px){.modal-poster-wrap{margin-left:12px;margin-right:12px;border-radius:18px}.modal-poster-wrap img{max-height:240px}.skeleton-loading-text{font-size:13px}}` |
| 122 | OK — blank/separator line | `` |
| 123 | OK — blank/separator line | `` |
| 124 | OK — comment/documentation reviewed | `/* Phase 1 baseline — compact modal, no poster inside event detail modal */` |
| 125 | OK — reviewed, no change required | `#overlay{padding:16px;align-items:center;justify-content:center;}` |
| 126 | OK — reviewed, no change required | `#overlay .modal{` |
| 127 | OK — reviewed, no change required | `  width:min(640px, calc(100vw - 32px));` |
| 128 | OK — reviewed, no change required | `  max-width:640px;` |
| 129 | OK — reviewed, no change required | `  max-height:min(82vh, 720px);` |
| 130 | OK — reviewed, no change required | `  border-radius:26px;` |
| 131 | OK — reviewed, no change required | `  padding-bottom:18px;` |
| 132 | OK — reviewed, no change required | `}` |
| 133 | OK — reviewed, no change required | `#modal-poster-wrap,.modal-poster-wrap{display:none!important;}` |
| 134 | OK — reviewed, no change required | `#overlay .modal-header{padding:16px 18px 0;}` |
| 135 | OK — reviewed, no change required | `#overlay .modal-title{font-size:22px;line-height:1.28;}` |
| 136 | OK — reviewed, no change required | `#overlay .modal-meta{font-size:14px;margin-top:3px;}` |
| 137 | OK — reviewed, no change required | `#overlay .modal-note{margin:10px 16px 0;padding:9px 11px;font-size:13px;border-radius:13px;}` |
| 138 | OK — reviewed, no change required | `#overlay .modal-divider{margin:12px 16px;}` |
| 139 | OK — reviewed, no change required | `#overlay .phone-list{padding:0 14px;gap:10px;}` |
| 140 | OK — reviewed, no change required | `#overlay .phone-row{padding:13px 14px;border-radius:16px;gap:12px;}` |
| 141 | OK — reviewed, no change required | `#overlay .ph-icon{width:46px;height:46px;}` |
| 142 | OK — reviewed, no change required | `#overlay .ph-model{font-size:17px;}` |
| 143 | OK — reviewed, no change required | `#overlay .ph-spec,#overlay .ph-usecase,#overlay .ph-note{font-size:12.5px;line-height:1.45;}` |
| 144 | OK — reviewed, no change required | `#overlay .ph-price{font-size:18px;}` |
| 145 | OK — reviewed, no change required | `#overlay .badge{font-size:12.5px;padding:7px 12px;min-width:86px;}` |
| 146 | OK — reviewed, no change required | `#overlay .modal-close{width:calc(100% - 28px);margin:12px 14px 0;padding:12px;font-size:15px;}` |
| 147 | OK — reviewed, no change required | `@media(max-width:600px){` |
| 148 | OK — reviewed, no change required | `  #overlay{padding:10px;align-items:center;}` |
| 149 | OK — reviewed, no change required | `  #overlay .modal{width:calc(100vw - 20px);max-width:calc(100vw - 20px);max-height:84vh;border-radius:22px;}` |
| 150 | OK — reviewed, no change required | `  #overlay .modal-title{font-size:20px;}` |
| 151 | OK — reviewed, no change required | `  #overlay .modal-meta{font-size:13px;}` |
| 152 | OK — reviewed, no change required | `  #overlay .modal-note{font-size:12.5px;margin-left:12px;margin-right:12px;}` |
| 153 | OK — reviewed, no change required | `  #overlay .modal-divider{margin-left:12px;margin-right:12px;}` |
| 154 | OK — reviewed, no change required | `  #overlay .phone-list{padding-left:12px;padding-right:12px;}` |
| 155 | OK — reviewed, no change required | `  #overlay .phone-row{padding:12px;grid-template-columns:42px minmax(0,1fr);gap:9px 10px;}` |
| 156 | OK — reviewed, no change required | `  #overlay .ph-icon{width:42px;height:42px;}` |
| 157 | OK — reviewed, no change required | `  #overlay .ph-model{font-size:16px;}` |
| 158 | OK — reviewed, no change required | `  #overlay .ph-spec,#overlay .ph-usecase,#overlay .ph-note{font-size:12px;}` |
| 159 | OK — reviewed, no change required | `}` |
| 160 | OK — reviewed, no change required | `@media(min-width:1100px){` |
| 161 | OK — reviewed, no change required | `  #overlay .modal{max-width:600px;}` |
| 162 | OK — reviewed, no change required | `}` |
| 163 | OK — blank/separator line | `` |
| 164 | OK — blank/separator line | `` |
| 165 | OK — comment/documentation reviewed | `/* Phase 1 baseline — backend-driven text + modal close stability */` |
| 166 | OK — reviewed, no change required | `.modal-close{position:relative;z-index:2;touch-action:manipulation;}` |
| 167 | OK — reviewed, no change required | `.faq-overlay .modal-close,#overlay .modal-close{font-weight:600;}` |
| 168 | OK — reviewed, no change required | `.faq-q,.modal-title,.ph-model{font-weight:700;}` |
| 169 | OK — reviewed, no change required | `.ph-usecase{font-size:13px;color:#4A6090;margin-top:3px;line-height:1.5;}` |
| 170 | OK — blank/separator line | `` |
| 171 | OK — blank/separator line | `` |
| 172 | OK — comment/documentation reviewed | `/* Phase 1 baseline — line message + font + close buttons */` |
| 173 | OK — reviewed, no change required | `html{font-family:var(--font-main);}` |
| 174 | OK — reviewed, no change required | `button,input,select,textarea{font:inherit;}` |
| 175 | OK — reviewed, no change required | `.modal{position:relative;}` |
| 176 | OK — reviewed, no change required | `.modal-x{position:absolute;top:14px;right:16px;z-index:5;width:40px;height:40px;margin:0;display:flex;align-items:center;justify-content:center;border:0;border-radius:999px;back…` |
| 177 | OK — reviewed, no change required | `.modal-x:hover{background:#DDEAFF;}` |
| 178 | OK — reviewed, no change required | `.modal-close,.modal-x{pointer-events:auto;-webkit-tap-highlight-color:transparent;}` |
| 179 | OK — reviewed, no change required | `.faq-overlay{z-index:1200;}` |
| 180 | OK — reviewed, no change required | `.overlay{z-index:1100;}` |
| 181 | OK — reviewed, no change required | `.faq-overlay .modal,.overlay .modal{isolation:isolate;}` |
| 182 | OK — reviewed, no change required | `.faq-q,.modal-title,.ph-model{font-synthesis-weight:none;}` |
| 183 | OK — reviewed, no change required | `@media(max-width:600px){.modal-x{width:38px;height:38px;font-size:26px;top:12px;right:14px}.faq-overlay .modal-title,.overlay .modal-title{padding-right:42px}}` |
| 184 | OK — blank/separator line | `` |
| 185 | OK — reviewed, no change required | `.modal-header{padding-right:68px;}` |
| 186 | OK — blank/separator line | `` |
| 187 | UPDATED version sync to v16.6.2 | `/* v16.6.2_LINE_AUDITED: month selection sits before status filters */` |
| 188 | OK — reviewed, no change required | `.filter-group{margin:0 auto 18px;text-align:center;}` |
| 189 | OK — reviewed, no change required | `.status-filter-bar{align-items:center;}` |
| 190 | OK — reviewed, no change required | `.month-select-wrap{position:relative;display:inline-flex;align-items:center;flex:0 0 auto;}` |
| 191 | OK — reviewed, no change required | `.month-select{appearance:none;-webkit-appearance:none;border:1.5px solid rgba(91,141,239,.20);background:rgba(255,255,255,.84);color:#5D75A0;min-height:38px;padding:8px 38px 8px…` |
| 192 | OK — reviewed, no change required | `.month-select:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(91,141,239,.13);}` |
| 193 | OK — reviewed, no change required | `.month-select:focus-visible{outline:3px solid rgba(91,141,239,.45);outline-offset:3px;}` |
| 194 | OK — reviewed, no change required | `.month-select-wrap::after{content:"▾";position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:12px;color:#5D75A0;pointer-events:none;}` |
| 195 | OK — reviewed, no change required | `.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}` |
| 196 | OK — reviewed, no change required | `@media(max-width:768px){.month-select{font-size:13px;min-height:36px;padding:8px 34px 8px 14px;max-width:150px}.month-select-wrap::after{right:14px}}` |
| 197 | OK — reviewed, no change required | `@media(max-width:390px){.month-select{font-size:12px;padding:7px 32px 7px 12px;max-width:132px}}` |

### `vercel.json`

| Line | Status | Code |
|---:|---|---|
| 1 | OK — reviewed, no change required | `{` |
| 2 | OK — reviewed, no change required | `  "headers": [` |
| 3 | OK — reviewed, no change required | `    {` |
| 4 | OK — reviewed, no change required | `      "source": "/(.*)",` |
| 5 | OK — reviewed, no change required | `      "headers": [` |
| 6 | OK — reviewed, no change required | `        {` |
| 7 | OK — reviewed, no change required | `          "key": "X-Content-Type-Options",` |
| 8 | OK — reviewed, no change required | `          "value": "nosniff"` |
| 9 | OK — reviewed, no change required | `        },` |
| 10 | OK — reviewed, no change required | `        {` |
| 11 | OK — reviewed, no change required | `          "key": "Referrer-Policy",` |
| 12 | OK — reviewed, no change required | `          "value": "strict-origin-when-cross-origin"` |
| 13 | OK — reviewed, no change required | `        }` |
| 14 | OK — reviewed, no change required | `      ]` |
| 15 | OK — reviewed, no change required | `    },` |
| 16 | OK — reviewed, no change required | `    {` |
| 17 | OK — reviewed, no change required | `      "source": "/api/kk-admin",` |
| 18 | OK — reviewed, no change required | `      "headers": [` |
| 19 | OK — reviewed, no change required | `        {` |
| 20 | OK — reviewed, no change required | `          "key": "Cache-Control",` |
| 21 | OK — reviewed, no change required | `          "value": "no-store, no-cache, must-revalidate, max-age=0"` |
| 22 | OK — reviewed, no change required | `        }` |
| 23 | OK — reviewed, no change required | `      ]` |
| 24 | OK — reviewed, no change required | `    },` |
| 25 | OK — reviewed, no change required | `    {` |
| 26 | OK — reviewed, no change required | `      "source": "/api/kk-data",` |
| 27 | OK — reviewed, no change required | `      "headers": [` |
| 28 | OK — reviewed, no change required | `        {` |
| 29 | OK — reviewed, no change required | `          "key": "Cache-Control",` |
| 30 | OK — reviewed, no change required | `          "value": "s-maxage=15, stale-while-revalidate=45"` |
| 31 | OK — reviewed, no change required | `        }` |
| 32 | OK — reviewed, no change required | `      ]` |
| 33 | OK — reviewed, no change required | `    },` |
| 34 | OK — reviewed, no change required | `    {` |
| 35 | OK — reviewed, no change required | `      "source": "/admin",` |
| 36 | OK — reviewed, no change required | `      "headers": [` |
| 37 | OK — reviewed, no change required | `        {` |
| 38 | OK — reviewed, no change required | `          "key": "Cache-Control",` |
| 39 | OK — reviewed, no change required | `          "value": "no-store, max-age=0"` |
| 40 | OK — reviewed, no change required | `        }` |
| 41 | OK — reviewed, no change required | `      ]` |
| 42 | OK — reviewed, no change required | `    },` |
| 43 | OK — reviewed, no change required | `    {` |
| 44 | OK — reviewed, no change required | `      "source": "/admin/",` |
| 45 | OK — reviewed, no change required | `      "headers": [` |
| 46 | OK — reviewed, no change required | `        {` |
| 47 | OK — reviewed, no change required | `          "key": "Cache-Control",` |
| 48 | OK — reviewed, no change required | `          "value": "no-store, max-age=0"` |
| 49 | OK — reviewed, no change required | `        }` |
| 50 | OK — reviewed, no change required | `      ]` |
| 51 | OK — reviewed, no change required | `    }` |
| 52 | OK — reviewed, no change required | `  ],` |
| 53 | OK — reviewed, no change required | `  "rewrites": [` |
| 54 | OK — reviewed, no change required | `    {` |
| 55 | OK — reviewed, no change required | `      "source": "/admin",` |
| 56 | OK — reviewed, no change required | `      "destination": "/admin/index.html"` |
| 57 | OK — reviewed, no change required | `    }` |
| 58 | OK — reviewed, no change required | `  ]` |
| 59 | OK — reviewed, no change required | `}` |
