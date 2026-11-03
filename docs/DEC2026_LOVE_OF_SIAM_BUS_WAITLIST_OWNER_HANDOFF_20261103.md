# KK Phone Rental — December 2026 Love of Siam + Happy BUSDAY owner request
## 2026-11-03 (Asia/Bangkok) — source-only staging and release handoff

**Owner intent:** Add **รักแห่งสยาม The Musical** as true exact-date storefront event cards without double booking the two shared vivo X300 Pro phones. Reopen **Happy BUSDAY 1 + 2 = 3** on **5 and 6 December 2026** **only as a visible FULL / LINE คิวหลุด waitlist card**, even when zero phones are available. Use the correct existing BUS posters, and locate/verify the original correct-year Love of Siam official visual. Do not send customer booking confirmation or collect payment for a full date.

**Actual result in this branch:** a structured, fail-closed staged manifest and offline test contract. **NOT published.** No Core, Booking, Price, Stock, Owner Locks, Drive poster files, Make, notifications, Vercel Production, GAS, or public web state were changed. Production release is still blocked by Draft P0 PR #831 and mandatory gates. Do not claim that this work is complete or live.

## Source material read and verified
- Google Sheets canonical Core: `https://docs.google.com/spreadsheets/d/12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU/edit`. Read `01_Events!A4:I550`, `08_Web_Ready!A4:K550`, `00_Master_Booking!A4:W180`, `18_Event_Visibility_Locks!A1:N400`. Tracker: `https://docs.google.com/spreadsheets/d/1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo/edit`.
- Poster procedure: `docs/OWNER_POSTER_UPDATE_RUNBOOK.md`: never replace bytes on existing Drive file ID; new immutable file ID, exact Core/Web Ready URL and storefront visual readback.
- Full Loop safety: `docs/ULTRA_DEEP_ZERO_COST_RUNNER_2026-10-04.md`; visibility/waitlist semantics: `docs/STOREFRONT_HIDDEN_PACKAGES_WAITLIST_2026-09-25.md`; Scanner authority: `.agents/skills/kk-discovery-scanner/SKILL.md`.
- GMMTV original news `https://www.gmm-tv.com/news/4485`, `https://www.gmm-tv.com/news/4506/`: Love of Siam is at Muangthai Rachadalai Theatre; 17 performances during Dec11–25; tickets sold out (separately advertised Dec09 Gala, total not reconciled). Direct ThaiTicketMajor catalog `https://event.thaiticketmajor.com/search/` lists 9–25 Dec 2026; indexed original GMMTV post notes Dec9 Gala (Balcony-only). Specific session schedule corroborated by secondary `https://taomeoticket.com/en/guides/ve-the-love-of-siam-the-musical-2026`; never treat secondary session details as independent organizer authorization.
- BUS confirmed at official venue: `https://www.qsncc.com/en/whats-on/event-calendar/happy-busday-1--2--3/`, 5–6 Dec, Exhibition Hall 3–4 G.

## Existing Core exact evidence (no edits)
| Item | Core row | Web Ready row | Historical owner lock row | Date |
|---|---:|---:|---:|---|
| Happy BUSDAY `EVT-20261205-HAPPY-BUSDAY-1-2-3` | 71 | 71 | 168 | Dec05 |
| Happy BUSDAY `EVT-20261206-HAPPY-BUSDAY-1-2-3` | 72 | 72 | 171 | Dec06 |

- Both Core rows are **open / active_on_web=FALSE / data_health=OK**. Web Ready returns **0 phones, 0 lenses, `hide`**. Prior `LOCKED` reason is `BOOKED_DAY_OTHER_EVENT_HIDE_2026-10-12`. Owner's latest message supplies exact new authorization to reopen **BUS only for waitlist visibility**, not to undo unrelated locks.
- Existing poster Drive IDs: **Dec05** `1QwU7u1YqE6Bg2M36EpLF6MfrHbfWnoaP`, **Dec06** `1w4S7FPokElqBgWppHOGeWUQGdK4dtXx-`. Current URLs are not evidence of visually correct official event artwork: inspect before release, and upload any replacement with a new file ID if needed.
- Dec05 has **two confirmed BTS bookings**, PHONE-001 and PHONE-002. Dec06 has **two confirmed WILLIAM EST bookings**, PHONE-001 and PHONE-002. BUS cannot sell either date. Status must be **`show_full` / `เต็มแล้ว`** and click opens the nonbinding LINE waitlist path, never booking or checkout.
- December booking audit observed **11 confirmed + 2 cancelled** exact records across dates. The cancelled Dec06 William Est and Dec07 Prow records must remain cancelled and must not override shared availability.
- Existing **P0 on BTS Dec03/Dec05**: Web Ready may report `show` when `phone=0,lens=1` because of stock formula. Draft #831 repairs this in **source only**; live deployment/readback not accepted as of this run.
- Owner explicit **JASP.ER-only exclusivity** Dec18/19/20: Dec18 two confirmed, Dec19 one confirmed, Dec20 two confirmed. **Do not publish Love of Siam on any of these three dates**, even if Dec19 shows one theoretically free phone.

