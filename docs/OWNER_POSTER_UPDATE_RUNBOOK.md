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
   - Resolve the existing **KK Phone Rental Posters** Drive folder first. Verified 2026-10-09 folder ID: `1m6sOf1vl6l_tHscb-tNkTUjlEy82ELHl`. The older `1haTk15ElLwZM8NFcLvK36tbyLZo5wnzw` reference may be a different legacy folder; do not blindly upload to it.
   - Use a descriptive immutable filename and a **new file ID**, never overwrite an existing ID.
   - Prefer the owner-supplied original (not an X screenshot). Confirm the final file is accessible through the storefront image URL.
3. Capture the new Drive file ID.
4. Build canonical poster URL:
   `https://drive.google.com/thumbnail?id=<NEW_FILE_ID>&sz=w1200`
5. Locate every event row that should use the new poster in `01_Events`.
6. Update only `poster_image_url` for those exact rows. Preserve event status, visibility, prices, bookings, and notes unless the owner requested otherwise.
7. Read back the exact `01_Events` rows.
8. Verify the derived rows in `08_Web_Ready` now contain the **same new file ID**.
9. Verify the new Drive file is present in the poster folder and is shared/downloadable.
10. Read the production public feed `/api/kk-data?sheet=08_Web_Ready&range=A4:K` for each exact event ID; require the same new poster ID and preserve its visibility state.
11. Validate the **rendered production card** at relevant mobile/desktop viewport sizes: correct poster, image loaded, no screenshot of social chrome, no unintended cropping (`object-fit: contain`).
12. If the storefront still shows the old poster, inspect `script.js -> getImgCandidates()` and confirm the storefront is requesting the new Drive file ID. Do not retry by overwriting the old Drive file.
13. Record old/new Drive IDs, exact event/date, Core/Web/production/visual results and any remaining blockers as a durable incident trace.

## Acceptance criteria
- `01_Events.poster_image_url` uses the new Drive file ID.
- `08_Web_Ready.poster_image_url` uses the same new Drive file ID.
- No unrelated event fields changed.
- No booking/package pricing changed.
- Storefront public API returns the new Drive file ID for the exact event, with unchanged name/date/venue/prices/stock/visibility.
- Rendered card shows the correct official artwork fully and does not show an X-page screenshot.
- When browser QA is unavailable, report `BACKEND_DONE_BUT_VISUAL_UNVERIFIED`; when production API is unavailable, report `BACKEND_DONE_PRODUCTION_UNVERIFIED`. Neither is production-visual acceptance.

## Current known implementation detail
`script.js -> getImgCandidates()` reconstructs Drive URLs from the file ID:
- `https://drive.google.com/thumbnail?id=<ID>&sz=<size>`
- `https://lh3.googleusercontent.com/d/<ID>=<size>`
- `https://drive.google.com/uc?export=view&id=<ID>`

Because of this, changing only a query parameter on the canonical URL is **not** a valid cache-busting strategy.

## Owner instruction handling — one-command contract

**Owner authorization is the original request. Do not ask for it again or request another “continue” when event identity, poster image and connected authorized write capabilities are already present.** If a connector fails, inspect the error and try another approved no-cost path before reporting a precise blocker. Do not claim “cannot edit production” until checking connected Drive, Sheets and governed writer capabilities.

When the owner says “เปลี่ยนรูป/โปสเตอร์”:
- retrieve the exact official image(s) already attached and map one image to each event/date by verified title/artwork; ambiguous mappings require clarification, not guessing;
- call the `owner_poster_update` Agent Gateway route for deterministic read-only plan and learning evidence when available; if Gateway cannot bootstrap, continue the owner-authorized safe connector path and record the degraded invocation;
- execute the update immediately if connector access and owner authority are available; no repeated requests;
- use a new Drive file ID;
- update all explicitly requested dates/events;
- verify `08_Web_Ready`;
- verify Core/Web Ready/production API/visual card separately and report the actual acceptance level;
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

## Incident record — 2026-10-09 — repeated owner instructions (Issue #677)

Owner supplied artwork for `SHADES` (17 Oct), `Love On Hire` (14 Oct) and `Antidotes x Phuwin` (29 Oct). The assistant repeatedly replied that production could not be changed and requested another action even though connected Drive/Sheets tools were available. Root cause is **tool/route discovery skipped + owner-poster runbook not routed**, not missing user authorization.

Verified actual repair: uploaded three originals as three immutable new files into the active Posters folder; updated only `01_Events.poster_image_url` for exact event IDs; `08_Web_Ready` readback matched all three new Drive IDs. **Rendered production Visual QA not proven.** Incident fingerprint: `OWNER_POSTER_UPDATE_REPEATED_HANDOFF`.

Prevent recurrence: retrieve this runbook on first request; use `owner_poster_update` planner and Reliability Learning classification; don't substitute advisory agent output for authorized connector mutation; require separate source/feed/visual readback and test the one-command path.
