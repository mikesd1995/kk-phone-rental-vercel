# Storefront temporary artwork when official poster is missing — 2026-10-12

**Owner policy:** A missing official poster does NOT prevent an otherwise verified, sellable event from appearing. Prefer a public authentic same-event image; if unavailable, use a clearly marked temporary first-party KK event-summary visual (name/date/venue). Replace with official image later. NEVER imply an unrelated photograph is the event's official poster, use AI-made official posters, or write fabricated artist/date details.

**Pull Request:** https://github.com/mikesd1995/kk-phone-rental-vercel/pull/704 (draft, not merged).

## Recovered storefront source logic
- Before: `renderConcerts` ran `vis=vis.filter(c=>!!c.img)`; this discarded otherwise-showable cards with blank `poster_image_url`.
- After: the client displays every event already allowed by `action_for_web` and existing date/booking/availability filtering, even if poster blank. It uses an **exact-event name/date/venue visual** labeled `ภาพประกอบชั่วคราว` / `TEMPORARY EVENT ART`.
- The same summary component handles exhausted/broken images, avoiding unrelated image substitutions and empty cards. Audit attributes `data-poster-missing=1`, `data-poster-fallback=event-summary`, `data-poster-status=temporary` distinguish from verified artwork.
- Rotated `index.html` script cache key to `storefront-temporary-event-art-20261012` to avoid stale JS on existing customers' phones.
- No `01_Events`, `08_Web_Ready`, inventory, package prices, booking data or owner-hidden locks changed by this patch.

## Live source-of-truth read-only check
Source spreadsheet `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`: `01_Events!A4:I650` + `08_Web_Ready!A4:K650` returned ~343 event rows and ~344 derived rows. No `show/show_full` derived rows with empty poster in those ranges at check time; no immediately visible customer card currently depends on this fallback.
Exactly **two** `01_Events` rows have `active_on_web=TRUE` and blank poster, but neither may be auto-shown:
1. `EVT-20261017-THE-PASEO-POP-THE-STAGE`, 17 October: `data_health=SOURCE_DATE_UNVERIFIED`, derived `action_for_web=hide`, available phones/lenses 0/0.
2. `EVT-20261030-VVV-SHOW-GO-WHOLESALE-RAMA2`, 30 October: `data_health=SOURCE_DATE_UNVERIFIED`, conflicting 2 vs 30 October event evidence, derived `action_for_web=hide`, available phones/lenses 0/0.

**DO NOT create/overwrite poster URLs or activate these two events to bypass an unverified event date or owner/inventory gates.** Verified replacement event artwork may be added later through an exact source+readback procedure only after dates/permissions are authenticated.

Other events already use explicit `TEMP_IMAGE_2026-10-12` provenance in `01_Events.event_note`, including Manekineko Idol Party and AF Halloween Party using KK's existing brand hero image, LE7EL using a clearly annotated artist photo, POP-ป่ะห์ using a prior news/atmosphere image. Preserve all such `TEMP_IMAGE` notes and replace with official poster when available.

## Validation, outstanding acceptance
- On draft branch: source/static checks verify canonical poster first, owner `hide` filter retained, blank-poster exclusion removed, deterministic temporary graphic, and added 4 source regression assertions in `tests/storefront-image-fallback.test.js`. Script and test passed JavaScript syntax compilation, **not full Node test execution**.
- GitHub Visual QA run `38239623912` reported **failure** but had `steps=[]`; workflow job `114778734731` offers no actionable test steps, so cause is not attributed to source code. No matching Vercel preview deployment was found.
- **No Production merge/deploy**; not yet demonstrated on browser or live API. Prior before/after code state can be rolled back by closing draft PR or reverting `script.js` and `index.html` change.
- Required before Production: exact-head Node tests, visual QA (mobile 320/375/390/430/480 and desktop 768/1024), distinct rendered screenshot for an allowed event missing poster, correct TH/EN, actions and inventory unchanged, owner approval, release readback.

Persistent coordination: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/696
