# KK Ultra Deep — Owner Core ↔ Tracker ↔ AI Learning reconciliation

**Scope:** Owner-confirmed PAÑPURI, 21 October 2026, Bangkok.  
**Run:** 2026-10-13 ICT, eight directly connected Google Sheets read-only surfaces.  
**Repository:** `mikesd1995/kk-phone-rental-vercel`, isolated Draft PR #720, Issue #719.  
**Disposition:** **STAGED_REVIEW_ONLY**, **0 Tracker Writes**, **0 Core Writes**, **0 Production Writes**. Do not deploy or silently complete.

## Authoritative reverse reconciliation (actual readback)

| Source | Scope / result |
|---|---|
| Backend `01_Events` | Exactly one `EVT-20261021-PANPURI-PHUTATCHAI-THAI-POPUP`, event date 21/10/2026, status open, active TRUE |
| Backend `08_Web_Ready` | Same ID, exact day, `action_for_web=show`, phone capacity shown 2 |
| Backend `09_Web_Packages` | Exactly three: phone-only **490**, lens-only **hidden**, phone+lens **590**; **no changes** |
| Backend `18_Event_Visibility_Locks` | Same ID, `SEEN_CORE`, `OWNER_EXPLICIT_ADD_2026-10-13`, owner image evidence; lock day encoded Sheets serial `46316` (=2026-10-21) |
| Backend `00_Master_Booking` | No exact event ID found in checked `A4:W500` range; never assert all possible channels globally have no booking |
| Tracker `_Candidate_Queue` | No canonical or equivalent title+date+venue lineage for event, checked `A1:AL2000` |
| Tracker `ต.ค. 2569` | No canonical monthly disposition for PAÑPURI; checked `A1:U1017` |
| Tracker `_Miss_Learning` | No owner-origin observation row; checked `A1:M2000` |

All eight complete readbacks were passed to **the actual new pure source implementation** of `OwnerCore.prepareFromSheets` in V8. Result: `STAGED_REVIEW_ONLY`, **3 missing Tracker surfaces**, **3 governed review proposals**, **0 identity conflicts**, **0 authorized writes**. This was not a synthetic fixture run. The full no-PII JSON result and exact row scopes are persisted in [ULTRA_DEEP_OWNER_CORE_PANPURI_STAGED_2026-10-13.json](./ULTRA_DEEP_OWNER_CORE_PANPURI_STAGED_2026-10-13.json).

### Authoritative provenance and why it matters

- The owner-provided poster and event data are recorded in both Core's `event_note` and durable `SEEN_CORE` visibility-lock history.
- **The owner added this event manually.** Do not tell Marketing/Tracker/AI that a Scanner discovered it, or that an independent official brand/artist announcement was verified.
- The private invited-guest area is not a public entry entitlement. Fan observation and photography/recording/external lens permissions remain organizer-controlled. No modification of the owner's existing storefront, prices, inventory or image is authorized by this reconciliation.
- `server/kk-ultra-deep-known-miss-regression.js` **already includes** `panpuri-phutatchai-pop-up-20261021` (V12). **Do not add a second Known-Miss test case**. This static case is a discovery regression obligation, not independent verification that a live scan caught the event.

## Review proposals staged, NOT applied

1. **`_Candidate_Queue`** — `REVIEW_CREATE_IF_ABSENT`, status `HOLD_OWNER_CORE_LINEAGE_REVIEW`. `Discovery Channel=OWNER_REVERSE_CORE_NOT_SCANNER`; official discovery source URL is `null`, `Official Verification=UNVERIFIED_OFFICIAL_EVENT_ANNOUNCEMENT`. Candidate must **not** become an operational `READY_FOR_VERIFIER` packet without pairing and a current primary source. Exact Core ID is retained in notes.
2. **`ต.ค. 2569`** — `REVIEW_EXISTING_CORE_MONTHLY_DISPOSITION`, status `HOLD_OWNER_CORE_MONTHLY_LINEAGE_REVIEW`; reflect *existing owner Core state* without scoring, pricing, visibility or stock overrides. Canonical month is sorted by event date; **do not append/insert a row blindly** or shift protected formula/writer rows. Recheck the exact lineage and safe authorized insertion path.
3. **`_Miss_Learning`** — observed reverse-lineage gap, *not* `LEARNED` or confirmed Scanner root cause. Stable idempotency `MISS|OWNERCORE|20261021|EVT-20261021-PANPURI-PHUTATCHAI-THAI-POPUP`, status `PROPOSED_REVIEW_NOT_LEARNED`, class `OWNER_CORE_TRACKER_LINEAGE_GAP`; `verified_scanner_failure=false`, `training_eligible=false`. No new static Known-Miss case or automatic source/price policy change.

