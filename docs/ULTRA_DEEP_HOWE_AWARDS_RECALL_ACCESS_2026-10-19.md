# HOWE Awards 2026 — October Ultra Deep recall and access-gate handoff

**Date:** 2026-10-19 (Asia/Bangkok)  
**Status:** SOURCE PATCH ON ISOLATED DRAFT BRANCH / CI & PRODUCTION ACCEPTANCE PENDING  
**Baseline main:** `a54a348dd3258d87b1ec0c70e6ffd255d4678018`  
**Draft branch:** `fix/howe-awards-recall-access-gates-20261019`  
**Owners' operating constraints:** no paid providers, no pricing/booking alteration, no production writer, no merge/deploy without safety gates and approval.

## 1. Reproduced factual state (do not overwrite)

- Event HOWE Awards 2026 14th Anniversary is **20 October 2026**, **16:00 onward**, **BITEC Grand Hall 201–203**, per the official venue: https://www.bitec.co.th/event/howe-awards-2026-14th-anniversary .
- User supplied a HOWE **BEST COUPLE AWARD** ranking image. The displayed 9 August 2026 date is a **voting cutoff**, not event date. The image is not itself a licence to attend/record.
- External public mirror of organiser `@howemagazine_th` includes red-carpet arrangements: public without wristband after **13:00** and separate priority zones for members/winners. Source: https://doublecrosswebzine.twstalker.com/howemagazine_th . **Official-post direct readback and applicable current camera/device/lens rules are still required.** Do not infer public ceremony admission from red-carpet access.
- Native Event Tracker `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`, `_Candidate_Queue` **row 323**, already includes HOWE Awards — Mable & Pangjie, dated 2026-10-20, `VERIFIED_HOLD`, `ARTIST_SCHEDULE_BOARD_GAP/TRUE_DISCOVERY_MISS` provenance (8 Oct manual recovery). Other artist appearances might be additional signals for the **same award show**, not separate unique rental events.
- Bounded literal `HOWE` lookup returned no rows in canonical backend `01_Events`, `08_Web_Ready`, `09_Web_Packages` and in Event Tracker `ต.ค. 2569`. This is a bounded title search, not exhaustive identity reconciliation.
- Existing durable source: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/672 . October system acceptance shortcomings: https://github.com/mikesd1995/kk-phone-rental-vercel/issues/685 .

## 2. Root causes / distinctions

1. The full monthly `TIER_TERMS` already included `AWARD_RED_CARPET`, but `OPERATIONAL_TIERS` **omitted it entirely**. A smart daily scan could never issue a dedicated award search.
2. Mandatory source universe had generic `BITEC` but no independently tracked HOWE organiser-specific coverage receipt; a required venue source does not establish that every venue event was retrieved.
3. Candidate's single PRIVATE/AWARD label conflated **closed ceremony admission** with **possibly public red-carpet fan access**; existing rentability scores alone cannot determine photography or third-party lens privileges.
4. Historical automated/production Full Loop was not accepted; past manual recovery is not evidence that live scheduled scan actually executes correctly. Do not claim live recall gain or production fix without runtime and source receipts.

## 3. Code changes (draft, no live writes)

- `server/kk-monthly-deep-scan-query-plan.js`: `AWARD_RED_CARPET` added to Smart Operational; named HOWE/MAYA/KAZZ and natural Thai/English October variants added; plan version bumped.
- `server/kk-ultra-deep-source-registry.js`: `howe-awards-official` (`howemagazine.com`) becomes an independent **required** official source with fail-closed source execution receipt; source version bumped. This intentionally makes FULL source completeness fail if the new source has not executed. No proxy provider is automatically activated.
- `server/kk-ultra-deep-award-zone-access.js` (new): award/red-carpet classification, separate public red-carpet vs private ceremony, require verifier-confirmed HTTPS official access evidence, verified phone photography, explicit external-lens clearance and camera-policy evidence; owner holds win. Public access **does not** imply camera permission.
- `server/kk-ultra-deep-v2-runtime-adapter.js`: new award candidate gets `VERIFY_ACCESS` until complete access evidence; `NO_CAPACITY` remains prior to access review; commercial External Demand score never bypasses access. Existing canonical maintenance behavior remains separate; nothing auto-published.
- `tests/kk-monthly-deep-scan-query-plan.test.js`, `tests/kk-ultra-deep-source-registry.test.js`, `tests/kk-ultra-deep-award-zone-access.test.js`: source/operational recall and red-carpet access test coverage including HOWE 20 October / voting end 9 August and negative safety cases.

### New candidate access field contract

Award candidates may only clear **access review** if all flags are independently verified: 
`red_carpet_public_access_verified`, `verified_official_access_source`, `official_access_source_url` (HTTPS), `phone_photography_allowed_verified`, `external_lens_allowed_verified`, `verified_official_camera_rules_source`, `official_camera_rules_source_url` (HTTPS), and no `owner_hold`, `owner_hidden`, or `tombstone_locked`.

These fields **do not authorize publication**. The existing External Demand >=60, verified date/venue/poster, capacity, safety, owner-lock, editor/writer and owner-approval gates still apply. This PR deliberately does **not** synthesize these flags from public venue access or automatically update Tracker row 323.

## 4. Acceptance checklist (evidence must be retained)

- [ ] Exact draft SHA syntax check for each changed JS file.
- [ ] Targeted executable Node tests for both query planners, source registry, new access gate, V2 adapter and pricing guards, with readable logs.
- [ ] Full applicable CI green on exact PR head. CI infra failures are not passing tests.
- [ ] Independent diff/code review, branch rebase against fresh main if necessary, no safety gate weakening.
- [ ] Live provider read-only per-source receipt proving HOWE organiser + BITEC each searched; replay newly added award query path with real references and dedupe by show/date.
- [ ] Validate current organiser official red-carpet notice in its native source, actual phone/video/external-lens policy, zone/time restrictions and current photography rules. HOLD if unknown.
- [ ] Confirm actual 20 October bookings, owner-day closure, two-phone capacity from authoritative booking table (bounded title lookup alone is insufficient).
- [ ] Separate market-score evidence, comparable prices, verified poster and owner review. Do not fabricate prices or commercial assumptions.
- [ ] Only after all gates: owner-authorized business writer, exact canonical/Core→Web Ready→Production readback, booking and visibility locks rechecked, no duplicate show.
- [ ] Re-run next clean unseeded October sample and compare real recall/false positives and complete source receipts. Code presence is not coverage acceptance.

## 5. Rollback and cross-chat continuity

Branch is isolated. Roll back by closing draft PR; no database, booking, external provider, scheduled task, social post, price, production deployment or owner visibility state was changed by this work. Existing `_Candidate_Queue!A323` remains `VERIFIED_HOLD`.

**Cross-chat continuation:** open this document and the linked draft PR first; retrieve exact head and checks before further edits. Treat this as a **source fix prepared**, not completed business release. Next priority is source/CI acceptance followed by producer rule verification; if live run is blocked, retain HOLD and record an explicit reason rather than advertising a false FULL scan.
