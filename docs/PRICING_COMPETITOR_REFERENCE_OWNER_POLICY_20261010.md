# KK Phone Rental — Owner Pricing Rules: 0 / 1 / 2 / >=3 Exact-Event Competitor Shops
Date of latest owner clarification: **2026-10-10 Asia/Bangkok**.
Source: user explicitly confirms “ถ้าเจอคู่แข่งแค่ 1-2 ร้านก็เอามาเป็นราคาอ้างอิงได้นะ”, after earlier clarification “790 / 990 เฉพาะงานที่ไม่มีคู่แข่ง”.
This document supersedes the earlier simplified assumption that all Fri/Sat/Sun fallbacks should be 790/990, and supersedes treating 1–2 competing shops as "no market".
**Code implementation: Draft PR #680, `server/kk-final-pricing-policy.js` VERSION `KK_FINAL_PRICING_POLICY_V6_OWNER_COMPETITOR_REFERENCE`. NOT MERGED OR RELEASED.**

## Pricing decision matrix
| Exact-event competitor evidence from independent shops | Mon–Thu | Fri–Sun | Label / confidence | Action |
|---|---|---|---|---|
| 0 shops **after actual search** of exact-date/artist/event, comparable vivo X300 Pro rental | 490 phone / 590 with lens | **790 phone / 990 with lens** | `NO_COMPETITOR_FOUND_IN_CHECKED_SOURCES`, not proof no shops exist on internet | Owner fallback, `needs_price_recheck=true` |
| 1 verified qualifying shop, 1 comparable price | **Use that shop's observed package price as reference**, whether weekday/weekend | Same | `EXACT_EVENT_ONE_SHOP_REFERENCE`, **provisional, not a median** | Show observed values and search timestamp; recheck as market develops |
| 2 **independent** verified qualifying shops | Show each shop's observed range and **midpoint per package** as reference | Same | `EXACT_EVENT_TWO_SHOP_REFERENCE_MIDPOINT`, **provisional, not high-confidence median** | Retain range and source links; do not label as 3+ shop median |
| >=3 **independent, current, comparable** qualifying shops | Use validated per-package **median** | Same | `EXACT_EVENT_COMPETITOR_MEDIAN` | Apply median after verifier/owner locks |
| Competitor found but prices missing, unverifiable, or stale | Keep existing provisional pricing pending new quotes | **DO NOT** use the zero-competitor 790/990 rule; existing 690/890 is a temporary, separately labeled fallback if no owner price | `COMPETITOR_FOUND_NO_VALID_QUOTE` | Scan again, report source/evidence gap |
| Not scanned / market state unknown | No proof zero shops | **DO NOT** infer zero competitor or auto-increase to 790/990 | `COMPETITOR_STATUS_UNKNOWN` | Gather and persist search/source receipts |

**Classification is scoped to the actual event and date, comparable rental model and package, not ticket-price listings or general market quotes.** A post reposted by the same shop is **one shop**, not two. Preserve any separately published *phone-only* and *phone + lens* prices from one shop; do not invent a 200-THB lens surcharge if that shop explicitly charges another amount. Derive a missing package from the shop quote + KK's lens baseline **only** when the competitor did not publish that package; mark the derivation provisional.

**Never alter** any date with active booking (even when one phone available), previously owner-hidden/tombstoned event, owner-final price, or individually approved exception. No standalone lens package re-enabled. Do not publish a discovered event without its correct event-date/venue/access/photo rights and governing verifier.

## Evidence and freshness
- SOT: Event Tracker `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`, `_Competitor_Price_Current` and `_Price_Evidence`, plus original current X posts and official organizer event date. Keep exact quote URL, account, timestamp, device, package, rent/insurance terms, last checked, freshness, comparable/noncomparable classification and date match.
- Existing `_Price_Evidence` has **one old quote** for `YUEDPAO presents MEME FEST` Oct 17–18: `duen_munk` (observed Aug 8) **900 phone / 1200 bundle**. It demonstrates a real competitor **exists** for this exact event family, but does **NOT** certify a fresh Oct 17 median. Therefore this event was excluded from the prior 23 zero-competitor uplifts; no new live price write on this 2026-10-10 policy turn.
- Distinguish `COMPETITOR_NOT_FOUND` (executed source search; 0 found) from `NO_QUALIFIED_FRESH_PRICE` (possibly 1+ old shops) and `NOT_SCANNED`. Zero results do not warrant an internet-wide no-competition guarantee.

## Implementation and acceptance
- Draft code `server/kk-final-pricing-policy.js` groups rows by independent account, respects true phone-only and bundle values, computes one-shop reference, two-shop midpoint/ranges, three+ median, booking/owner final price locks, and distinguishes unknown vs zero competitor. `tests/kk-final-pricing-policy.test.js` covers one/two/three, same shop duplicate, original distinct bundle price, unknown vs zero, existing competitor no usable quote, booked date and owner lock.
- **Local connector-side isolated pure-JS run:** 22 policy tests passed; **1 unrelated Verifier integration case skipped** because its dependency was not executed in the isolated runner. This is **not** a GitHub CI pass, Vercel Preview acceptance, or production verification. Production remains older main while Draft #680 needs authentic full CI/preview/security acceptance.
- The previously published **23 Friday/Saturday/Sunday events** that were changed from 690/890 to 790/990 on 2026-10-10 remain as recorded in Issues #685/#686. This policy clarification changed **0** Google Sheets prices in this follow-up. Should a verified 1–2 shop exact-event rental quote arrive for one of those 23, apply provisional reference/review rather than pretending 790/990 must remain or blindly rewriting the owner price. **Existing owner-final and Booking remain authoritative.**
- **NO automatic X posting, Booking confirmation, production merge, deployment, paid topups or scanner business writes.**

## Durable pointers
- October event writes and market exclusions: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/685
- November event writes and missing posters: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/686
- Code/tests, unmerged: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/680