The generated proposal objects have `stage_only=true`, `requires_owner_review=true`, `auto_apply=false` and `production_writes=0`. They are **not** an authorized writer payload.

## Source code changes and acceptance guards

- New `server/kk-ultra-deep-owner-core-lineage.js`: exact Core ID, date, venue, unique title, durable visibility lock, package inventory *identity only*, booking-presence flag (no customer details), and bidirectional tracker surface readback. Sheet date formats include `21/10/2026`, `21 ต.ค. 2569` and Google serial `46316`.
- Hard stop on missing Sheet header/surface, duplicate event ID, duplicate Core canonical identity, duplicate Candidate, title+date different venue, conflicting Core references, WebReady event-day mismatch, package identity mismatch, or `LOCKED` tombstone.
- New `prepareFromSheets` strictly validates headers, including the October tab's real header at **row 4**. It does **not** mistake an unread or renamed sheet for an empty Candidate/learning queue.
- `server/kk-ultra-deep-v2-learning-agent.js` V7 takes optional `owner_core_snapshot` and reports the staged review. The manual observation does **not** enter `missed_events`, adaptive `miss_classes`, live search proof, score inputs or learned root-cause. Protected policy forbids faked Scanner provenance, Tracker writes and unverified learning acceptance.
- `scripts/kk-ultra-deep-owner-lineage-review.js` is a **local read-only** CLI for future snapshots. It requires explicit `--snapshot-json` and `--event-id`, never calls Google Sheets or a business writer, and refuses write/deploy flags.
- Regression `tests/kk-ultra-deep-owner-core-lineage.test.js`: **14/14 isolated JS V8 tests passed** for owner provenance, stable re-read idempotence, duplicate collisions, wrong date/venue, booked/hidden/locked Core, malformed Sheets headers, missing source surface, Thai/Sheets date, AI learning and read-only CLI. This is **not** green Node npm / hosted GitHub CI.

### Local read-only regression/audit entry points

```bash
node --test tests/kk-ultra-deep-owner-core-lineage.test.js
npm run ultradeep:owner-lineage:review -- --snapshot-json ./local-eight-sheets.json --event-id EVT-20261021-PANPURI-PHUTATCHAI-THAI-POPUP
```

An input snapshot must contain the eight `*_values` arrays with their actual header rows, as specified by the code. Do not place customer/booking raw snapshots in GitHub. The CLI prints only the sanitized review plan.

## Remaining governed acceptance (must not skip)

1. Re-read all eight surfaces shortly **before** an authorized Tracker action. If a canonical Candidate/monthly/miss row has appeared, the proposal must collapse to only still-missing surfaces; duplicates and mismatches are HOLD.
2. Verify that Core event ID, date, owner visibility intent, `SEEN_CORE` history, booking locks, 490/590 pricing and hidden lens-only state remain unchanged.
3. Seek existing authorized Tracker canonical/Verifier writer, with owner acceptance, row-position-safe monthly update and exact readback. No direct Sheets mutation via this audit, and no `READY_FOR_VERIFIER` without a paired operational AI packet.
4. Re-read Candidate/Monthly/Miss and confirm **one canonical lineage**, correct manual origin, correct non-learned status. Mark the review applied **only after** authorized writer and exact receipts.
5. Independently corroborate official event announcement and photo/venue access. Run real October source discovery and separate Known-Miss live recall before changing `verified_scanner_failure` or `training_eligible`. Do not conflate poster owner-provenance with primary-source authority.
6. Keep PR #720 **DRAFT/UNMERGED/UNDEPLOYED** until Node/CI acceptance and the unrelated Full October source/provider gates pass.

**Current outcome:** Cross-system provenance gap identified, review proposals staged and reproducibly protected in GitHub; **Tracker Production has not been modified**. This is a completed read-only investigation and a proposed repair, **not** a completed production backfill.
