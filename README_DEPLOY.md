# Frontend Deploy — v16.2_FULL_AUDIT_STABLE

Deploy this `frontend` folder to Vercel.

## Required Vercel ENV

```text
GOOGLE_SHEET_ID=12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU
KK_ADMIN_SCRIPT_URL=<Apps Script /exec URL>
KK_ADMIN_API_KEY=<Apps Script API key>
KK_ADMIN_PIN=<Admin PIN>
```

## Data loading behavior

The public site uses `/api/kk-data` first. If the proxy fails or returns invalid CSV headers, the browser falls back to the read-only Google Sheets URL from `config.js`.

This protects the public homepage from going blank when the proxy is misconfigured or returns invalid content.
