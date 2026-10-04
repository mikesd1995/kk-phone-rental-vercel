# KK Phone Rental — Owner Poster Update Runbook

## Purpose
Use this procedure whenever the owner asks to replace an event poster on the storefront.

## Root cause to avoid
The storefront function `getImgCandidates()` extracts the Google Drive file ID and rebuilds the image URLs itself. Query-string cache busters are discarded. Replacing bytes in-place on an existing Drive file can therefore leave Google Drive/CDN serving the old poster for the same file ID.

## Mandatory rule
**Never replace poster bytes on the same Google Drive file ID for a storefront poster update.**
Always upload the new poster as a **new Drive file** so it receives a new file ID.

## Canonical update procedure
1. Read the user-supplied image from the current conversation.
2. Upload it as a **new file** into the existing event-poster Drive folder:
   - folder ID: `1haTk15ElLwZM8NFcLvK36tbyLZo5wnzw`
   - use a descriptive immutable filename.
3. Capture the new Drive file ID.
4. Build canonical poster URL:
   `https://drive.google.com/thumbnail?id=<NEW_FILE_ID>&sz=w1200`
5. Locate every event row that should use the new poster in `01_Events`.
6. Update only `poster_image_url` for those exact rows. Preserve event status, visibility, prices, bookings, and notes unless the owner requested otherwise.
7. Read back the exact `01_Events` rows.
8. Verify the derived rows in `08_Web_Ready` now contain the **same new file ID**.
9. Verify the new Drive file is present in the poster folder and is shared/downloadable.
10. If the storefront still shows the old poster, inspect `script.js -> getImgCandidates()` and confirm the storefront is requesting the new Drive file ID. Do not retry by overwriting the old Drive file.

## Acceptance criteria
- `01_Events.poster_image_url` uses the new Drive file ID.
- `08_Web_Ready.poster_image_url` uses the same new Drive file ID.
- No unrelated event fields changed.
- No booking/package pricing changed.
- Storefront request path can no longer resolve to the old Drive file ID.

## Current known implementation detail
`script.js -> getImgCandidates()` reconstructs Drive URLs from the file ID:
- `https://drive.google.com/thumbnail?id=<ID>&sz=<size>`
- `https://lh3.googleusercontent.com/d/<ID>=<size>`
- `https://drive.google.com/uc?export=view&id=<ID>`

Because of this, changing only a query parameter on the canonical URL is **not** a valid cache-busting strategy.

## Owner instruction handling
When the owner says “เปลี่ยนรูป/โปสเตอร์”:
- execute the update immediately if connector access is available;
- use a new Drive file ID;
- update all explicitly requested dates/events;
- verify `08_Web_Ready`;
- report the new file ID and affected event dates;
- do not claim completion before readback verification.
