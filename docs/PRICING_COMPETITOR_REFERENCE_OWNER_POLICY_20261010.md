# KK Phone Rental — Owner-Controlled Competitor Pricing (FINAL owner clarification 2026-10-10)

**Authoritative user instruction:** “ไม่ถ้าเจอ 1-2 ร้านให้บอกว่าคู่แข่งเค้าตั้งราคาไหนกัน แล้วเดียวฉันตัดสินใจเอง ส่วนราคาเริ่มต้นก็ให้ใช้ราคาที่เซ็ตไว้ก่อน”.

**THIS DOCUMENT SUPERSEDES** the earlier 2026-10-10 policy entry saying 1 shop can be used to automatically set a reference price or 2 shops should trigger an automatic midpoint. That previous automation is **REVOKED**.

## Required pricing and owner-approval behavior

| Exact-event comparable independent rival shops found | Correct system behavior | Storefront price before owner decision |
|---|---|---|
| **0, after an actual verified source search** | Apply approved initial fallback only when no owner lock/Booking: **Mon–Thu phone 490/bundle 590, Fri–Sun phone 790/bundle 990** | Approved fallback / existing owner price |
| **1** | **Report the single shop's ACTUAL publicly advertised phone and/or bundle price**, account, post URL, checked date and source freshness, without calculation. **Ask owner to decide.** | **PRESERVE the current/default price**, write **zero** price overrides |
| **2** | **Report each shop separately** with their ACTUAL prices, accounts, links and timestamps. **Do NOT calculate midpoint, recommend a new price as final, or automatically use their quote. Ask owner to decide.** | **PRESERVE the current/default price**, write **zero** price overrides |
| **3 or more** independent **current, relevant, comparable** verified shops | Use the independently verified median **per actual package** as the previous automatic comparison policy, subject to Booking, owner lock, verifier, publication gates | Do not override owner-final/Booking |
| **A competitor exists but the price is unavailable, outdated, unverified, or data contradicts shop counts** | Report that evidence is incomplete and request manual decision/research; do not reinterpret it as 0 shops | **Keep existing price** |
| **Never searched** | UNKNOWN, not the same as “0 shops” | Keep current default; no speculative 790/990 uplift |

This is **not** an authorization to change every event to 790/990 or to change existing bookings. Historic owner-hidden/tombstoned events must never be reopened. Any price override on booked dates is locked even if inventory has an unbooked phone.

### Mandatory report format for one or two competitors
Include **event title, exact event date, KK currently published phone price and bundle price, competitor account name, observed actual phone-only and actual phone+lens prices (mark “not advertised” for unavailable), original post link, observed/last checked time, freshness and any relevant rental-condition differences.** Show shops in individual rows; do not invent a missing competitor package price by adding 200 THB. Put a clear **“รอเจ้าของร้านตัดสินใจ — ยังไม่ปรับราคา”** label. The owner then specifies a final price or maintains the initial/default price.

**Critical:** a shop posting phone and bundle is **ONE** shop; duplicate reposts do not count twice; concert admission ticket prices are NOT phone rental quotes.

### Implementation in Draft PR #680, not production
- `server/kk-final-pricing-policy.js` `KK_FINAL_PRICING_POLICY_V7_OWNER_QUOTES_NO_AUTO_REPRICE`: for detected competitor shops with fewer than 3 *verified independent comparable quotes*, `resolve(...)` returns `HOLD_FOR_OWNER_COMPETITOR_PRICE_DECISION`, `source='COMPETITOR_QUOTES_REPORT_ONLY'`, `final_prices=[]`, `requires_per_event_owner_price_decision=true`, `production_writes=0`, `existing_prices_preserved=true`, `competitor_quotes=[{shop, phone_price, bundle_price, source_url, checked_at, freshness}]`. Explicit 1/2 shops even when no usable prices -> HOLD. If discovered 3 shops but only one/two deduplicated usable quotes -> also HOLD.
- `tests/kk-final-pricing-policy.test.js` now checks one-shop and two-shop quote reporting and **no price writes**, preserving raw phone and bundle quotes, removing midpoint assumptions, owner-lock/booking behavior, conflicting count and quote evidence, 3+ median, unknown vs checked zero.
- Connector-side isolated pure JavaScript test exercise: **24 passed, one unrelated verifier integration not executed**. Not GitHub Actions/Production validation. Draft PR #680 still requires full CI and governed release acceptance.
- **NO pricing spreadsheet mutations in this clarification turn.** Existing 23 Fri-Sun no-competitor-found cards previously set to 790/990 remain as is until owner decides or new market evidence verified. Example existing MEME FEST competitor `duen_munk` listed an Aug 8 observation of phone 900 and bundle 1200 for 17–18 Oct; do not automatically update old 690/890 on this historical, insufficient-freshness source.
- **No autonomous X posts, bookings, paid credits, Vercel production deployments or unapproved merges.**

## Cross-chat location
- [Pricing code & tests, Draft PR #680](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/680)
- [October audit issue #685](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/685)
- [November audit issue #686](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/686)
