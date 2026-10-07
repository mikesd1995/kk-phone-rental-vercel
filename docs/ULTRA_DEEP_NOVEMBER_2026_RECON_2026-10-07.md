# November 2026 Ultra Deep reconciliation — 2026-10-07

## Scope

Owner-requested November 2026 Ultra Deep reconciliation for KK Phone Rental.

Hard rules applied:
- owner-hidden / closed / rejected / manually disabled event-date identities must never auto-reopen;
- suppressed events remain observable for official poster/date/time/venue/added-show/postponement/cancellation changes;
- active existing Core events remain eligible for verified metadata maintenance;
- multi-day identity and inventory are per date/show;
- new storefront publication remains gated by external demand, Verifier, pricing, poster, governed writer and exact readback;
- `production_writes=0` for this reconciliation;
- no paid provider top-up.

Run key: `CHATGPT-20261007-NOV-ULTRA-DEEP-RECON`.

## Current SOT reconciliation

Read from the live connected Google Sheets SOT:
- November `08_Web_Ready`: 104 date-rows at scan time.
- November `18_Event_Visibility_Locks`: 64 history/lock rows.
- Current November bookings were read from `00_Master_Booking` before candidate decisions.
- Owner lock reasons observed include `OWNER_RECLOSE_AFTER_RECON_2026-10-06`, `OWNER_DEMAND_PRUNE_2026-10-06`, and `OWNER_DO_NOT_AUTO_REOPEN_2026-10-07`.
- No owner-hidden event was authorized for automatic reopen in this run.

## Coverage gaps recovered

Two real November public events were absent from the current Candidate/Web surfaces and were added to Candidate Master Pool only:

1. **Morgan Jay: The Goofy Guy Tour — 21 Nov 2026 — KBank Siam Pic-Ganesha Theatre**
   - Morgan Jay official tour page and Megatix confirm Bangkok/date/venue and SOLD OUT.
   - Exact time is held because artist/Megatix show 19:00 while Midas promoter page shows 20:00.
   - Candidate state: BLOCKED/HOLD, no storefront write.

2. **Martín García García — The Poetry of the Piano — 29 Nov 2026 — Tongsuang's Concert Salon and Gallery, Pathum Thani**
   - Bangkok Chopin Society official page confirms masterclass 10:00 and recital 15:00.
   - Kept Candidate-only because external phone-rental/capture-intent evidence is insufficient.
   - Candidate state: WATCHING, no storefront write.

Candidate rows: `_Candidate_Queue!309:310`.

## Suppressed-event update observation

BIGBANG Bangkok is the concrete current example:
- owner-hidden/tombstoned storefront state remains hidden;
- YG official notice confirms the additional Bangkok show on **8 Nov 2026 at 19:00**, Rajamangala National Stadium;
- this update is recorded/reportable but does not authorize storefront visibility.

This is the intended semantic split:
`SUPPRESSION_PRESERVED=true` can coexist with `MATERIAL_UPDATE_DETECTED=true`.

## Code defect found

Before this patch, `server/kk-ultra-deep-production-runtime.js` had two relevant ordering/identity weaknesses:

1. historical reconciliation was primarily same-date based, so a LOCKED event that was officially rescheduled could potentially escape its tombstone as a new date;
2. `LOCKED/SEEN_CORE` history was handled before current-Core reconciliation, so an existing `SEEN_CORE` event could be terminally skipped instead of remaining eligible for verified metadata maintenance.

## Source hardening staged

Branch:
`fix/ultra-deep-suppression-observation-20261007`

Changes:
- add plausible reschedule-window matching for `LOCKED` history using strong event-title identity without requiring the venue/date to remain unchanged;
- keep LOCKED candidates out of `safe_candidates` and emit structured `observed_changes`;
- expose `suppressed_update_count` and `suppressed_observations` in runtime output;
- allow a current existing Core row with `SEEN_CORE` / `REOPENED` history to reconcile as existing instead of being treated as recreation;
- apply full-booking-date terminal skip only to new candidates after existing/history reconciliation;
- add regression tests for cross-date tombstone preservation, update observation, and existing SEEN_CORE reconciliation;
- update Scanner and Verifier skills with the suppression-vs-observation contract.

No merge or deployment was performed by this run.

## Competitor radar

Owner-tracked 10-account set was queried through currently accessible public/indexed surfaces.

Current/indexable evidence was recoverable for 8 accounts; 2 did not return usable current indexed evidence in this pass. Fresh exact-event signals included:
- NCT 127 — 1 Nov;
- NAMTAN FILM / MILK LOVE mid-Nov;
- K*Pop Masterz / ANNYEONG mid-Nov.

Examples:
- `by_minnymicky`: NCT 1 Nov X300 Pro + 200mm lens 1,090.
- `thisisyour3`: K*Pop Masterz X300 Pro 790 + lens 300; current mid-Nov bundle signals.
- `faleem_rent2`: current November NCT/NAMTAN FILM/JANJINGJING/MILK LOVE rental signals.

No KK auto-reprice was performed because exact-event freshness/independence thresholds and booking/owner price rules must still be satisfied event by event.

## Provider fallback

Exa semantic search returned HTTP 402 credit-limit failure.
Owner zero-cost policy was enforced:
- no top-up;
- provider failure recorded;
- scan continued using free public web, official sources, connected SOT and GitHub evidence.

## K*Pop Masterz date integrity

The Nov 15 row/booking is not a resurrection bug.
Current indexed organizer signal from `kpspringent` states:
- 14 Nov show sold out;
- **additional show added 15 Nov 2026** at Thunder Dome;
- additional-show ticket sale announced for 3 Oct 2026.

Therefore Nov 15 remains a legitimate separate show date.

## Persistent evidence written

Event Tracker:
- `_Candidate_Queue!309:310` — recovered Candidate gaps.
- `_Run_Coverage!4520:4528` — current source/provider/competitor/code receipts.
- `_Audit_Log!345:350` — suppression guard, candidate gaps, BIGBANG hidden update, competitor refresh and provider fallback.
- `_Run_Manifest!5214` — current manual read-only reconciliation manifest.

## Remaining acceptance gates

The scan/reconciliation work itself is recorded, but source code is not production-accepted until:
1. branch tests/checks pass;
2. PR review confirms no regression;
3. existing production acceptance/deployment gate is READY;
4. a controlled read-only runtime proves the new dispositions with `production_writes=0`;
5. only after those gates may merge/deploy be considered.

Do not bypass these gates and do not auto-run a production write workflow from this document.
