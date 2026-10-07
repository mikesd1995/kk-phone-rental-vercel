# October 2026 External-Demand Reconciliation — 2026-10-07

> **CURRENT TRUTH CORRECTION — 2026-10-07 02:11 +07**  
> The earlier 50-card result is superseded by the owner-locked active-booking-day rule. Current 7–31 Oct storefront = **45 visible cards: 42 show / 3 show_full**. On 24 Oct, **LYKN REFLEXION CONCERT is the only visible event** because booking BK-20261024-001 is confirmed. Spare inventory does not permit other events that date.

## Scope

Owner requested a fresh October storefront scan after locking the new fandom-first / external-demand policy.

Window applied: **7–31 October 2026**.
Initial production-visible cards in this window: **42**.

The run used:
- organizer/ticketing/venue/fandom discovery;
- competitor phone-rental radar;
- owner visibility history;
- active booking/capacity protection;
- external-demand qualification;
- exact Sheet derived readback;
- production `/api/kk-data` readback.

KK bookings/revenue/inquiries/waitlists were **not used as score inputs**.

## Result

Final production-visible cards (7–31 Oct): **50**
- `show`: 47
- `show_full`: 3

Net storefront diff from start of this rerun: **+8**
- **1 new external-demand-qualified event**
- **4 durable owner-reopen restorations**
- **3 non-LOCKED hidden events reactivated by external demand**
- **0 additional removals in this rerun**

The previous external-demand prune remains in force; previously removed low-demand events stay hidden/LOCKED and were not reopened. Love On Hire — Blessing Ceremony remains explicitly retained.

## Added new event

### FAYE PERAYA BIRTHDAY PARTY 2026 "1410 STATIC"
- event_id: `EVT-20261024-FAYE-PERAYA-1410-STATIC`
- date: 24/10/2026
- venue: ICONSIAM HALL
- external-demand decision: PRIORITY (~77)
- evidence: Fabel/ThaiTicketMajor/Hoshi; premium ticket tiers up to THB 35,000; after-party sold out; exact phone-rental market listing; high fandom/photo intent
- capacity: 1 phone available on 24 Oct
- price: phone 890 / bundle 1,090 / lens-only hidden
- exact derived readback: `show`, phone=1, lens=1
- production readback: HTTP 200, event found, `show`, all 3 package rows present

## Owner-intent restorations

These rows already had durable `REOPENED` history from the owner's earlier explicit reopen but Core had drifted back to `active_on_web=false`. Reconciliation restored the stored owner intent:

1. `EVT-20261024-TEEHENG-GEN-OF-US-1ST-FANMEETING`
2. `EVT-20261024-OMEGA-X-BEYOND-BANGKOK`
3. `EVT-20261024-GUN-NAPAT-BIRTHDAY-EVENT`
4. `EVT-20261024-TOP-PRE-STUDIO-2026-BANGKOK`

All four now read back `show`, with one phone available. This restoration is not a score override; it repairs visibility drift against durable owner history.

## External-demand reactivations

### LINGORM THE WORLD BETWEEN US CONCERT — 18 Oct
- event_id: `EVT-20261018-LINGORM-THE-WORLD-BETWEEN-US`
- external score used: ~97
- evidence: sold-out demand plus multiple independent rental listings, including vivo X300 Pro / lens offers
- prior state: hidden, `SEEN_CORE`, not owner LOCKED
- capacity: 1 phone available
- result: `show`
- price readback: 890 / 1,090; lens-only hidden

### GMMTV FANIVAL 2026 : Happy Family — 7 Oct
- event_id: `EVT-20261007-GMMTV-FANIVAL-2026-HAPPY-FAM`
- external score used: ~84
- evidence: competitor rental listings for FANIVAL 1–13 Oct; dense GMMTV fandom/fansign schedule; high photo intent
- prior state: hidden, `SEEN_CORE`, not owner LOCKED
- capacity: 1 phone available
- result: `show`
- price readback: 490 / 590; lens-only hidden

### Avenged Sevenfold Asia Tour 2026 in Bangkok — 7 Oct
- event_id: `EVT-20261007-AVENGED-SEVENFOLD-ASIA-TOUR`
- external score used: ~79
- evidence: direct competitor phone-rental listings for 6–7 Oct including vivo X300-family inventory
- prior state: hidden, `SEEN_CORE`, not owner LOCKED
- capacity: 1 phone available
- result: `show`
- price readback: 890 / 1,090; lens-only hidden

## Hidden candidates reviewed but not reactivated

