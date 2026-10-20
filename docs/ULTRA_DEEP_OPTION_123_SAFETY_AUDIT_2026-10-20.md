# KK Phone Rental — options 1/2/3 independent safety audit, free-source probe and candidate disposition
**20 October 2026 ICT.** Owner requested options 1/2/3 with **ZERO production/booking/price/rights/automation writes, no merge/deploy, no paid providers**. This document is audit evidence only.

## 0. Baseline / exact branch chain
- main SHA: `a54a348dd3258d87b1ec0c70e6ffd255d4678018`
- Draft PR [#769](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/769) `9b982949834c7aad8a5f299fc12db3b0a896cad2` (HOWE)
- Draft PR [#772](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/772) `946e28c658e211ebaec8898dc0d47094b877f974` (ticketed fandom)
- Draft PR [#774](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/774) `ff3f0f7d25e2a219e03337d1a093fd046697e337` (FirstOne/gallery/mall).
- New stacked draft `audit/ultradeep-safety-acceptance-20261020`. Existing #774 exact-head CI [39359906964](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/39359906964) source-only passed 7/7 + 43/43 + 370/370 + 55/55. **No Production release or independent human review inferred.**

## 1. Static code review — actual defects and repairs on new draft
Review source/discrete diffs of #769, #772, #774 plus read-through `server/kk-ultra-deep-production-runtime.js`, `server/kk-ultra-deep-v2-runtime-adapter.js`, `server/kk-ultra-deep-v2-governed-writer.js`, `server/kk-ultra-deep-full-loop-v2-policy.js`, `server/kk-ultra-deep-source-registry.js`, `server/kk-monthly-deep-scan-query-plan.js`, `server/kk-governed-storefront-executor.js`, `server/kk-verifier-storefront-promotion.js` and related tests.

### Confirmed code defects, isolated safe repairs
1. **Critical source fallback lost:** full `kk-monthly-deep-scan-query-plan.build()` added `source_universe.tasks` but dropped `task.query_variants`. New source-specific Thai/DMD gallery searches could be constructed but never dispatched. Pass exact `query_variants` through to provider task; regression checks for Oct, Nov, Dec.
2. **Invalid search scope:** official X accounts stored as `domain:'x.com/DMDMusicTH'`, yielding `site:x.com/DMDMusicTH`, which is not a valid host-only search scope for some search providers. Use `site:x.com` and explicit @handle in query instead.
3. **Critical V2 booking-date bypass:** Production `reconcileCandidates()` blocks a new event if any active booking occupies that date, while V2 normalized availability using remaining 2-phone capacity; if 1 phone booked, a new offer could still pass score. New V2 gate carries `SKIPPED_ACTIVE_BOOKING_DATE` with zero creates even at maximum external demand; normal existing canonical maintenance remains separate.
4. **Critical same-title different-day false identity:** `matchForV2` treated exact name on a different date as a canonical event date move automatically. Distinct multi-day show/fansign dates can overwrite the earlier occurrence. Require explicit `existing_event_id/canonical_event_id` AND `date_change_verified:true`; otherwise different date is independent identity and subject to normal new-event verification.
5. **Owner historic suppression bypass:** V2 new event route did not consult `snapshot.visibility_locks`; it could score a previously LOCKED/SEEN_CORE candidate again. Use `Production.historicalConflict` and source hold flags to block new proposal before policy.
6. **Unconditional event proof:** V2 set `exact_event_verified:true` even if no official event proof. Now must have independently supplied `exact_event_verified:true` AND `official_event_source_verified:true` before create policy sees the event as verified. Producer still needs trusted provenance verification; flags alone are not evidence!
7. **Unapproved fallback price:** V2 handed an available `proposal.proposed_reference_price` to create policy as governed even if not explicitly owner-approved. Require `proposal.owner_price_approved:true` for fallback; **competitor raw price** still requires independent rental evidence/policy owner review.
8. **Writer authority:** V2 writer `execute({executeWrites:true})` and `executeCreate()` previously did not require independently passed approval input; now both require `options.owner_approved===true && options.production_acceptance_verified===true` before calling network. This is an added defence, NOT final production assurance—must also enforce admin/owner authorization and prevent spoofed flags at the platform boundary.
9. **Free-provider constraint:** automatic query plans listed `EXA` fallback. Removed it from those two discovery plan manifests; this change alone does NOT prove that every other runtime provider costs zero. No external paid API was called here.

### Explicit unresolved review blockers
- Reviewer independent of author, full-stack diff and owner signoff **not obtained**.
- Production pipeline may use other provider manifests and writer paths; zero-paid/full coverage needs independent environment-level acceptance.
- `server/kk-ultra-deep-full-loop-v2-policy.js` can propose price/visibility modifications based solely on model/market flags. End-to-end trusted owner authorization, current-booking lock and immutable price approval **must be verified at actual Admin writer boundary**, not just client flags; do not release to production until verified.
- Draft fixes lack live read-only runtime execution receipts; passing GitHub tests is a **unit/integration source contract**, not runtime acceptance.

## 2. Manual free-web, unseeded search probe: not the KK scanner

### Search protocol
Ran **generic** public web discovery without providing names of known misses such as HOWE, FirstOne, AuAuSave, Scarlet, etc. Search lanes: official agency/venues/ticketing, Bangkok Oct20–31/Nov/Dec 2026 fan events, mall activity and artist calendars. Public sources are not paid. Following generic results, separately performed **targeted identity/right validation**. Some official pages returned 403; search index snippets may still surface titles, but not camera rules. All source pages below are **read-only retrieval**. No KK scan endpoint, cloud machine or provider executor was invoked.

### Source receipts / results
| Lane | Source | Unseeded result(s) | Evidence level / disposition |
|---|---|---|---|
| Eventpop published concert directory | https://www.eventpop.me/g/concert | Dec27 BOSSNOEUL crossover; Dec4 Paradox film concert; Nov14 BNK48/CGM48; Nov29 FORTREASURE; Nov21 live concerts | **Official ticket catalogue**, individual event/date result. Cross-check Core, booking and rights before posting. |
| Eventpop direct event details (follow-up on discovered catalogue result) | https://www.eventpop.me/e/177073/bossnoeul-crossover-concert | Dec27 17:00–19:00 ICONSIAM HALL, organiser FREEZE ME, ticket sales 17 Oct | Original source explicitly allows cameras with no lens-length restriction. No livestream. Benefit photos chest-height only; selfie sticks and >7in tablets forbidden. **Do not infer detachable mobile add-on lens fully approved without resolving exact rules and permitted use case.** No independently established KK competitor rental rate; HOLD pricing/asset authority. |
| ThaiTicketMajor generic recent/catalogue | https://event.thaiticketmajor.com/search/ | Oct30 Lovers & Gangsters, Nov18 ROAD TO THE GRIM LOVER, Nov4 Scarlet premiere listings | **Primary ticketing**, official date/source validation; no exact event phone/telephoto rule in these catalogue snippets. |
| GMMTV generic news | https://www.gmm-tv.com/news/4492/ | Oct30 `หงเสนคลุกฝุ่น : The Legend Begins` 20:00 at Union Hall F6, Force/Book and Great/Bright | **Primary organizer**, real in-person fan first-episode + actors + special stage; camera/telephoto rule not established. Public ticket 2500/2000/990/790 is admission, NOT KK rental comps. |
| Independent BL/GL calendar | https://www.natgan.com/?month=2026-11 | Oct15–Nov8 ANWYLL × SHANERLER popup, Nov7 Shine Bangkok Fansign, other dated fan events | **Secondary source only**; no proof that actor attends each gallery day. Cannot promote on secondary calendar. |
| Independent October calendar | https://www.natgan.com/?month=2026-10 | Oct22 Love on Hire First EP / Siam Pavalai, other date-specific events | **Secondary lead**, official event/photography evidence pending. |
| Direct ticket event (follow-up after calendar) | https://m.thaiticketmajor.com/concert/shine-bangkok-fansign-one-last-light.html?lang=en | Nov7 Shine Bangkok Fansign | Search result gives date but open returned **403 Forbidden**. Native Core `08_Web_Ready` already has **SHINE 7 Nov HIDE**, and Candidate row 128 exists. Never re-open. |
| Mall original and private fan pages | Dedicated official mall/organizer searches | Incomplete/zero independently validated original post receipts for FirstOne, AuAuSave, Khom Khlang; some sources blocked or not indexed | **SOURCE_GAP**, do not claim machine recall. User screenshots remain manual proof of displayed poster dates, not official phone-lens/artist attendance and creator-use rights. |

### Honest metrics
- Generic manual search found several date-specific official/secondary leads; exact distinct new KK opportunities **not accepted**.
- This manual external web search is **NOT** the production runtime or a controlled unseeded provider scan with instrumentation. Thus no measured scan recall, zero/unknown source coverage receipts, no reliable false-positive percentage and **no FULL_ACCEPTANCE claim**.

## 3. Business candidates / disposition from latest native Google Sheets

Canonical backend `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`: `00_Master_Booking!A4:V650` returned 69 populated/near-header rows; `01_Events!A4:I650` 348; `08_Web_Ready!A4:K650` 349; `18_Event_Visibility_Locks!A1:N600` 281. Tracker `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`: `_Candidate_Queue!A1:P900` 368. These are **bounded readbacks**, not a copy of customer personal data.

Active Booking seen: **Oct23 LYKN 2, Oct24 LYKN 1, Oct31 NCT 2, Nov1 NCT 2**; Oct25 cancelled LYKN excluded. (Prior scan found booked Nov7/8, Nov13–15, Nov21–22, Nov28 and Dec3/5/6/7/18–20; must RECHECK complete registers at mutation time.)

| Date | Candidate | Booking in latest bounded register | Canonical status / proof | Decision (no writes) |
|---|---|---|---|---|
| Oct19 | FirstOne 8/7 single showcase | 0 previously verified | user agenda, missed candidate | HISTORICAL, no retroactive sale. |
| Oct20 | HOWE awards / BITEC | 0 in latest register | Candidate 323 VERIFIED_HOLD | HOLD photo, red-carpet zone and phone lens. |
| Oct22 | Love on Hire First EP | 0 in latest register | Only previous Oct14 **Blessing Ceremony** in Core (different event) | LEAD; verify original organizer and rules. |
| Oct29–30 | Khom Khlang Siam Center exhibition | 0 each | different from previous Siam Halloween PMCU and special episode | HOLD artist attendance, customer demand, camera/creator proof. |
| Oct30 | Lovers & Gangsters: The Legend Begins | 0 | GMMTV source confirmed; Core missing exact event | P0 READY_FOR_VERIFIER, no approved rent price/camera policy. |
| Oct31, Nov1 | Other events AuAuSave/Khom Khlang | **2/2 active each day** | owner-exclusive days, preserve NCT | SKIP NEW OFFERS. |
| Nov2 | AuAuSave fan gallery day 2 | 0 | owner artwork and social leads | HOLD: artist not verified on-site, actual rental demand + camera/use policy missing. |
| Nov4 | Scarlet Heart Thailand Grand Premiere | 0 | TTM confirmed separate offline event; original user image is TV-series key visual | P0 READY_FOR_VERIFIER, need authorized event poster/rules/comps. |
| Nov7 | Shine Bangkok Fansign | prior active booking; latest Core shown hidden | Core exists **HIDE**, Candidate exists; TTM 403 direct | **NO REOPEN**; not a new discovery. |
| Nov18 | ROAD TO THE GRIM LOVER FANSIGN | 0 | TTM confirms; Core missing exact event | P0 READY_FOR_VERIFIER, rights/market poster/rental price missing. |
| Dec4 | Paradox Film Live Concert | no booking in prior register | direct Eventpop listing | P2 HOLD, film recording rules and rental fit. |
| Dec27 | BossNoeul Crossover | no booking in prior register | Eventpop direct rules; distinct Dec26 existing BossNoeul fansign | **P0** CAMERA_EVIDENCE_PARTIAL / PRICE_COMPS_PENDING; no business write. |

**Promotion needs:** verify original copyright/authorized poster, exact show-date and venue, distinct canonical ID and owner-hold history, camera + mounted detachable external lens rights, artist access for non-stage gallery, fresh correct-day active booking count, independent competitor phone-only/add-on prices or owner-approved fallback, commercial score and final approval. Never use admission tickets as rental prices. `08_Web_Ready` / `09_Web_Packages` are generated: NEVER edit directly.

## 4. Regression and CI
New draft includes `tests/kk-ultra-deep-audit-safety.test.js`: highest external demand but a partial booked day cannot be a new sellable V2 offer; cancelled bookings handled separately; locked-owner history; official-source and approved price provenance; independent multi-day same-title identities; source query variants retained; X site-scope valid; no EXA fallback; V2 writer requires explicit owner and production acceptance for any network write.

**Exact-head GitHub Actions result:** must be attached in PR audit comment after CI; do not reuse ancestor green as proof for this head.

## 5. Cross-chat next actions
1. Recheck current PR base/head after all commits, run exact-head zero-install Node CI and independent code review. If red, revise draft only.
2. Run actual controlled **read-only** scan on an available approved execution environment with connector/provider receipts and costs proven 0. Avoid hardcoding known misses in probes; separately evaluate baseline known-case detection after run. Produce missed/duplicate/HOLD terminal identities with source timestamps.
3. Complete each P0 legal camera/lens/asset/competition/pricing verifier; never fabricate unsupported clearance. Get owner approval, then govern writer **only after all safety gates** and exact Production storefront readback, no automation/booking change.
4. If no independent original evidence, file explicit blocker and retain HOLD. No pending task itself is proof of business release.

## Rollback guarantee
Isolated Draft PR only. Previous branches/PRs left unchanged; no GitHub merge, no Vercel deploy, no sheet writes, no owner booking/price changes, no scheduled tasks and no paid search provider used by this audit.