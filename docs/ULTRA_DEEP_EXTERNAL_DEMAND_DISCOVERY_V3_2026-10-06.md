# Ultra Deep External Demand + Fandom Discovery V3 — 2026-10-06

## Owner decision

KK Phone Rental discovery must optimize for **phone-rental opportunity**, not generic event coverage.

Broad discovery is still recall-first, but a newly discovered event is never storefront-worthy merely because it is real, ticketed, current, or visually attractive.

## Permanent pipeline

```text
Broad Discovery
  -> Organizer / Ticketing / Venue / Artist-Agency
  -> Fandom Graph Expansion
  -> Competitor Rental Radar
  -> Rental Keyword Search
  -> Brand / Mall / Fansign / Special-event Sweep
  -> Added-show / Sold-out / Date-Venue Change Detection
  -> Deduplicate + Visibility History
  -> Candidate Master Pool
  -> Exact-event Verifier
  -> Booking/Capacity Gate
  -> Owner Visibility Lock
  -> External Demand Score
  -> Price + Poster
  -> Governed Publish
  -> Derived Readback
  -> Production Readback
```

## Discovery coverage matrix

A monthly/full scan cannot claim COMPLETE unless it has executed evidence/receipts for:

1. official organizers/promoters;
2. ticketing platforms;
3. venues;
4. artist/agency schedules;
5. fandom/community signals;
6. public social/X signals;
7. competitor rental listings / rental-keyword radar;
8. brand/sponsor/mall activations;
9. fanmeeting/fancon/fansign/birthday/final-EP/premiere/blessing/lucky-fan/meet-and-greet/sport/special-stage formats;
10. public event calendars;
11. added-show / sold-out / postponement / cancellation / date / venue change detection.

Public calendars are a recall source, never final authority.

## Fandom Graph

A hot artist/pair/group/agency expands into adjacent identities and formats:

```text
pair
 -> member A
 -> member B
 -> agency / label
 -> fanmeeting / fancon / fansign
 -> birthday / final EP / premiere
 -> brand / mall appearance
 -> lucky fan / meet & greet / benefit
 -> added round / special stage
```

The graph affects discovery priority only.

## Competitor Rental Radar

Search exact artist/event/fandom names with rental-intent terms:

- เช่ามือถือ
- phone rental
- vivo / X300 Pro
- iPhone
- Samsung
- lens
- คิวหลุด / waitlist

Multiple independent competitor rental listings for an event absent from Candidate Master Pool => `DISCOVERY_MISS_HIGH_CONFIDENCE` and an official-source verification task.

Competitor pricing remains pricing evidence; competitor rental presence is also an external demand signal.

## External Demand Score — hard storefront gate

The score is **external-market only**. KK internal outcomes are forbidden score inputs.

| Signal | Weight |
| --- | ---: |
| competitor rental activity | 30 |
| public social engagement | 20 |
| ticket demand / sold-out / added rounds | 15 |
| fandom photo/capture intent | 15 |
| venue/stage capture value | 10 |
| historical external rental activity | 10 |
| **Total** | **100** |

Thresholds:

- **75–100** => PRIORITY; publish-eligible
- **60–74.9** => PUBLISH; publish-eligible
- **45–59.9** => WATCH; Candidate Master Pool only
- **<45** => REJECT from storefront
- insufficient external evidence => VERIFY_MORE; not publish-eligible

No commercial/competitor flag can bypass score >=60.

## KK internal outcome boundary

The following must never increase External Demand Score:

- KK booking count
- KK completed bookings
- KK revenue
- KK conversion
- KK inquiries
- KK waitlist / คิวหลุด
- KK full-stock state

They are useful **after the fact** as discovery-learning signals only.

Example:

```text
William/Est full + repeated waitlist inquiries
  != add score points to William/Est
  => raise discovery priority for William, Est, WilliamEst, GMMTV and adjacent brand/fandom events
```

This avoids self-reinforcing storefront bias while using real business feedback to reduce future misses.

## Capacity and owner locks

- full phone capacity on a date => new commercial events on that date are NO_CAPACITY;
- one phone booked / one phone available => other eligible events may still be offered;
- `18_Event_Visibility_Locks.LOCKED` with `explicit_reopen_required=TRUE` always wins;
- Scanner/Verifier may never automatically reopen an owner-hidden event.

## Candidate Master Pool

Discovery should be intentionally broader than storefront publication.

A discovered event can remain in Candidate Master Pool with:
- identity/date/venue;
- event type;
- artist/fandom/agency;
- organizer/ticket source;
- official/poster evidence;
- discovery source class;
- observed timestamp;
- change state;
- external demand evidence;
- decision: PRIORITY / PUBLISH / WATCH / REJECT / VERIFY_MORE.

WATCH/REJECT are not deleted from discovery history.

## Acceptance rules

A new event must not reach CREATE_EVENT unless:
1. exact event verification passes;
2. owner lock/history permits;
3. capacity permits;
4. at least the minimum external signal coverage exists;
5. External Demand Score >=60;
6. verified poster and safe governed price exist;
7. downstream exact readback is required.

`VERIFY_MORE` must never be treated as publish permission.

## Cross-chat rule

When the owner says **"สแกนหางานเพิ่มหน้าบ้าน"**, this document, the Discovery Scanner skill, Event Verifier skill and current V2/V3 code are the canonical interpretation. Do not revert to "event exists + rental-fit => publish".

## Safety

- Scanner production writes = 0.
- Verifier does not bypass owner locks.
- Governed writer remains the only write authority.
- No auto-merge, auto-deploy or paid provider/top-up is authorized by this policy.