Examples:
- MindaRyn 1st Asia Tour "Calling Back"
- BOY SOMPOB WORLD Y TOUR LIVE IN BANGKOK
- MYYU’s Birthday Celebration
- ONE OR EIGHT Special SHOW CASE 2026 in ASIA -V8- BANGKOK
- WESPARK MEET&LOVE BAILU SPECIAL FANMEETING
- Jason Mraz Live In Bangkok 2026
- Interstellar Live
- J-Rockaholic PARTY 2026

These either lacked enough exact rental-market evidence to clear >=60 conservatively, sat in WATCH/VERIFY_MORE territory, or had lower phone-capture value. They remain discoverable/canonical but are not auto-reactivated.

## Owner LOCKED examples deliberately preserved

Demand score never overrode these locks:
- Tiffany Young: Edge of Calm Tour in Bangkok
- ONG SEONGWU FANMEETING
- NuNew 2nd Concert
- LEO SCREAM FEST 24 Oct
- NEXORA 24 Oct
- LANDOKMAI 24 Oct
- DICE 24 Oct
- GMMTV FANIVAL 11 Oct
- ZeePruk 11 Oct
- historical demand-prune tombstones

## Full-date/no-capacity examples

31 Oct remains phone-full because NCT 127 has two active phone bookings. Other 31 Oct candidates stay hidden regardless of demand unless capacity changes and owner locks permit.

8 Oct is also phone-full; hidden alternatives remain hidden.

## Discovery observations

The rerun confirmed that fandom **sub-events** (e.g. artist/fansign slots inside GMMTV FANIVAL) can carry stronger rental intent than the generic parent event. New rule: same-date/same-venue/same-admission child slots strengthen parent external-demand evidence instead of creating duplicate cards.

October scan also surfaced ticketing candidates such as TAKASE TOYA and Ai Higuchi on 23 Oct, but that date has no phone capacity; they are not storefront additions.

## Production verification

Production API:
- `08_Web_Ready A4:K` => HTTP 200
- `09_Web_Packages A4:L` => HTTP 200
- source header remains `public-gviz-fallback`
- private reader remains unconfigured

All 8 changed/reconciled event IDs were found in production as `show`; each has 3 package rows in the production packages feed.

No deployment was performed.

## Code/policy work

Draft PR #650 now additionally includes:
- existing-storefront requalification;
- monthly add/remove diff report;
- hidden non-LOCKED event reactivation gate;
- durable REOPENED owner-intent restoration;
- parent/child fandom sub-event aggregation;
- governed visibility mutation mapping;
- regression-test coverage for these rules.

GitHub Actions acceptance remains blocked by infrastructure: exact-head jobs return no steps and BlobNotFound. This is not a passing test result and not a proven assertion failure. PR stays draft; no merge/deploy.

## Next recurring behavior

When owner says "สแกนเดือน X ใหม่":
1. broad discovery + fandom graph;
2. external-demand score new candidates;
3. re-score existing visible cards;
4. remove <45 only when unprotected and owner monthly apply is active;
5. WATCH 45–59.9 existing cards remain visible;
6. re-evaluate hidden non-LOCKED cards and reactivate only at >=60 with phone capacity;
7. durable REOPENED owner intent is restored if Core drifts false;
8. LOCKED owner tombstones never reopen;
9. output exact ADDED/REMOVED/REACTIVATED/RESTORED/KEPT/WATCH/PROTECTED report;
10. exact derived + production readback.

## Durable owner-keep exception

`EVT-20261014-LOVE-ON-HIRE-BLESSING` now has a persistent visibility-history row with reason `OWNER_KEEP_DEMAND_PRUNE_EXCEPTION_2026-10-07`, changed_by `OWNER_COMMAND`. This is not a hide lock; it is a durable owner keep instruction. Current derived readback remains `show` with phone=2/lens=2.

## Correction — 24 Oct booking-day exclusivity

The earlier reconciliation incorrectly treated spare inventory on 24 Oct as permission to expose other events. Owner clarified that **any active booking blocks all other events on the same date**, even when one phone remains.

Canonical booking evidence: `BK-20261024-001`, `confirmed`, `EVT-20261024-LYKN-REFLEXION-CONCERT`.

Corrections applied:
- LYKN REFLEXION CONCERT remains the booked/customer-facing event.
- TEEHENG GEN OF US 1st FANMEETING => hidden.
- OMEGA X [BEYOND] Bangkok => hidden.
- GUN NAPAT Birthday Event => hidden.
- T.O.P PRE-STUDIO 2026 in Bangkok => hidden.
- FAYE PERAYA Birthday Party remains Candidate/SEEN_CORE only and hidden.

The four prior `REOPENED` histories are retained as history, but active-booking-day exclusion has higher runtime precedence while LYKN remains active. The earlier +8 storefront result must not be used as current truth without this correction.
