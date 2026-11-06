# KK Phone Rental — X Marketing Master Operations (owner directives, 2026-10-15)

**Status:** Owner operating contract and release checklist, STAGED in Draft PR #694 only. **Not deployed**. Reading this file is not proof of Agent invocation, booking/price freshness, or CI acceptance.

## Non-negotiable source sequence (new readback per request)

1. **Booking & owner gate:** Read current `00_Master_Booking`, `18_Event_Visibility_Locks`, assets and owner instructions. Resolve exact event IDs and date-by-date bookings, allocations and owner locks. Never promote an owner-locked event/day; never unhide, override, reprice, alter booking or change an asset to make marketing pass.
2. **Storefront gate:** Reconcile `01_Events`, `03_Packages`, `04_Event_Overrides`, `08_Web_Ready`, `09_Web_Packages` against the live customer-facing website, including event, venue, all dates, package/device/Lens totals, booking status and active poster. Do not use remembered prices or assume hidden means sold out.
3. **X + log gate:** Read `18_X_Post_Log`, then check what the public X account actually shows (or authenticated evidence where available). `planned` and `assumed_posted` are NOT proof of publication. Treat missing real impressions, engagement, clickthrough and recent-timestamp evidence as `UNVERIFIED`. Do not present a marketing heuristic as a measured X metric.
4. **Marketing + learning:** Rank eligible events by time-to-event, event context/fandom, verified recent conversation and posting fatigue, booking opportunity, competitor visibility, and verified engagement velocity. Booking and owner locks supersede every score. Read `17_Content_Performance` and `19_Content_Experiments` only for defensible measured learning; without reliable records use `RULE_BASED_COLD_START`. Do not claim model training, Hugging Face inference or independent X verification without evidence.
5. **Agent invocation:** Read current checked-in bridge schemas before constructing any GitHub Issue payload. Single: `[KK-CONTENT-RUN]` / `kk-content-chat-bridge.yml`; batch: `[KK-CONTENT-BATCH]` / `kk-content-batch-chat-bridge.yml` plus Diversity QA; plan: `[KK-X-PLAN]` / `kk-x-posting-plan-chat-bridge.yml`. Internally create three distinct creative angles per event. Require the real Marketing → Strategy → Content → QA → Selector chain and persisted invocation ID, bridge PASS, QA PASS and Selector PASS. If the Ledger fails, result remains **BLOCKED**; no fake PASS, no ad-hoc bypass. Output only one selected candidate per event.
6. **Owner Review:** All content is a draft until owner approval. No automatic X publishing, scheduler activation, ad spend, production writes, merges, deployment or access-control mutation.

## Copy output contract

- Start with exact header `📱 KK Phone Rental | #เช่ามือถือ` once.
- Include verified event name and official event hashtag in the event section, an artist/fandom-specific hook, and truthful venue.
- Include current model/device price and Lens upgrade amount or package total with unambiguous wording. Only place model name on the price line, not in CTA. Avoid stock/unit counts and made-up scarcity.
- Display `✅ ว่าง` only for a canonical available day and `❌ เต็ม` only where confirmed full **subject to the owner-lock conflict resolution below**. Do not imply that tickets are sold out or that hidden means out of devices.
- Benefits only if still verified: free insurance, deposit waiver conditions, on-site pickup/return and help using the device, free Google Drive for 30 days.
- One fresh artist/event-specific booking CTA without repeating the brand/model; canonical URL `https://kk-phone-rental.vercel.app/`.
- End with exactly three distinct, source-verified hashtags other than the brand and official event hashtag; at least five distinct verified tags overall.
- Dates, prices, recent postings and hashtags remain unverified/blocked until sourced. Do not show candidates that failed the source or owner gates.

## Schedule contract

- Use **Asia/Bangkok** and cover the exact user requested period. Evaluate all qualified events in scope before ranking. Avoid same-event repeat, unverified X data, hidden dates or owner-locked events.
- Draft PR #716 proposes a precautionary 2-post/day, >=90-minute gap for *recommendations*, **not an official X numeric rule**. Do not describe it as a Production restriction until verified merged/deployed. Use confirmed live safety restrictions; if unknown, label schedule tentative or block.
- No X scheduling or posting without separate owner review.

## Release conflict requiring explicit fail-closed reconciliation

Previous PR #694 branch logic maps `closed / hidden / owner_closed / locked` to public `❌ เต็ม`. The newer 2026-10-15 master directs staff **not to call a hidden/locked event sold out**, not to promote owner-locked dates, and to distinguish true full from owner-hidden internally. Existing binary copy format does not itself authorize a false inventory claim. **Until safe date-level eligibility and display treatment is implemented and tested, block any candidate whose verified source contains hidden/locked dates that could be misrepresented as full; never silently relabel a hidden date as an actually booked-out unit.** A multi-day event must preserve eligibility for genuinely sellable other dates once the separate daily contract is reconciled.

## Evidence snapshot (2026-10-15, no live activation)

- Draft PR #746 Agent Ledger source regression workflow run [38718775671](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38718775671): focused **48/48 PASS**; full PR suite **1,487/1,508 PASS, 21 FAIL** vs exact main **1,477/1,498 PASS, 21 FAIL**, **0 new failing test names**. CI conclusion still FAIL; no live Ledger readback accepted.
- Draft PR #694 previous zero-install workflow run [38717483299](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/38717483299): **37/39 PASS**, 2 failures. Later PR test fixes and final Unicode hashtag regex commits are **not yet backed by a successful exact-head Actions run**.
- Changes staged on Draft PR #694: source enforcement for official event hashtag and three verified closing tags, additional regression cases, separate batch archetype assertion, bridge error diagnostics. A direct, isolated **6/6 V8 smoke** on exact policy source passed; this does not equal the native Node suite or full CI.
- Draft PR #716 is shadow-only. No production X engagement verification or end-to-end persisted Agent Invocation acceptance can be inferred from its code.
- This document confers **zero** new permissions. No X publication, spend, Booking, Core Sheets, Production, merge or deploy is authorized.

## Exit gates

- [ ] Reconcile hidden/locked date vs binary public display without false full claims; test multi-date.
- [ ] Re-run exact-head PR #694 native Node/Actions QA; investigate previously failing single-bridge comment test rather than relaxing production gates.
- [ ] Address or independently disposition inherited full-suite CI failures, require reviewer acceptance and mergeable PR diff before release.
- [ ] Require separately approved audited Ledger targeted deploy and real authenticated OIDC Ledger row insertion/readback after PR #746 review.
- [ ] Require exact canonical Booking/Storefront/post-log receipts, five-stage real Bridge PASS + Selector/QA PASS + Invocation ID.
- [ ] Obtain human owner approval for each X publication. Never auto publish.
