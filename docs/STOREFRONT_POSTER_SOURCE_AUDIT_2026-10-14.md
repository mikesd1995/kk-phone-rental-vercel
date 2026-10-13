# KK Phone Rental — storefront poster/source audit (14 Oct 2026, Asia/Bangkok)

## Source of truth / scope
- Owner-requested audit of posters for **every future-visible event**; read current linked Google Sheets backend `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`, `01_Events!A5:I380` and derived `08_Web_Ready!A5:J380` without writing either range.
- Audit effective candidates: **57 future rows** at or after 14 October 2026 in WebReady with `action_for_web != hide` in the read-back. Core has **59 future `active_on_web=TRUE` rows**; Core is **not** the exact rendered eligibility set. WebReady contains 6 explicitly owner-noted temporary/non-event art sources (table below).
- This is a **sheet data consistency/source identity audit**, **NOT** browser/network validation of all 57 poster URLs; HTTP accessibility, exact artwork identity and mobile screenshot checks remain open. No claim that 57/57 load or are matched to official sources.

## Six future visible artwork mismatches or nonofficial placeholders

| Event | Core row / derived WebReady row | Current data source | Action in this draft patch | Official poster |
| --- | --- | --- | --- | --- |
| 15 Oct LE7EL — 1st Debut Anniversary | 331 / 332 | Thai2Music LE7EL **artist profile photo**, not 15 Oct 2026 poster | Existing exact-source TH/EN **temporary artist profile** badge and alt preserved | **Pending** |
| 25 Oct VVV — Tornado Shopping × Xiaomi | 335 / 336 | X image from a **general VVV promotional post**, not 25 Oct Xiaomi poster | Exact event-ID and URL gate **rejects this image in public card** and shows owned exact-event date/venue/name fallback | **Pending** |
| 30 Oct AF Halloween Party — AFTERLIFE | 336 / 337 | Identical KK shop-brand hero image | Source-specific **event name/date/venue** fallback instead of brand image presented as event poster | **Pending** |
| 30 Oct POP-ป่ะห์ #4 Halloween — NAMP Live | 337 / 338 | Amarintv **different/earlier POP-ป่ะห์ activity news photo**, not 30 Oct event poster | Exact event-ID and URL gate **rejects this image**; date/venue/name fallback | **Pending** |
| 5 Nov MizuMi × PHUWIN — FIND YOUR MOISTURE MATCH | 345 / 346 | Identical KK shop-brand hero image | Event-specific fallback | **Pending** |
| 2 Nov SUPER SUN × ZEE PRUK BIRTHDAY FANSIGN | 347 / 348 | Identical KK shop-brand hero image | Event-specific fallback | **Pending** |

Related, but not future-visible under the derived current public feed:
- **Brice × Pond Naravit (6 Nov)**: `01_Events!E346` still shop-brand hero; derived `08_Web_Ready` hides row 347. Preserve owner state. If reopened with the same placeholder, generic KK-brand artwork guard degrades to event-specific art automatically.
- **VVV Show × GO Wholesale Rama 2 (30 Oct)**: `01_Events!E338` is **blank**; `data_health=SOURCE_DATE_UNVERIFIED`, event-date conflict noted. Derived `08_Web_Ready` hides this card (row 339); **do not publish or invent poster/event date**.
- Same image URL across two dates of the same named event, e.g. WILLIAM EST, NAMTAN FILM, DEW TEE, Moonshadow and FORTREASURE, is **not proof of mismatch**, so it was preserved. The shared KK-brand hero used across unrelated events **is** a temporary-image witness.

## What actually changed in source
- Branch: `fix/storefront-premium-poster-release-candidate-20261014` / integrated Draft PR #727. This extends the existing **unreleased** fit/hero/LE7EL candidate; **no web deploy**.
- `script.js`: `isAuditedNonEventPoster(eventId,url)` checks **exact event ID + exact old URL** for VVV/Xiaomi and POP/NAMP; generic already-recognized KK brand hero also falls back to exact event summary. New data attributes `data-poster-source-rejected` and `data-poster-replacement-pending` are forensic signals, not badges claiming official images. Replacing a source URL with a genuinely verified organizer poster returns to ordinary image rendering. A bad image or empty source continues using the earlier fallback; cards, booking IDs, price, stock and owner hides remain unchanged.
- `tests/storefront-poster-dom-runtime.test.js`: exact-source and wrong-event-isolation regression added; existing LE7EL provenance test retained. 
- **Independent local V8 extraction/mock DOM functional check: 7/7 selected cases passed** on exact modified `script.js`: KK placeholder, VVV, POP, official external art, reused wrong-URL on a different event, blank image, existing LE7EL profile. This is **not** full Node suite, true browser, network, CI or a customer screenshot.

