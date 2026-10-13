# Ultra Deep October 21 PAÑPURI miss — evidence and release gates

Status: INVESTIGATING / FAIL-CLOSED. Scope: discovery-only, no production writes.

## Grounded poster case
- 2026-10-21, 16:00–17:00 ICT, PAÑPURI LIMINAL CURRENTS HOLIDAY 2027 POP-UP.
- centralwOrld floor 1 Beacon 3; PHUTATCHAI and THAI.
- Invited guests only; fans may support from designated outside area with limited space.
- User-supplied poster is the lead, NOT an independent official announcement verification.

## Source audit 2026-10-13
- `server/kk-ultra-deep-runtime-runner.js` reference groups contain concerts, fan meets, lucky fan, calendars, and mall performance schedule. `referenceScopeDecision` requires a strong event keyword or trusted event-ticket path; a brand POP-UP title without these may be classified EVENT_IDENTITY_NOT_STRONG_ENOUGH. This is a plausible *reference recovery* gap, not proven execution root cause.
- `server/kk-ultra-deep-v2-learning-agent.js` V6 has brand/social and campaign visual miss classes and protected policy; no evidence yet this case was fed as missed_events.
- `docs/ULTRA_DEEP_BRAND_CAMPAIGN_VISUAL_SCHEDULE_LEARNING_2026-10-07.md` documents a confirmed prior brand/visual schedule recall gap and V6/V9 mitigation.
- GitHub code search for PAÑPURI and PHUTATCHAI returned no matches on default branch; code search cannot establish Candidate Pool, Google Sheet, or production state.

## Required root-cause discrimination
1. Verify primary announcement URL and publication timestamp. Was the event public before the October scan?
2. Search scan task receipts and provider attempts for PANPURI, PAÑPURI, Phutatchai, Thai, centralwOrld and Beacon 3.
3. Search immutable Candidate Master Pool, rejection/hold logs, 01_Events, 08_Web_Ready; preserve event_id, source_url, dates, reason and fingerprint.
4. Confirm actual production runtime commit and plan/source registry versions. Separate not-discovered, not-executed, provider error, rejected, hidden, and never-published.
5. October 1–31 read-only re-sweep including brand pop-up, mall appearance, invite-only fan support, image-led schedules and Thai/English transliterations. Reconcile against protected booking days and owner tombstones; never reopen hidden rows.

## Proposed non-production regression
- Positive reference discovery fixture: PAÑPURI / PANPURI POP-UP, 2026-10-21, Bangkok centralwOrld, PHUTATCHAI and THAI, independent official evidence required.
- Negative publish fixture: invited-only and outside limited-space access MUST NOT be interpreted as storefront eligibility.
- Negative fixture: generic brand promotion without artist, date or Bangkok evidence remains rejected.
- Add learning miss class for brand pop-up artist appearance only after confirming classification from receipts.
- Keep reference recovery distinct from publication; no mutation of prices, bookings, inventory or customer records.

## Gates
G1 official source and timing verified; G2 receipts and root-cause classified; G3 October coverage reconciled; G4 tests executed and passing; G5 reviewer approval and production readback plan. All currently NOT PROVEN.
No merge, deploy, paid API, automatic publication or production writes. production_writes=0.

## Implementation checkpoint — 2026-10-13
- Branch-only source change `server/kk-ultra-deep-runtime-runner.js` commit `5ab28708520176bd7ca6a130e4637bfebabcf967`: explicit artist-led brand pop-up reference candidate recognition, while generic promotions remain excluded; date/month gates and verifier-only recovery retained.
- Branch-only test `tests/ultra-deep-panpuri-popup-reference.test.js` commit `d378781999e750cd90230acc0ae2bca00583ec0d`: four Node test cases covering positive artist pop-up, negative generic promotion, date/month, verifier-only provenance.
- Branch-only learning change `server/kk-ultra-deep-v2-learning-agent.js` commit `6966a2475821311b24cbf1ec07b471d3d3f682fb`: new `BRAND_POPUP_ARTIST_APPEARANCE_GAP` class and artist/brand pop-up expansion queries. Does not change protected scoring or production authority.
- These are source edits, NOT verified passing tests. No live October scan, source verification, provider receipts, candidate pool/backend readback, CI or deployment acceptance has been performed at this checkpoint. G1–G5 remain HOLD. Avoid claiming complete coverage.
- Follow-up: execute Node tests on isolated branch, run independent October provider sweep and compare event IDs with backend in read-only mode, classify missed-event receipts, then seek owner acceptance before any merge/deploy.

