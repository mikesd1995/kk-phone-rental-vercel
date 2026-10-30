# KK Phone Rental — December 2026 Ultra Deep recall repair / handoff
Date recorded: 2026-10-31 (Asia/Bangkok)
Status: **CODE_STAGED_ONLY / NOT_FULL_ACCEPTED / NO_PRODUCTION_WRITES**
Owner scope: December 2026, Bangkok region, concert/fancon/BL/GL/K-pop/T-pop and brand × mall × lucky-fan as well as smaller public creator community events.

## Read-only cross-check at time of report
- Backend Sheet (canonical): https://docs.google.com/spreadsheets/d/12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU/edit
- Event Tracker (scanner): https://docs.google.com/spreadsheets/d/1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo/edit
- Backend `01_Events`: 61 December event-days (21 active_on_web TRUE; 40 FALSE).
- `00_Master_Booking`: 13 December rows, 12 active holds (confirmed/pending/prepared/picked_up), 1 cancelled. Date-wide shared inventory: exactly 2 X300 Pro phones in known asset pool; do not infer per-event independent availability.
- Active booking counts per YYYYMMDD: 20261203=2; 20261205=2; 20261206=2; 20261207=1; 20261218=2; 20261219=1; 20261220=2.
- `18_Event_Visibility_Locks`: 35 December-related registry rows, with explicit LOCKED entries for booked collision days and owner-hidden events, including owner-exclusive JASP.ER on Dec 18–20 and CosHaru owner-hide. *SEEN_CORE* is historical registry state, not an owner hide; inspect lock_state per identity before a future write.
- Prior `UDS_20261028_Dec_Rerun` **already contained** Gulf Club Dec 5–6, PP Krit Dec 19–20, Merrez'ca Dec16, and Hada Labo Dec25 with hold/reject decisions. Do NOT misrepresent these as newly discovered or automatically publish them.
- The five named missing events below (six event-days because Illust Fusion is two days) were absent from the 61 live Core rows and not listed in `UDS_20261028_Dec_Rerun` when checked. This is a **recall miss**, not proof they meet publish/booking eligibility.

## Six independently found December event-days — discovery-only
| Date (BKK) | Event / venue | Public evidence checked | Source quality | Booking and release decision |
| --- | --- | --- | --- | --- |
| 2026-12-06 | MEDIHEAL Always Heals You with Jimmy–Sea, Siam Square Block I | https://www.sotwe.com/mediheal_th | MEDIHEAL official-account text via third-party index; verify direct post, registration/benefit rules, lens/camera rights | 2/2 phones date-wide booked. **HOLD_BOOKED_FULL**, no public card |
| 2026-12-09 | M Card M Universe Day Meet & Greet with TeeTee–Por, Sphere Gallery M Floor EMSPHERE | https://www.mcardmall.com/en/promotions/8260 and https://www.mcardmall.com/en/promotions/8188 | Official M Card terms: 20 Top Spenders + 200 Lucky Fans; event December 9, registration / confirmation dates differ | 0 December 9 active bookings found; **HOLD_CAMERA_RIGHTS_AND_RENTAL_FIT**. No customer phone filming rights inferred from organizer photos |
| 2026-12-12 | Illust Fusion EXPO WINTER 2026 D1, Paragon Hall | https://if.enterdock.com/infoexpo/ | Official organizer: Sat 12 Dec, 10:00–20:00 | **HOLD_RENTAL_DEMAND_AND_ORIGINAL_CAMERA_POLICY**. Illustration fair is not automatically a phone-fancam demand |
| 2026-12-13 | Illust Fusion EXPO WINTER 2026 D2, Paragon Hall | https://if.enterdock.com/infoexpo/ | Same official organizer: Sun 13 Dec, 10:00–20:00 | **HOLD_RENTAL_DEMAND_AND_ORIGINAL_CAMERA_POLICY**, separate event-day |
| 2026-12-19 | Nine 2026 '9° Moment' Tour Concert Bangkok Special, SiamPic Hall | https://event.thaiticketmajor.com/search/ | Original ticketing index; date/venue confirmed, new ticket on-sale Nov 4 (reconfirm seller detail) | Dec 19 JASP.ER confirmed booking 1/2 **and owner-exclusive policy**. **HOLD_OWNER_EXCLUSIVE_JASPER**, never auto create |
| 2026-12-27 | 2026 K-POP Chronicle Live: SUHO Fan-Con in Bangkok, Fashion Island Island Hall | https://mgronline.com/entertainment/detail/9690000104251 and https://www.scenensound.com/?p=22637 | Dated press reports, Dec27 event, organizer Kpspringent, sale on Ticketmelon Nov 7; final direct promoter / Ticketmelon event-detail to be checked | No active Dec 27 booking in latest read; shares 2 phones with existing visible events Dec 27. **HOLD_OFFICIAL_ORIGINAL_CAMERA_RIGHTS_PRICE_AND_OWNER_CHECK** |