## Acceptance / remaining corrections
1. Find each missing **exact 2026 event** official organizer artwork with stable canonical URL; visually verify **real bytes** and event name/date/artist; do not use a 2025 event, sponsor logo, fan edit or another concert poster. For LE7EL replace Thai2Music artist image only after verified first-party poster exists.
2. Update **only** `01_Events!E[row]` of that event through owner-permitted poster-only workflow; perform exact Core and derived `08_Web_Ready!E[derived-row]` readback. Do not hand-edit derived formulas, booking, price, owner visibility or inventory.
3. Verify signed-out public image load (`naturalWidth>0`), no crop (`object-fit:contain`), proper 320–1440px responsive layouts, TH/EN × light/dark, booking event identity, and absence of broken fallbacks.
4. Run exact-head GitHub registered CI + independent visual owner acceptance + safe Vercel release/rollback; **keep Draft PR #727 HOLD**, no paid minutes, no TinyFish or quota bypass. Legacy #722 should **not** be merged separately.
5. Do not claim this source-only fallback is a completed official poster replacement. The business source cells, Drive permissions and production URL were **not changed**.

## Explicit outcome
- **5 publicly visible cases** now have a staged truthful presentation improvement (3 shop-brand duplicates + 2 non-event source images) in PR #727.
- **1 visible case** (LE7EL) remains marked temporary with accurate artist-profile alt.
- **0 of the 6** official poster source URLs have been replaced, because first-party original image validation could not be completed.
- **0 production deployments**, **0 core/derived Sheet cell updates**, **0 booking/price/inventory/visibility mutations**.

## Exact-head external validation addendum (14 Oct 2026)
- Vercel connector readback: newest Production READY `dpl_7TYLb87ir9qNzXRtkeb49543dwVm`, aliases include `kk-phone-rental.vercel.app`, SHA `d6dc3bfe4cc0c4dd6fdfec407823752da0572464`; **NOT** this patched Draft branch.
- GitHub Action for patched documentation head `e742f531a08c9a0e893e38216e43eddd3844576e`: [Storefront Automated Visual QA run 38455870985](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38455870985) **completed failure**; job `visual-qa` had no returned steps, and the workflow job log download returned 404 BlobNotFound. Underlying cause could not be confirmed; do **not** report green or assume the workflow exercised tests.
- This documentation addendum commit is another branch-only change; all exact-head release checks require rerun before merge, Vercel Production unchanged.


## Same-day owner-requested LIVE poster-source correction — 14 Oct 2026
**This section supersedes the preceding "0 Sheet writes" snapshot, which described the earlier PR-only pass.**