## Follow-up verification — 2026-10-13
- Public-web targeted lookup for exact `PAÑPURI LIMINAL CURRENTS HOLIDAY 2027 PHUTATCHAI THAI 21 October 2026` did **not** surface an independently attributable official announcement. The brand's boutique page (https://panpuri.com/th/about/our-stores/discover-our-stores/central-world/) confirms PAÑPURI operates at centralwOrld, but it describes a *different second-floor boutique*, NOT the poster's first-floor Beacon 3 event. Do not conflate these.
- centralwOrld public What's On (https://www.centralworld.co.th/blog) did not show the exact event in retrieved listing. Absence from indexed pages is not proof of event nonexistence.
- User-provided schedule poster remains the only event-specific evidence checked in this pass. Official first-publication timestamp and organizer authorization remain unresolved.
- Follow-up source patch commit `55fdee67cf8ab4602dd3a2fa10ecfc2387f305ed` corrected a bug in prior patch: no longer uses scanner's context.location as proof of the candidate venue. Explicit candidate venue/location is required; popup artist regex corrected.
- Draft PR #720: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/720 . No merge.
- Execution limitation: GitHub connector can read/write source, but this session has no GitHub checkout/network access in the local container; Node tests and full runtime provider scan cannot be claimed executed. CI and live data readback remain HOLD. Do not upgrade G1–G5 status.

## Follow-up checkpoint 2026-10-13
- Reference plan now adds an independent artist brand pop-up query group, version V4, commit 48e791de1b981073251b0ae84f8c623bb6a499af. Previously only reference eligibility was patched, which could not guarantee recall when the query lane itself missed the event.
- Added negative regression for venue inference from scanner context, commit d69d6a27b7420e5e58669082b84273f48c75e878.
- GitHub workflow runs queried for commit 48e791d: empty list; this is NOT a passing CI result. Local git clone unavailable due DNS/network resolution failure. Tests remain unexecuted.
- Full October source sweep and Candidate Master Pool/Backend reconciliation are still pending, as are official event publication date and primary-source verification. Production acceptance remains HOLD. No merge/deploy/production writes.

## 2026-10-13 cross-chat live reconciliation — authoritative READ ONLY