## Love of Siam proposed exact date/day cards (not yet created)
| Date | Show sessions (secondary index; verify with TTM) | Action |
|---|---|---|
| Dec09 | 19:30 Gala | candidate only, primary/session/poster/rights/price gates |
| Dec11 | 19:30 | candidate only |
| Dec12 | 14:00; 19:00 | **one calendar-date phone pool**, not two separate phone stock pools |
| Dec13 | 14:00; 19:00 | same shared-date rule |
| Dec16 | 19:30 | candidate only |
| Dec17 | 19:30 | candidate only |
| Dec18 | 19:30 | **EXCLUDED OWNER JASP.ER-ONLY** |
| Dec19 | 14:00; 19:00 | **EXCLUDED OWNER JASP.ER-ONLY** |
| Dec20 | 14:00; 19:00 | **EXCLUDED OWNER JASP.ER-ONLY** |
| Dec23 | 19:30 | candidate only |
| Dec24 | 19:30 | candidate only; already visible INK event shares inventory |
| Dec25 | 14:00; 19:30 | candidate only; already visible CSE event shares inventory |

**IMPORTANT 2026-11-03 source correction:** GMMTV's primary press release explicitly states **17 performances during Dec11–25**, and the official GMMTV announcement separately describes a **Dec09 Gala Night**. The secondary 12-date/session matrix above adds up to 17 *including Gala*, therefore **the combined show count / one or more per-date secondary sessions are NOT reconciled to the primary source**. Do **not** assert exactly 17 inclusive of Gala or that every secondary session is correct; verify each event date and TTM performance identity before publication. The nine proposed safe day cards are tentative, **not nine independent allocations of two phones per existing event.** Maintain no phantom capacity across same-calendar-date events. The musical is staged theatre: attendee phone filming and detachable-lens permissions are **not verified**; do not claim permitted recording or offer lens without the organizer/venue policy. **No final rental price or approved original poster has been established, so do not turn these candidates into saleable cards yet.**

## Files in this branch
1. `ops/owner-curation/dec-2026-love-of-siam-bus-waitlist-intent.json` — exact row IDs, owner override scope, source links, zero-stock requirements, nine candidate day cards and mandatory readback.
2. `tests/dec2026-love-of-siam-bus-owner-publish-contract.test.js` — read-only, zero-write regression contracts; verifies JASP exclusions, distinct BUS identities, `show_full`, two booked phones, no price/stock/Booking mutation authority.

## Safe publication execution after independently approved release gate
1. Complete integrated P0 Draft **#831** exact-head independent review, full `npm run check`/`npm test`, registered UX/visual QA, deployed GAS provenance, zero-stock phone/lens regressions and customer/LINE E2E. **No merge/deploy/production business write prior to acceptance.**
2. Before any live write, obtain fresh sheet, date-indexed Booking and Owner Locks readback. Verify no changed Core IDs/status, duplicate dates, reserved phones or conflicting owner instructions since this document.
3. Validate exact TTM dates/sessions, final price under existing approved pricing policy, original 2026 Love of Siam poster provenance and permissions. Record filming rights (phone and removable lens separately), or leave recording-dependent rental unavailable.
4. Through governed Admin identity / fenced writer only, perform **BUS exact 2-ID visibility reopen** and update the **historical two lock records** consistently to `REOPENED` with explicit owner intent. Preserve other 355+ historical locks, Booking rows, price/stock and all unrelated Core rows.
5. Require **BUS** derived `08_Web_Ready` exact IDs: `show_full`, `เต็มแล้ว`, `available_phone_count=0`; all relevant new phone `09_Web_Packages` options unavailable/hidden; live card shown with visually correct official poster; clicking CTA opens LINE inquiry with BUS/date context, never payment/confirmed booking.
6. Create **Love of Siam** dates (nine only) with validated official artwork, approved final pricing and rights, shared-date available phones, independent package controls; ensure Dec18/19/20 are absent. Do not publish date ranges as unverified daily cards.
7. Verify same request and exact readback in Core `01_Events`, historical locks, derived `08_Web_Ready`, derived `09_Web_Packages`, customer storefront / mobile and LINE; preserve all 11 previously confirmed December bookings, all other Owner Locks and all unrelated events. Store SHA, policy version, exact URL, source, photo file ID, accepted CI/gates and final business mutation count in GitHub.
8. Only then mark **COMPLETE**. A merged source-only PR or staged JSON never proves deployment.

## Result and blocker for future chats
**RESEARCH + STRUCTURED STAGING = DONE; PRODUCTION PUBLICATION = NOT DONE.**
Reason: canonical P0 fail-open phone booking behavior and Draft #831 release hold; no independent gate or licensed original Love of Siam event poster / recording rule proof. Owner intent is recorded, not acted on in Production. Never bypass this by direct Google Sheet toggles, manual `show` edits, static fake event cards, or duplicate scanner.

---

## 2026-11-03 later owner retry: executable read-only BUS release preflight (not a write)