### Crucial constraints
- No December Core event was created from these six rows. Event Tracker `_Candidate_Queue` / `_Miss_Learning` / `_Run_Coverage` / `_Run_Manifest` not updated by this branch. The table above is the handoff evidence, **not runtime scanner receipts or a provider-complete sweep**.
- No exact-event independent three-seller vivo X300 Pro/telephoto peer median obtained for these newly found events; do not claim prices are verified or turn ticket prices into rental prices.
- Never publish MEDIHEAL or Gulf Dec6 because it overlaps two confirmed WILLIAM EST rentals; never republish owner-hidden items; never bypass Dec18–20 Jasper exclusivity.
- No inferred permissions for filming / attachable telephoto lens. Phone-only permission and removable-lens permission are separate.

## Root cause proven in source code
The `SourceRegistry.buildUniversePlan()` generated multiple query variants per named source, but `server/kk-monthly-deep-scan-query-plan.js` `build()` copied only `query`, `providers`, `source_id` to the actual `gap_tasks`. **Named-source Thai, English, and bounded fallback variants were silently discarded before provider execution.** This reduces real recall even when source registration looks complete.

## Staged fix on `fix/uds-dec-luckyfan-recall-20261031`
1. Inherits prior staging branch `fix/uds-nov-mall-artist-recall-20261030`: required M Card / The Mall Christmas lighting source families and 6 Nov 2026 known-miss fixture. This does not imply the prior fix was deployed.
2. `server/kk-ultra-deep-source-registry.js` V10: four additional mandatory named-source families: M Card cross-month lucky fan, MEDIHEAL official campaign social, TTM newly announced Asian fancons, Illust Fusion official calendar. Queries are reusable across months and do not rely only on the six examples.
3. `server/kk-monthly-deep-scan-query-plan.js` V12: pass `task.query_variants` unchanged into monthly `gap_tasks`; no writer/deployment logic changed.
4. `server/kk-ultra-deep-known-miss-regression.js` V14: six dated December cases. Cross-month November probes help catch December events before event day; fixture evidence remains **synthetic regression data**, not live provider proof.
5. Tests for date-specific independent recall (Illust D1 not D2), missing source, wrong date, mandatory source receipt and preserved fallback queries.

## Safety gates / next steps
- **Gate 1 — code**: exact HEAD Node regression: `node --test tests/kk-ultra-deep-source-registry.test.js tests/kk-monthly-deep-scan-query-plan.test.js tests/kk-ultra-deep-known-miss-regression.test.js tests/kk-full-discovery-worker.test.js`. CI must report conclusive pass for exact PR HEAD; draft PR is not approval.
- **Gate 2 — live provider**: run `2026-12` Ultra Deep, show per-source `source_id`, actual search terms executed, provider attempts, collected canonical event URLs, result time, blockers. Do not report FULL simply because one class-level query returned "no evidence". `known_miss_live_recall`, independent references, source-universe proof and reconciliation must be complete.
- **Gate 3 — market**: for each qualified candidate, verify actual photo/lens rules, fan benefit rights, 3 independent exact-event rental sellers if available, competitor sample age, and approved pricing fallback when no comparable seller; don't convert placeholders into median.
- **Gate 4 — operations**: check owner tombstones, same-day shared physical stock and booking holds, exact date & venue; never recreate hidden events or sell incompatible event-days. Final Verifier, governed Admin writer and storefront exact readback only after explicit gates.
- **Gate 5 — cross-chat continuity**: this file is the durable checkpoint; use exact branch / PR (after creation) and both Sheets links to resume. No auto-merge/deploy/write to production authorized by this document.

### No-claim boundary
This staged code does **not** prove a complete live Ultra Deep execution, fix a 100% recall rate, or activate December events in production. Require actual runtime receipts and exact public readback before making those statements.