### Authoritative sheet readback (not a data mutation)
- Backend: [KK Phone rental backend](https://docs.google.com/spreadsheets/d/12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU/edit), actual `01_Events` and calculated `08_Web_Ready` (not snapshot/archive tabs).
- October 2026: **144** event rows; **48** have active_on_web TRUE; **47** have WebReady action show/show_full.
- October 13–31: **87** events, **31** active TRUE, **30** WebReady show/show_full.
- Exact active/WebReady mismatch: `EVT-20261030-VVV-SHOW-GO-WHOLESALE-RAMA2` active TRUE but WebReady hide; independently unverified event date/poster, **DO NOT auto-publish**.
- PAÑPURI found, do not create duplicate: `01_Events` row 348 ID `EVT-20261021-PANPURI-PHUTATCHAI-THAI-POPUP`, date 21/10/2026, venue Beacon 3 centralwOrld Bangkok, poster Drive thumbnail present, status open, active TRUE, note `OWNER_EXPLICIT_ADD_2026-10-13_PRICE_490_590`. `08_Web_Ready` row 349 action show, count 2 phones and 2 lenses. `09_Web_Packages` rows 1034–1036: phone 490 available, standalone lens hidden, phone+lens bundle 590 available. These records came from an **owner-explicit manual addition**; do not imply scanner automatically discovered or officially corroborated it.
- Event Tracker: [Event Tracker 2569](https://docs.google.com/spreadsheets/d/1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo/edit), **zero matches for LIMINAL** in October tab, Candidate Queue, Miss Learning, Unlisted Inbox, source snapshots, field evidence and event lifecycle within scanned bounded ranges. Search PHUTATCHAI in Candidate Queue also returned zero. This is a cross-system provenance/learning gap, not a reason to re-create the Core event.
- The historic `_Scan_Status` records read contain no 2026-10-13 occurrence (last populated checkpoint 2026-09-30). `_Run_Manifest` read contains no Oct 13 occurrence; this absence is limited to these tracker sheets, not proof no run exists elsewhere.

### Control-plane runtime receipts — distinguish project identities
- **Authoritative command control plane:** Supabase `kk-unified-inbox` project `mxjnjujqjybqughsnqbz`, table `public.kk_ultra_deep_commands`, 9 October read-only rows: **8 FAILED**, one initial **COMPLETE** 2026-10-03 (early migration acceptance only; does not certify full October event coverage).
- Latest run created 2026-10-06 18:56:49 UTC, claimed 18:57:03 UTC, completed 18:57:09 UTC: `FULL_READ_ONLY`, `FAILED`, `BLOCKED_NO_VERIFIED_CANDIDATES`, `production_writes=0`. Other failures: `UNKNOWN_URL_SEARCH_PREFLIGHT_FAILED`, `BLOCKED_DISCOVERY_NOT_FULL`, `VERCEL_RUNTIME_TIMEOUT_300S`, and `FULL_LOOP_NOT_COMPLETE`. Full source coverage is **not proven**.
- Separate legacy `kk-phone-rental-runtime-ledger` project `zehlsagzrpromtfqqflt` has 2 older October QUEUED rows and is not the authoritative command plane after V27 migration. Do not confuse their states.
- GitHub PR workflow Ultra Deep V2 Acceptance has failed runs, e.g. run `38358933754` and `38361036134`; attempting job log read gave BlobNotFound/404, and job steps unavailable. **Failure type unproven; CI acceptance NOT GREEN.**

### Isolated source fixes (draft PR #720; not merged)
- `54a454b`: corrected regex accidental double escaping, so title-based "with ARTIST" and "x ARTIST" can match.
- `64c094b`: synchronized previous 5-lane test assertion with the new 6-lane independent reference plan.
- `7f283e8`: KnownMiss V12 adds `panpuri-phutatchai-pop-up-20261021`, targeted queries/aliases and `BRAND_POPUP_ARTIST_APPEARANCE_GAP`; **no fabricated official source URL or evidence fixture**. Live FULL cannot ignore the missed event.
- `236aba2`: strict-live regression asserts unsourced/wrong-date evidence cannot pass PAÑPURI.
- `55606ca`: explicit title artist and reference lane tests.
- `0dad37a`: verifies Learning Agent's artist+brand query expansion without protected policy or production writes.
- Existing corrections: `55fdee6` (candidate venue must be explicit, no inherited scanner location), `48e791d` (sixth independent brand pop-up query lane), `d69d6a2` (no inferred venue), prior learning and safety changes.
- Unit tests are **committed but have not been executed successfully** on this isolated branch in a complete reproducible Node checkout; do not claim passing tests.

### Safety disposition / work still blocked
- G1 Primary source / official announcement timestamp: **HOLD**; owner-supplied poster is not independent event-authority evidence.
- G2 Full October source/provider receipts and candidate discovery coverage: **HOLD**; latest command FAILED.
- G3 Code/AI Learning/Regression: **source committed, test execution HOLD**.
- G4 Cross-system reconciliation: **Core PAÑPURI already live in sheet**, but tracker candidate + learning records absent. Preserve existing owner pricing/poster, do not duplicate/backfill records via ungoverned writer. VVV date discrepancy HOLD.
- G5 CI + owner acceptance + production release: **HOLD**. No merge, deploy, paid provider action, price adjustment, tombstone reopen, or production data write performed in this audit.

Next permissible safe route: run targeted tests on a real isolated checkout with available zero-cost execution, obtain authoritative primary-source event receipt, rerun **read-only** October scan using legitimately bound providers, compare Candidate Queue/known-miss live recall and independent reference receipts, stage a governed tracker-learning entry for owner review, and accept only after all gates.

## Phase 1 closed in branch — Discovery → Artist Pop-up Verifier source fix (2026-10-13)

### Scope and root cause (code-proven)
- Previously the independent reference discovery lane could surface an artist-led brand pop-up, but `server/kk-ultra-deep-candidate-verifier.js` V3 `EVENT_SIGNAL` excluded `POP-UP`, `prefilter` rejected the record as `EVENT_IDENTITY_NOT_STRONG_ENOUGH`, and `rentalFitScore` returned 5.0 against a 7.0 commercial threshold. Missing search-snippet date blocked fetching a first-party event page. Therefore reference recovery alone did **not** make the event verifiable.
- This is a **proven source-level defect**, not proof of which provider first missed PAÑPURI or of the official announcement's original publication timestamp.

### Code implementation (branch PR #720 only)
1. `d55f782` — Verifier V4: introduce `ARTIST_POPUP_SIGNAL` and named-artist appearance identity; allow an identified pop-up to enter prefilter with HTTPS even if the search snippet lacks a date. Existing generic retail popup, non-HTTPS, wrong-month, aggregate-result, and noise exclusions stay in place.
2. `b695620` — Parse structured first-party date, venue, and poster; return normalized array of named performers even when the candidate supplied the artists as a pipe-separated string. Set *preliminary* artist-led popup rental fit to 7.0 **without lowering the universal threshold or auto-publish guard**. Require an owner access/filming/lens permission decision; `verified=false`, `publish_eligibility.eligible=false`, `poster.verified=false`, and `ARTIST_POPUP_OWNER_ACCESS_PHOTO_POLICY_REVIEW_REQUIRED` remain even when all sample source fields are populated. Pop-up source authority stays owner-gated, not asserted from generic JSON-LD or a social result.
3. `f3d1440` and `adcc5a9` — Artist source corroboration tightened; transient malformed regex-replacement in branch fixed in `adcc5a9` *before* isolated validation. The final version was parsed and exercised successfully.
4. `bebbad1` — Verifier `holds[]` now exposes actionable review fields (title, date, time, venue, artists, source URL, unverified poster URL, status and explicit blockers) without elevating them to published candidates.
5. `0b5b459` — Order-independent venue matching (e.g. Beacon 3 centralwOrld vs centralwOrld Beacon 3) with explicit mismatch blocker, plus Thailand-local source start-time extraction without mislabeling UTC / non-+07 time.
6. `a2cd7c8` — Require *all* named artists as exact source tokens and require a title-extracted artist to match the source, preventing `THAI` from being satisfied by `Thailand` or `with SOMENAME` by `with OTHERNAME`. Separate source-level evidence from final owner approval.
7. `98d8128`, `f0ac8da`, `f4b29e5` — Added popup/venue/time/negative/owner HOLD regression cases to `tests/kk-ultra-deep-candidate-verifier.test.js`.
8. `61bcd80` — Integration regression `tests/ultra-deep-panpuri-popup-reference.test.js`: `scopeReferenceCandidates -> recoverEligibleReferenceCandidates -> Verifier.verifyBatch`, exact 21 Oct evidence, `verified_count=0`, review HOLD, `production_writes=0`.
9. `50964a4` — Added both Verifier and pop-up integration files to the existing `test:ultradeep:recall` command in package.json, which is invoked by the repository's `postinstall` acceptance path. This is a source change only; do not treat it as a green CI run.

### Executed validations — label exactly
- The **exact files fetched from this GitHub branch** were evaluated with a local JavaScript V8 harness, stubbing Node-specific imports, deterministic hash, and network response, not running a real Node checkout or Actions runner:
  - `tests/kk-ultra-deep-candidate-verifier.test.js`: **17/17 passed**
  - `tests/ultra-deep-panpuri-popup-reference.test.js`: **9/9 passed** (actual Runner, Reconciliation, KnownMiss, Learning Agent, and Verifier source modules loaded with provider stubs)
  - `tests/kk-ultra-deep-known-miss-regression.test.js`: **12/12 passed**
  - Total **38/38 isolated V8 checks**. These prove selected pure-JS behavior and mocks, **not GitHub CI / npm / real live provider acceptance**.
- CI exact-head observation after `50964a4`: `Vercel Deployment Source Contract` run `38366095589` FAILED, `Ultra Deep V2 Acceptance` run `38366095649` FAILED. Both had zero surfaced steps/logs in connected API; cannot attribute to code failure or runner quota without further receipts. **CI remains RED/HOLD.**

### Safety and remaining work
- PAÑPURI Oct 21 is already owner-added to `01_Events` / `08_Web_Ready` with phone 490 / phone+lens 590. No duplicate event, price modification, external booking, approval, or production business write was made here.
- Pop-up verification results are **review leads** only. Owner must confirm exact primary announcement, date/time, fan-public observation area, venue capacity, photography/recording and external lens permissions. No social/search result or JSON-LD alone may grant renter access. If evidence is missing, status stays HOLD.
- This closes **item #1 in the isolated branch only**: candidate detection, source enrichment, fail-closed handoff to manual review, and source-level regression coverage. It does **not** close item #2 (paid-free live provider preflight and October read-only FULL scan), #3 (business-truth tracker learning reconciliation), #4 (official evidence for PAÑPURI/VVV), or #5 (Node/CI/release approval).
- PR #720 must remain **DRAFT/UNMERGED/UNDEPLOYED**; production SHA and business data unchanged. Rollback if needed: revert the Verifier V4 file, new/changed tests, and package.json test gate on this branch; preserve independent existing owner business records.

## October Read-only Runtime Phase 2 continuation (2026-10-13 ICT)

**New durable runbook:** [ULTRA_DEEP_OCTOBER_READONLY_RUNTIME_REPAIR_2026-10-13.md](./ULTRA_DEEP_OCTOBER_READONLY_RUNTIME_REPAIR_2026-10-13.md). It records source changes, exact zero-cost local commands, live read-only Supabase receipts, bounded public-calendar comparison, negative proof and unresolved gates.

### Confirmed additional source-level issues and code fixes
- V3/V4 verifier dropped strong date-less concert/RSS search leads **before** opening their original event page. `kk-ultra-deep-candidate-verifier.js` V5 now fetches leads with an event signal but requires source-backed JSON-LD target-month date, detects candidate/source date conflict, and holds undated/contradictory events. Existing artist pop-up owner-access/photo policy stays HOLD.
- October monolithic plan initially had **150 tasks / 679 query variants**. Known-Miss V3 filters to the exact October event/discovery scope while retaining November cross-month discovery requirements: **144 tasks / 646 variants** (111 monthly, 27 Known-Miss, 6 independent reference). Six irrelevant historical probes and 33 query variants were removed without weakening October live recall.
- Provider Executor V6 + Runtime Runner V15 propagate a bounded wall-clock deadline and emit explicit `TIME_BUDGET_EXHAUSTED` receipts / `RUNTIME_BUDGET_EXHAUSTED` blocker rather than falling through to silent 300-second request timeout or claiming FULL. Direct V27 clamps monolithic search to 180 seconds by default (210-second maximum), keeping `production_writes=0` for HOLD.
- New **zero-spend local** `server/kk-ultra-deep-readonly-shards.js` + `scripts/kk-ultra-deep-local-readonly-shards.js`: a deterministic 12-shard / 144-task CLI flow with manifest hash, free-provider whitelist, local receipts, resume, verification and offline-only merge. No installed self-hosted runner accessible here; the actual 12 external-source shard runs were **not** executed.
- Offline report `full=false, authoritative=false, release_eligible=false` even if every synthetic shard matches. Budget-interrupted variants also keep `SHARD_TIMEOUT_OR_INCOMPLETE`. `.gitignore` hides local receipt output.
- Local static unit/source gate paths were updated in `package.json`. Fixed missing `path` and `ROOT` declarations in existing `tests/kk-ultra-deep-direct-zero-cost.test.js`.

### Verified checks versus missing checks
- **84/84 isolated V8 regression checks** executed against the latest PR source snapshots with mocked Node imports/provider responses: **35 Runtime+Executor, 20 Verifier, 9 Reference→Verifier, 12 Known-Miss, 8 Local Shards+CLI**. Direct V27 also exercised in isolated stub mode; oversized 900,000 ms input clamps to 210,000 and returns BLOCKED with zero writes.
- These are **not** a real Node 20+ checkout test run, not a live October FULL provider execution and not green GitHub Actions CI.
- Last observed GitHub PR workflow runs for Phase-2 head `8a6c896d`: **Ultra Deep V2 Acceptance #38371572207 FAILED; Vercel Deployment Source Contract #38371572200 FAILED**. No successful hosted gate/usable logs from the previous runs. `Draft PR #720` remained open, unmerged, mergeable in source only.
- Production alias `kk-phone-rental.vercel.app` still points to old deployment `dpl_7TYLb87ir9qNzXRtkeb49543dwVm`. There is **no** claim that Runtime V15, Executor V6, Verifier V5 or shards are deployed.
- Authoritative Oct Control Plane still reports 9 old commands (8 FAILED, 1 early migration COMPLETE), most recent failed `BLOCKED_NO_VERIFIED_CANDIDATES` and `production_writes=0`.
- Backend PAÑPURI owner-added row and 490/590 pricing are **unchanged**, with the earlier VVV October 30 date/poster HOLD preserved. Independent PopRadar/Natgan/Zipevent/centralwOrld partial check does not replace all 144 October discovery receipts.

**Release remains HOLD:** The next real gate is trusted local zero-cost Node execution of all 12 shards, complete per-task provider receipts and live Known-Miss/primary-source verification; then separate clean Node/CI, owner acceptance, booking/tombstone and governed release review. Never merge/deploy or write business truth based only on isolated test successes.

## Phase 3: Owner Core ↔ Tracker ↔ AI Learning — read-only reconciliation (2026-10-13 ICT)

**Selected user task:** #5, link an already owner-added PAÑPURI Oct21 Core event to its missing Tracker and Miss Learning lineage *without inventing Scanner discovery, duplicate Core events, new pricing or unauthorized direct Sheets writes*.

**Actual eight-sheet readback, not synthetic:**
- Backend `01_Events` unique ID `EVT-20261021-PANPURI-PHUTATCHAI-THAI-POPUP`, 21 Oct, current Core; `08_Web_Ready` same date/id show; 3 packages `phone_only=490`, `phone_lens_bundle=590`, `lens_only=hidden`; visibility history `SEEN_CORE / OWNER_EXPLICIT_ADD_2026-10-13` with Sheets serial event date 46316. Exact event ID absent from checked `00_Master_Booking!A4:W500`.
- Candidate Queue `A1:AL2000`, October Tracker `A1:U1017` and Miss Learning `A1:M2000`: **0 matching canonical/alias PAÑPURI lineage rows**. Other tracked Oct21 events are unrelated; do not conflate by date.
- The new strict owner-Core review module consumed all **eight actual returned values matrices** in one read-only run. Outcome **`STAGED_REVIEW_ONLY`**, 3 proposals, 0 conflicts, 0 writes, existing Core and owner settings unchanged. Re-run after stronger Core↔WebReady consistency checks also remained `STAGED_REVIEW_ONLY`.
- Static Known-Miss V12 already contains case `panpuri-phutatchai-pop-up-20261021`; **do not add another**. This is a regression obligation, not a proven successful live Scanner finding.

**Code / reproducibility:**
- `server/kk-ultra-deep-owner-core-lineage.js` V1 and `prepareFromSheets`: strict exact Core event ID, Thai/ISO/serial date, unique title+date+venue, Core/WebReady agreement, owner-lock `SEEN_CORE` history, package-type identity, visibility/tombstones, active booking presence. Detects duplicate Tracker and conflicting date/venue, requires every snapshot surface and real headers (October Tracker row 4).
- `server/kk-ultra-deep-v2-learning-agent.js` V7 integrates optional `owner_core_snapshot`. Owner-only snapshot returns **`OWNER_CORE_REVIEW_PENDING`**, not `LEARNED`; `missed_events=0`, `adaptive.query_terms=[]`, `miss_classes=[]`, `owner_core_learning_accepted=false`, no Tracker or price/visibility writes.
- `scripts/kk-ultra-deep-owner-lineage-review.js`: explicit local `--snapshot-json` and `--event-id` read-only CLI; rejects writer flags.
- `package.json`: dedicated `ultradeep:owner-lineage:review` script, syntax gates and owner-lineage regression in existing `test:ultradeep:recall`.
- `tests/kk-ultra-deep-owner-core-lineage.test.js`: **15/15 isolated V8 cases pass**, including replay idempotency, duplicate/cross-date identities, missing headers, owner-hidden, invalid dates, inconsistent WebReady/closed event, confirmed booking, Learning policy separation, and CLI write flag rejection. **Not** full Node/npm CI evidence.
- Persisted **minimal no-PII stage artifact**: [ULTRA_DEEP_OWNER_CORE_PANPURI_STAGED_2026-10-13.json](./ULTRA_DEEP_OWNER_CORE_PANPURI_STAGED_2026-10-13.json); comprehensive [Phase 3 audit/runbook](./ULTRA_DEEP_OWNER_CORE_LINEAGE_AUDIT_2026-10-13.md). Raw booking/customer snapshots are not committed.

**Three reviewer-only proposals, never yet applied:** `_Candidate_Queue: HOLD_OWNER_CORE_LINEAGE_REVIEW`, `ต.ค. 2569: HOLD_OWNER_CORE_MONTHLY_LINEAGE_REVIEW`, `_Miss_Learning: PROPOSED_REVIEW_NOT_LEARNED` under deterministic ID `MISS|OWNERCORE|20261021|EVT-20261021-PANPURI-PHUTATCHAI-THAI-POPUP`. All mark origin `OWNER_SUPPLIED_NOT_SCANNER_DISCOVERED`; official organizer/venue/photo/lens evidence remains unverified.

**Guarded write/Release status:** Tracker Sheets **NOT modified**, no Admin writer request, Core unchanged, price 490/590 unchanged, no booking/tombstone override, no merge or deployment. Any future authorized Tracker repair requires a fresh eight-surface readback, duplicate-safe canonical/monthly row plan, owner-approved governed Verifier/Admin writer and exact readback. A real source/full October scan and official PAÑPURI evidence remain separate HOLD gates. Do not mark AI learning accepted until they pass.


## Phase 4 — Date-less Reference Recovery source repair (2026-10-13; user selected task #4)

**Root cause repaired on Draft PR #720:** ReferenceScope previously categorically rejected `event_date=null` with `NO_STRUCTURED_DATE`; ReferenceRecovery independently skipped candidates that lacked a structured event identity, despite Candidate Verifier V5 already being able to fetch exact-event `Event.startDate` from source JSON-LD. Reconciliation previously ignored unstructured references, and Direct Full HOLD exited before invoking Verifier.

**Changes:** Runner V16 now stages only explicitly Bangkok-scoped, event-specific HTTPS, strong artist/event date-less leads as `SOURCE_DATE_PENDING_PRIMARY_VERIFIER`. Invalid/foreign/month-mismatched dates, generic retail/calendar/home/search, unsafe URLs and ticket-domain lookalikes are rejected. Recovery deduplicates date-less references by source+title+venue without fabricating a date. Reconciliation V3 counts eligible undated references as **unresolved source-date gaps** and explicitly blocks FULL. Verifier V6 requires matching exact JSON-LD Event identity/date and Bangkok-area venue, prioritizes the correct event on multi-event pages, and keeps PAÑPURI artist pop-up **OWNER ACCESS/PHOTO/LENS HOLD**. Direct V28 performs a bounded, **read-only** Verifier diagnostic for up to four date-less references only when FULL is already blocked, never for commit-intent; the overall result remains `BLOCKED_DISCOVERY_NOT_FULL`, `production_writes=0`.

**Regression:** New `tests/kk-ultra-deep-reference-date-recovery.test.js` contains **24 cases** and updated existing PAÑPURI popup test. Combined 5-file relevant JS harness executed **90/90 exact-branch V8 isolated tests**, with mock Node modules/URL/public providers/HTML. **NOT a native Node/npm/hosted CI pass**, and **NOT a live source search**. Native Node v22 existed in local container, but authenticated GitHub repository code could not be cloned due to network DNS failure; exact-head free Node20/24 acceptance remains separate HOLD. `package.json` registers this suite in Ultra Deep recall/syntax checks.

**Immutable safety:** No Production, Supabase, Booking, Core, Tracker, price, inventory, poster, visibility or owner-source edits. No paid provider execution; PR remains Draft/Unmerged/Undeployed. No claim Scanner independently found PAÑPURI. Live October 12-shard source receipts and official event/access/photo permissions remain unverified.

**Full technical handoff and exact regression cases:** [ULTRA_DEEP_REFERENCE_DATELESS_RECOVERY_2026-10-13.md](./ULTRA_DEEP_REFERENCE_DATELESS_RECOVERY_2026-10-13.md).
