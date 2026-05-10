# KK Frontend v9 — Backend v9 Compatible

This package is a static frontend for **KK Phone Rental** that reads only one backend sheet:

- `08_Web_Ready`

## How to use with Backend v9

1. Upload `KK_Phone_Rental_Optimized_Backend_v9.xlsx` to Google Sheets.
2. Share the Google Sheet as **Anyone with the link / Viewer**.
3. Copy the Google Sheet ID from the URL.
4. Open `index.html`.
5. Replace this value:

```js
SHEET_ID: "12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU"
```

with your actual v9 Google Sheet ID.

6. Deploy to Vercel:
   - Put `index.html` and `vercel.json` in your repo root.
   - Push to GitHub, then redeploy in Vercel.
   - Or drag/drop the folder to Vercel if using manual deploy.

## Important backend fields

The frontend expects these columns in `08_Web_Ready`:

- `event_id`
- `event_name`
- `event_date`
- `event_date_text`
- `venue`
- `poster_image_url`
- `phone_model_display`
- `phone_price`
- `lens_price`
- `bundle_price`
- `available_phone_count`
- `available_lens_count`
- `booking_status_for_web`
- `action_for_web`
- `line_message_template`
- `web_note`

## v9 behavior

- `show` = show normal booking buttons.
- `show_phone_only` = lens is full, phone-only booking is still available.
- `show_full` = full, but user can ask for waitlist.
- `hide` = not displayed.

## LINE OA

Current LINE OA URL in this package:

```js
https://line.me/R/ti/p/%40827blnmo
https://line.me/R/oaMessage/%40827blnmo/?
```

Change these in `CONFIG` if the LINE OA changes.