Owner explicitly requested a completed fix without repeated handoff. To prevent known inaccurate imagery from continuing to appear in Production while verified organizer originals are unavailable, made a **scoped live Core Sheet write** to clear exactly six unverified/incorrect **poster URL cells only**, preserving the 6 event records. Production \`main\` at \`d6dc3bfe\` already has a no-poster event-summary fallback, so a client refreshing canonical WebReady can display the event name/date/venue as temporary artwork instead of an unrelated photo or falsely official brand hero **without any Vercel deploy**.

### Exact change and rollback ledger
Backend spreadsheet: \`12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU\`
Only \`01_Events\` Sheet ID \`416044968\`, column E (\`poster_image_url\`), six cells, changed to **empty string**; original URL values preserved below for exact rollback.

| Core cell | Event ID | Before (rollback URL) | After | Derived |
|---|---|---|---|---|
| \`E331\` | \`EVT-20261015-LE7EL-1ST-DEBUT-ANNIVERSARY\` | \`https://www.thai2music.com/uploads/artists/photo_cover/cover_1035_1762919037.jpg\` | empty | \`08_Web_Ready!E332\` |
| \`E335\` | \`EVT-20261025-VVV-TORNADO-SHOPPING-XIAOMI\` | \`https://pbs.twimg.com/media/G3iTTicXMAAbtyE.jpg\` | empty | \`08_Web_Ready!E336\` |
| \`E336\` | \`EVT-20261030-AF-HALLOWEEN-AFTERLIFE\` | \`https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png\` | empty | \`08_Web_Ready!E337\` |
| \`E337\` | \`EVT-20261030-POPPAH4-HALLOWEEN-NAMP\` | \`https://static.amarintv.com/media/PJVlR0ljpO7yvkfhEH4VNNZ54YMVWAxlVfBQwSENDkv21tWvbtjShU6FnewvzElMDb.jpg\` | empty | \`08_Web_Ready!E338\` |
| \`E345\` | \`EVT-20261105-MIZUMI-PHUWIN-MOISTURE-MATCH\` | \`https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png\` | empty | \`08_Web_Ready!E346\` |
| \`E347\` | \`EVT-20261102-SUPER-SUN-ZEE-PRUK-BIRTHDAY-FANSIGN\` | \`https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png\` | empty | \`08_Web_Ready!E348\` |

### Verified readback after live write
- Google Sheets \`batch_update_spreadsheet\`: **6/6** mutation replies. Independent \`get_spreadsheet_cells\` immediately confirmed **all six Core E cells and their derived WebReady E cells empty**; derived formulas preserved in place.
- Every matched \`08_Web_Ready!J\` remains exactly \`show\`; inventory readback for each event remained \`2\`, no change to packages/stocks or owner visibility.
- Whole \`08_Web_Ready!A5:J380\` **57 future-visible** records on the 14 Oct date boundary, **6/57** now intentionally missing poster source, **51/57** retain their original URL. Exactly one cross-*name* identical image is Moonshadow Fan Party & After Party, both within its 14–15 Oct official dual-event poster series (not actionable as a mistaken image without new counterevidence). All six temporary image source notes remain as historical provenance; their former media URLs are no longer live.
- Existing Production \`script.js\` on SHA \`d6dc3bfe\` inspected: \`renderConcerts()\` keeps image-less cards visible and renders \`poster-placeholder-event\` with name/date/venue. \`fetchWebRows\` cache TTL is **zero**; refreshed clients should receive new feed data.
- **Network/browser signed-out visible readback remains unverified**: live \`/api/kk-data\` was not retrievable using available web tool, and the prior GitHub Visual QA runner remains failed. Do not claim 6 visual screenshots or official media delivered.

### Evidence-based official image search status
- Official/fan-reposted announcements confirm event details, but trustworthy image bytes of the **six exact 2026 events** and stable anonymous URLs have **not** been validated; avoid swapping in any similar artist imagery or older MizuMi May event / NuNew Oct31–Nov1 images.
- Visually decoded \`assets/event-posters/siam-halloween-2026-nov01-owner-original.webp\` from GitHub main: **official festival-wide flyer explicitly prints \`30 OCTOBER - 1 NOVEMBER 2026\`**, so reusing this festival poster on Oct30 is **not a false-date image**. Retained untouched.
- Drive filename search \`SUPER SUN\` returned actual NuNew concert flyers with SUPER SUN as sponsor; \`MizuMi\` returned old PondPhuwin May events. Both **rejected as wrong posters**.
- The earlier #727 exact-original-URL guards remain defense-in-depth if stale or historical content is reintroduced. Do not merge other unrelated PRs or deploy untested code.

### Next acceptance
1. Obtain/download actual first-party poster **for each of 6 events**, inspect image bytes/printed event title/date, check stable signed-out image delivery and appropriate rights/provenance.
2. Update only respective \`01_Events!E\` from empty to verified URL; read Core+WebReady, confirm \`J=show\` and verify in live customer browser.
3. Run the intended 320–1440px poster fit and rendered UX checks on #727's exact HEAD, resolve the GitHub Actions fail/no-steps issue without paid quota, obtain reviewer/owner accepted screenshots, then separately merge/deploy with rollback.
4. Avoid scanner auto-restoring any of the six original incorrect URLs; retain this ledger for cross-chat continuity.

**Live result:** 6 confirmed incorrect/non-event picture URLs removed from the production data source, with record visibility preserved. **Not delivered:** 6 replacement organizer-original posters and verified client screenshots. No Booking, price, inventory, status, LINE send, Vercel release, or Google Drive ACL changed.
