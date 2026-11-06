# November Ultra Deep mall-artist lighting miss — 2026-10-30

## Incident and independently checkable source
The owner reported the missed **The Mall Lifestore / The Great Happy New Year Christmas Tree Lighting Ceremony** with TeeTee–Por and PROXIE on **2026-11-06** at The Mall Lifestore Bangkapi. Official M Card event page: https://www.mcardmall.com/th/promotions/8300 .

This is a **mall / brand / artist appearance** discovery case. It is not restricted to a concert or a separately ticketed event. The event was absent from the original 2026-10-28 November Ultra Deep selection and Core storefront event master; a separate incident recovery entry on 2026-10-30 in the Event Tracker is staging evidence, **not** a successful storefront publication.

## Root cause and repair boundary
- A BRAND_SPONSOR or VENUE **tier** receipt does not prove that every high-priority direct source in that tier was checked. The source universe has a separate required-by-source receipt gate; previously it did not enumerate the specific M Card artist-event or The Mall plaza activation sources.
- Generic mall and retail-performance queries did not ensure coverage of Christmas tree lighting, artist retail appearances, outdoor mall plaza shows, and fan zones.
- The live known-miss corpus had no exact identity/date for this event. A future November scan could miss it again without a named regression challenge.

### Changes in this branch
1. **SourceRegistry V9** adds two required direct-source lanes, `mcard-the-mall-artist-events` (BRAND_SPONSOR) and `the-mall-lifestore-plaza-artist-activations` (VENUE). Both use the official `mcardmall.com` domain and genre-specific Thai/English search variants.
2. **KnownMiss V13** adds the November 6 exact event identity and official M Card source, with an October discovery-window probe for early warning.
3. Regression tests require these source lanes and fail when the M Card source receipt is not executed; date/source missing for this exact event must not pass strict live recall.

## Safety: unchanged
Scanner authority is STAGING_ONLY. No auto-created event, price, booking, inventory, LINE/X notification, owner-hidden reopen, production data write, deploy, or merge. A valid candidate must still pass real official detail, photography/lens/access rights, external rental demand, exact stock/booking and owner lock checks, Verifier and governed Admin writer/readback before publication.

## Acceptance criteria (not asserted complete by this document)
- Run Node targeted tests for source registry, known-miss, and full discovery worker at the exact branch HEAD and independent review.
- Verify monthly `2026-10` and `2026-11` operational search plans include required M Card and Mall lanes, with real executed provider receipts and event detail source.
- Test positive: official Nov 6 event with correct date and source reaches candidate staging; negative: missing source or Nov 5 wrong date remains HOLD/known miss.
- Live November Ultra Deep with genuine receipt URLs, execution evidence, reconciliation and `known_miss_live_recall` passes; a failed direct source must leave FULL false. Monitor adjacent future mall-artist events to avoid one-off success.
- Gate separately for photography/lens policy, existing booking/Owner Locks, competitor price or approved fallback, Verifier and storefront exact readback.
- Only after release gates, and separate owner-approved actions, consider any changes to live storefront.
