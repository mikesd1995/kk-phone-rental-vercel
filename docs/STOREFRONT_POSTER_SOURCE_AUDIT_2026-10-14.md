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