Source-only `server/dec2026-owner-waitlist-release-preflight.js` has been added with matching tests `tests/dec2026-owner-waitlist-release-preflight.test.js` to replace the earlier manifest-only handoff with a real, deterministic fail-closed gate. It calls the existing `server/event-visibility-owner-guard.js.evaluateSnapshotTransition` to ensure only explicit owner Admin reopen can pass persistent `LOCKED` records.

### Exact live source findings (fresh Google Sheets readback)
- `01_Events!A71:I72`: BUS 05/06 Dec `open/active_on_web=FALSE/data_health=OK`, correct established poster IDs have URL values but **visual/rights proof is not yet accepted**.
- `08_Web_Ready!A71:K72`: both show `phone=0,lens=0,action=hide`.
- `18_Event_Visibility_Locks` exact old rows 168/171 still LOCKED `BOOKED_DAY_OTHER_EVENT_HIDE_2026-10-12`.
- `09_Web_Packages` Dec05 exact rows **203–205**, Dec06 exact rows **206–208**. All three packages per date are `hidden`. Dec05 lens-only has **raw 1 lens** remaining but **hidden**, phone-only and bundle have `available_count=0`. Dec06 all zero. **Never treat that spare lens as a fresh rentable phone**.
- Two confirmed BTS bookings occupy `PHONE-001` and `PHONE-002` on Dec05; two confirmed William Est bookings occupy those same phones on Dec06. No BUS booking exists in those two daily allocations.
- BTS Dec03/Dec05 `08_Web_Ready` STILL falsely reports `show/เปิดจอง` at zero phones and one lens; P0 #831 remains DRAFT and **has zero independent PR review submissions** as of the current read, despite earlier CI green.

### New preflight contract
`preflightBusWaitlist(snapshot, releaseGates)` reads a snapshot in the repo's existing named-object convention (`events`, `bookings`, `visibility_locks`, `web_ready`, `web_packages`), and rejects:
- missing or duplicate BUS event IDs, changed official poster file ID, unexpected status, stale/altered web baseline;
- owner tombstone missing/not LOCKED as expected, or owner-reopen guard not accepting exactly this explicit intent;
- booking list not confirming **both exact physical phones booked on the corresponding calendar day** by another event, extra bookings or unrecognized phone IDs;
- any visible/available fresh-phone package, or incomplete relevant package records;
- missing independent release proofs for actual deployed P0, GAS identity, authenticated owner Admin, LINE customer waitlist E2E, poster visual readback, full Core/Package readback and production release authorization.

Only with *all* independent gates passed does it return **two prospective Admin `updateEvent` payloads**:
```json
[
  {"action":"updateEvent","payload":{"event_id":"EVT-20261205-HAPPY-BUSDAY-1-2-3","active_on_web":true,"visibility_owner_intent":"explicit_owner_reopen"}},
  {"action":"updateEvent","payload":{"event_id":"EVT-20261206-HAPPY-BUSDAY-1-2-3","active_on_web":true,"visibility_owner_intent":"explicit_owner_reopen"}}
]
```
These are **proposals** only, not connector calls. `production_writes=0` and `safe_to_execute_by_this_function=false` remain invariant. A separately authenticated governed owner Admin executor must re-read date-wide bookings and lock state immediately before each actual update, then verify `REOPENED` lock history, both `08_Web_Ready` as `show_full/เต็มแล้ว`, all six relevant packages hidden, real LINE waitlist URL, and actual storefront rendering. This exact-row two-action contract avoids creating duplicate BUS records, altering package prices, or reopening other owner-locked events.

### New official and photography-rights evidence
- GMMTV official announcement `https://www.gmm-tv.com/news/4485` confirms 11–25 December, 17 advertised regular performances, casts, and venue; ThaiTicketMajor `https://www.thaiticketmajor.com/performance/the-love-of-siam-the-musical.html` indexes the separate Gala on Dec09. Official advertiser social description `https://imginn.com/p/De1CHAcsFEV/` also notes Gala available Balcony only.
- The secondary guide `https://taomeoticket.com/en/guides/ve-the-love-of-siam-the-musical-2026` explicitly states **photography, video and live streaming are prohibited during the performance**, permitted for curtain calls only. This is NOT a verified organizer/venue policy document; treat as `THEATRE_FILMING_PROHIBITION_SECONDARY_REQUIRES_OFFICIAL_CONFIRMATION`. Do not advertise shooting the show, 200mm lens access or rentable filming capability without exact official confirmation. Avoid misleading pricing for a non-filmable event.
- A fan-made `https://theloveofsiamthemusical.channorn.com/` site explicitly says its GMMTV visual rights are **noncommercial fan use only**; **do not upload/reuse fan site's image as rental-business poster**. Use a validated organizer-controlled exact 2026 poster asset with applicable rights, not a 2025 press-event photo.
- The old candidate matrix sums 17 including Gala, while organizer describes 17 main performances PLUS separate Gala. This discrepancy remains explicitly UNRESOLVED, and only exact TTM performance dates/sessions may be put into commercial production.

### Status
**Owner BUS preflight code prepared; source-only CI required; NO production writes.** Do not confuse an accepted preflight proposal with the real visibility transition, poster upload or storefront readback. Merge/Deploy/Production remain RELEASE HOLD until every existing safety gate passes.
