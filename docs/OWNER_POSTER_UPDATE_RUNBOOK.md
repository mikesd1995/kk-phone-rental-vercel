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

## Incident record — 2026-10-05 — FRUNG FRING storefront card missing
Event: `EVT-20261010-BITOEY-FRUNG-FRING-FAN-CON`

Observed:
- Event was `open` and `active_on_web=TRUE`, but `poster_image_url` was blank.
- `08_Web_Ready` reported `show` with 2 phones / 2 lenses, so visibility and inventory were not the root cause.
- Storefront rendering requires a usable poster; a blank poster can therefore make an otherwise-showable event disappear.

Repair performed:
- Verified exact event details against the artist post: 10 Oct 2026, SIAMPIC HALL.
- Selected the newer exact-event artist image from the 24 Sep guest-lineup post:
  `https://www.siamzone.com/ig/media/18567489/3993001555961515916.jpg`
- Updated only `01_Events!E150` (`poster_image_url`).
- Preserved event status, visibility, notes, bookings, inventory and package prices.
- Readback: `01_Events` = open / TRUE / data_health OK.
- Derived readback: `08_Web_Ready` = poster populated / 2 phones / 2 lenses / `action_for_web=show`.
- Package readback unchanged: phone 690 available; lens-only 390 hidden; bundle 890 available.
- Production `/api/kk-data?sheet=08_Web_Ready&range=A4:K` returned the same poster URL and `show`.

Fallback note:
- The preferred immutable Drive-new-file method could not be completed in this run because the discovered public image URL was available as a web asset but not as a connector file reference suitable for Drive upload.
- The direct exact-event image URL was therefore used as the no-cost fallback after production API readback.
- If a user-supplied image/file reference becomes available later, migrate this poster to a new Drive file ID using the canonical procedure above.
