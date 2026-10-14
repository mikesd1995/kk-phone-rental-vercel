# KK Phone Rental — Phone-first storefront price and lens-only truth
Date: 2026-10-14, Asia/Bangkok. User-directed continuation **TASKS 2–13; TASK 1 EXCLUDED**. NO production merge/deploy, no booking/customer/status/visibility/price/asset updates, no paid CI, no X/LINE sends.

## Source of live defect
- Canonical live Core Sheet `08_Web_Ready` has `EVT-20261203-BTS-WORLD-TOUR-ARIRANG` and `EVT-20261205-BTS-WORLD-TOUR-ARIRANG` with `J=show`, textual `booking_status_for_web=เปิดจอง`, but `available_phone_count=0`, `available_lens_count=1`. Their Web Packages each have `phone_only` and `phone_lens_bundle` `full`, `lens_only` available count=1. This is a **lens-only commercial offer**, not an available phone. Do not hide event dates or claim more phones exist.
- Draft PR [#711](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/711), `fix/storefront-p0-price-line-locales-20261013` @ `7802007adfc5a1e2e243cc911eeb766bb6be5b41`, had improved starting price by skipping unavailable rows but **still selected standalone `lens_only` if cheaper even when phones were available**. Example phone-only 790, bundle 990, lens-only 200 all available => displayed generic `เริ่ม 200฿`, materially misleading in a phone-rental storefront. On a lens-only day, generic `เริ่ม 200฿` failed to explain phone was fully booked. Badge `getBadgeText` prioritized soon/today over the lens-only restriction.
- Note source `available_phone_count=0` but available standalone lens does NOT authorize restoring a phone package or changing Booking/stock.

## Actual source changes on this isolated non-main branch
1. `script.js` adds `onlyLensBookable(c)` using **effective, already-clamped `p.avail`** after shared inventory safety rules, not the raw package row and not fictitious SKU availability.
2. `startingPriceFor(c)` prioritizes the lowest currently bookable **phone-only or phone+lens bundle** price when any phone package is available. Cheaper standalone lens price is excluded from the phone-rental headline. If *only lens* is bookable, its price remains displayable with an explicit label.
3. Thai `card_price_lens_only`: `เฉพาะ Lens {price}฿ · มือถือเต็ม`; English `Lens only ฿{price} · Phones fully booked`. `cardPriceText` selects this format solely for lens-only cases, keeping waitlist for no available package.
4. `getBadgeText` prioritizes `badge_lens` on genuine lens-only days ahead of soon/today marketing badges; core stock, owner event action, visibility, LINE booking and price are untouched.
5. Adds `tests/storefront-phone-first-lens-only-offer.test.js`: 5 cases (phone+cheaper lens, BTS lens-only even on near-day, English, fully unavailable -> waitlist, bundle-only). Uses exact extracted source functions, not copied calculator logic. Wires `test:storefront:phone-first-price` into `package.json` postinstall and JS syntax gate. No new dependencies.

## Verification
- GitHub exact updated source and tests read back. Both JS scripts parsed by V8 successfully. **5/5 authored cases executed against exact source in isolated V8 with a Node built-in shim, PASS**. These are NOT native Node CI, browser visual QA, or Vercel Preview/Production acceptance.
- Current Vercel Production remains READY on main `d6dc3bfe4cc0c4dd6fdfec407823752da0572464` at earlier same-day owner connector read, API uses `public-gviz-fallback`, not private reader.
- This branch **is NOT a PR**, because GitHub private-repo Actions included-minute usage is uncertain and prior exact-head PR #739 workflow attempts show zero exposed job steps. Do not initiate billable runs or bypass CI. Reconcile this patch with Draft #711/ #727/ #739 in the designated release branch after quota/headroom and final exact-source tests.

## P0 dependencies and related findings
- Security P0 [#738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738): Core Booking Anyone/Reader and private-data Source. Owner Apps Script private transport + Revenue X integration staged on [unified branch](https://github.com/mikesd1995/kk-phone-rental-vercel/tree/fix/private-core-revenue-apps-script-integrated-20261014), NOT deployed. No ACL revoke until real private read and signed-out site/Admin E2E.
- Image ACL P0 [#718](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718): sampled official poster Drive ID `1OVYGQIlzt-n_la8eKKwgFIBcrrVxix78` still Everyone/Writer. Connected Drive sharing tool supports new named users/company but no update of existing public-role permission. Do not claim repaired; secure owner UI / appropriately authorized permission endpoint with readback and guest image tests remains mandatory.
- LE7EL Oct15 official @LE7EL_Official public social statement confirms `15 October 2026, 18:00 onwards, AIS SIAM`, access from 17:00, special cup sleeve from 13:00. Cross-check eveduler/PopRadar. This validates **event/date/venue** but does **not** provide an image-asset URL with verified bytes + signed-out decode. Keep Core/WebReady poster empty rather than substitute 2025 old debut art; see #731.
- Core Master/Archive orphan fix and owner FORTREASURE poster prior completed as Issue #489 and #733; NOT part of new code patch. Booking task #1 remains fully excluded.

## Next acceptance before release
1. Native `node --test tests/storefront-phone-first-lens-only-offer.test.js` plus existing storefront/booking/no-deposit regressions and exact-head hosted checks with **verified free runner admission** (#707).
2. Real browser on 320/375/390/768/desktop, check BTS lens-only card price/badge/CTA and phone-available event price with cheaper lens, tab/filter/search and dark/light TH/EN.
3. Release only one integrated head after owner safety acceptance. Verify Vercel Production alias SHA, public /api feeds source, actual UI and data readbacks, owner booked-day rules, rollback. Do not add new fees.
4. Official poster #731 may be addressed independently by verifying correct source/image bytes before exact Core E edit; keep visibility unchanged.

**Status: SOURCE FIX+ISOLATED TEST PASS, RELEASE HOLD.** No local/published stock or Booking claims beyond verified business data.


## Follow-up acceptance increment — exact branch latest at 2026-10-14
Detected a related card CTA: on lens-only days, the old `tap_available` copy still implied choosing a phone model (`เลือกรุ่นที่ถูกใจ`). Patched `script.js` to show `tap_lens_only="ดูแพ็กเกจ Lens"` in Thai and `tap_lens_only="View lens-only package"` in English if and only if `onlyLensBookable(c)`. The normal booking phone CTA and full-day waitlist CTA remain unchanged.
Added a sixth exact-source regression to `tests/storefront-phone-first-lens-only-offer.test.js`. Re-fetched both GitHub blobs; V8 source+test syntax **2/2 PASS** and authored extracted-source tests **6/6 PASS** in an in-memory Node-shim (not native Node/CI or visual QA). Source update [1a09119](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/1a09119fef68c8d6de662a4604b42544860940de); test [df0aa139](https://github.com/mikesd1995/kk-phone-rental-vercel/commit/df0aa13993f241541a7e27834476da9a22748b5a).
**Still source-only, no storefront Production deploy**.
