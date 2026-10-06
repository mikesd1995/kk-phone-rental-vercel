# Ultra Deep Full Loop V2 — Canonical Handoff (2026-10-04)

## Decision
Legacy Ultra Deep orchestration is frozen for feature expansion. Do not create V28/V29 or add more control-plane layers. V2 is the forward path: a small single-pipeline planner that reuses proven discovery/verifier/evidence/writer capabilities but keeps planning independent from CI/Make orchestration.

## Implemented
PR #602 merged to main as `dba74b5f4ea38d02fc07815902cbb799d27b2c56`.

Files:
- `server/kk-ultra-deep-full-loop-v2-policy.js`
- `server/kk-ultra-deep-full-loop-v2.js`
- `tests/kk-ultra-deep-full-loop-v2.test.js`

## Locked V2 policy
1. Hidden/tombstoned event => `SKIP_HIDDEN`; no create/update.
2. ANY booking_count > 0 => `SKIP_BOOKED`; no repricing. This intentionally fixes the legacy owner-policy gap that only locked price when booking_count > 0 AND stock_remaining > 0.
3. Existing unbooked event with fresh exact-event competitor prices => target exact median.
4. Verified official date change => explicit `UPDATE_DATE`.
5. Verified official venue change => explicit `UPDATE_VENUE`.
6. Verified official artwork change => explicit `UPDATE_POSTER`.
7. New event requires exact-event verification + verified HTTPS official poster + safe price.
8. New-event price uses fresh exact-event competitor median first; governed fallback only when no market median exists.
9. Planner performs zero production writes. Writer authority remains `GOVERNED_ADMIN_ONLY`.
10. COMPLETE requires plan READY + writer COMPLETE + production_writes == planned_mutation_count + exact readback.

## Regression tests added
- booking locks price even when stock_remaining = 0
- tombstone beats create
- unbooked event reprices to median
- new event without verified poster HOLDs
- verified new event creates at median
- COMPLETE impossible without exact readback

## Why V2
The previous system accumulated execution dependencies (Actions scheduling/quota, command bridge, deployment promotion, Make/TinyFish alternatives) that obscured the actual business loop. V2 separates business planning from execution infrastructure and produces deterministic mutation intents. It does not weaken production governance.

## Current limitations / next implementation
V2 currently owns policy + deterministic mutation plan + acceptance contract. It is NOT yet wired to live monthly discovery/verifier/competitor evidence nor to the governed Admin writer. Do not call it production complete.

Next:
1. Adapter: Runtime.runMonthlyUltraDeep -> verified normalized V2 candidates.
2. Join candidates against fresh canonical snapshot: exists/hidden/tombstone/booking_count/current price/date/venue/poster.
3. Attach exact competitor evidence + verified poster/date/venue evidence.
4. Build V2 plan.
5. READ_ONLY report first; require zero writes and no HOLD for commit set.
6. Map V2 mutations to existing governed Admin writer only.
7. Fresh canonical/storefront readback.
8. V2.acceptance must return COMPLETE.
9. Record exact event decisions and write/readback evidence in Issue #368.

## Safety
No production business data was changed by PR #602. Production writes from this V2 implementation step = 0.


## V2.1 owner requirements — implemented 2026-10-04
PR #603 merged as `af4e2a0a45055b6017833d81e3f168455266d846`.

### Booking behavior corrected
Booking no longer freezes the whole event. Any booking locks PRICE only. Verified official date, venue and poster changes remain eligible for update. Hidden/tombstone still overrides everything.

### Poster fallback clarified
Competitor storefront/poster URLs may be collected as poster discovery leads when an exact-event competitor listing exists, but they do not satisfy verification by themselves. A new event remains HOLD until the poster is independently verified as artwork for the exact event. No random/near-match image publish.

### Long-tail coverage expanded
Monthly query plan V4 defaults to Bangkok Metropolitan Region and explicitly covers: concerts, fanmeet/fancon, showcase/mini concert/festival, organizer/promoter feeds, malls/community venues, fan gatherings/birthday projects, blessing ceremonies/openings, award/red-carpet events, press/brand appearances, sports/entertainment, social signals, competitor listings and public calendars. Geographic variants include Bangkok, Nonthaburi, Pathum Thani and Samut Prakan. Search stop condition now requires exhausting bounded variants and recording receipts rather than stopping after the first HTTPS source.

### Adaptive learning agent added
`server/kk-ultra-deep-v2-learning-agent.js` learns from missed events, false positives, HOLD reasons, source successes and manual corrections. It may automatically adapt query terms, source priority and matching heuristics and emits a change log/recommendations. Protected policy cannot be self-modified: BOOKING_PRICE_LOCK, TOMBSTONE_NO_RESURRECTION, GOVERNED_ADMIN_WRITER_ONLY, EXACT_READBACK_REQUIRED, VERIFIED_EVENT_REQUIRED. Learning agent production writes = 0.

### Regression coverage
Tests now lock: booked price immutability with metadata updates; tombstone precedence; median repricing for unbooked events; competitor poster lead cannot bypass verification; verified create pricing; exact-readback COMPLETE gate; learning boundary; long-tail Bangkok-metro query tiers.

### Production status
PR #603 changes planning/discovery/learning code only. Production business writes = 0. Live V2 discovery-to-writer wiring and production acceptance remain pending; do not call V2 production COMPLETE yet.


## V2.2 commercial qualification — implemented 2026-10-04
PR #604 merged as `2440b360c5441e892385bf79536fc714c3160d11`.

### Rentability gate
Discovery remains broad, but an event is not automatically storefront-worthy. New `server/kk-ultra-deep-rentability-score.js` scores 0-100 with baseline weights: Fandom Strength 30, Social Demand 25, Rental Intent 20, Commercial Evidence 15, Event Quality 10. Bounded boosts: sold-out/added round +5, high engagement velocity +5, multiple competitor rental listings +5, strong fan-project signal +3. Baseline tiers: HIGH >=70, MEDIUM 50-69.9, LOW <50.

Qualification decisions: HIGH => FULL_LOOP; MEDIUM => VERIFY_MORE; LOW => WATCH. Verified competitor-rental/strong commercial evidence may promote into FULL_LOOP. This is a commercial candidate gate, not a verification bypass.

### Revenue + capacity
Revenue potential tracks demand score, booking probability, expected rental price and available inventory. available_inventory=0 => NO_CAPACITY before commercial execution. This prevents broad discovery from turning the storefront into a generic event calendar and prioritizes work that can plausibly create rental revenue.

### Adaptive scoring
Learning agent now consumes booking/revenue outcomes and may recalibrate RENTABILITY_WEIGHTS and HIGH_MEDIUM_THRESHOLDS in addition to source/query/matching strategy. Every scoring change must be versioned, record before/after, retain evidence, and be rollback-capable. Protected policy remains immutable to the learner.

### Intended V2 pipeline
DISCOVER_BROAD -> RENTABILITY_SCORE -> REVENUE_POTENTIAL -> CAPACITY_CHECK -> VERIFY -> CANONICAL/BOOKING/TOMBSTONE -> PRICE/POSTER -> PLAN -> GOVERNED_WRITE -> EXACT_READBACK -> STOREFRONT_QA -> BOOKING/REVENUE_OUTCOME -> LEARN.

### Acceptance status
Implementation and regression cases are committed/merged, but connector-side editing does not itself prove Node tests or live production execution. Production business writes from this change = 0. Do not call Full Loop production COMPLETE until live wiring + acceptance evidence exists.


## V2.3 runtime wiring — implemented 2026-10-04
PR #606 merged as `f5f9c396ba1ee9769eef5682e4fda51fbbec5891`.

### Live READ_ONLY path now reaches V2
`server/kk-ultra-deep-direct-zero-cost.js` V24 now builds a V2 read-only plan after discovery -> verifier -> competitor scan -> commercial evidence. It uses `server/kk-ultra-deep-v2-runtime-adapter.js` to join verified candidates with the fresh production snapshot, booking state, capacity, canonical events, packages and verified commercial evidence. READ_ONLY remains zero-write.

### Reconciliation fixes
The V2 adapter preserves canonical maintenance candidates even if a new-event rentability gate would reject them. It adds exact-title cross-date matching so an official date move is not automatically treated as a new event. Ambiguous identities remain non-authoritative. Booking count is joined by canonical event_id. Capacity is derived from phone inventory minus active booking holds for the date.

### Package-scoped pricing
V2 policy now accepts package-scoped price targets. Exact competitor evidence is filtered by package type before median comparison, preventing PHONE_ONLY and PHONE_LENS prices from being mixed. Any booking still suppresses every UPDATE_PRICE while verified metadata mutations remain eligible.

### Fail-closed COMMIT
V24 deliberately blocks COMMIT with `BLOCKED_V2_COMMIT_NOT_WIRED` / `V2_GOVERNED_WRITER_MAPPING_REQUIRED` instead of falling back to legacy writer semantics. This is intentional because V2 now has date/venue/poster and package-scoped mutation semantics that legacy orchestration does not implement exactly. Production writes from V2.3 = 0.

### Regression cases added
Coverage added for booked metadata updates without price changes, package-type price separation, exact-title date moves, and low-rentability new-event exclusion while canonical maintenance is retained.

### Validation evidence
PR #606 was mergeable and merged. No GitHub workflow runs were returned for merge commit `f5f9c396ba1ee9769eef5682e4fda51fbbec5891` at inspection time, so do not claim Node tests/CI passed. Next required implementation is the V2 governed-writer mapper plus exact mutation-by-mutation readback, followed by production READ_ONLY acceptance and only then COMMIT.


## V2 live-wiring continuation — 2026-10-04
Current main already contained V2 runtime adapter/read-only wiring when this continuation started. An initial replacement PR #605 conflicted; conflict-safe PR #607 was then intentionally CLOSED after review showed it would regress the newer V2Adapter fail-closed path. No merge from #605/#607.

PR #608 merged as `a13114319848c93fc973d4987ee706f422dfc369` and patches the current architecture instead of replacing it.

### Defects fixed
1. Direct runner previously deleted every discovery candidate on a fully booked date before verifier. Fixed: full-booked-date candidates remain in verifier so an existing booked canonical event can still receive verified date/venue/poster maintenance. Price remains locked by V2 policy. Capacity is applied after canonical matching to NEW commercial candidates.
2. Rentability scorer treated missing fandom/social/rental/event-quality evidence as numeric zero, risking false-negative WATCH exclusion. Fixed: missing evidence remains null; if fewer than 3/5 scoring signals are present, qualification fails open to VERIFY_MORE. Zero capacity retains precedence => NO_CAPACITY.
3. Default live scope aligned to Bangkok Metropolitan Region.

### Current live safety state
The current direct runner builds V2 READ_ONLY through `kk-ultra-deep-v2-runtime-adapter.js`. READ_ONLY returns V2_READ_ONLY_READY/HOLD with production_writes=0. COMMIT remains fail-closed as BLOCKED_V2_COMMIT_NOT_WIRED / V2_GOVERNED_WRITER_MAPPING_REQUIRED. The unreachable legacy production handoff is not used for V2 commit.

### Acceptance caveat
PR #608 is merged and diff-reviewed, but connector editing alone does not prove Node test execution or a production READ_ONLY run. Do not claim production COMPLETE until runtime acceptance is executed and V2 governed-writer mapping + exact readback are implemented and proven.


## V2 governed writer mapping — 2026-10-04
PR #609 merged as `29204d8fa5f5dfe2a25a59f9bcb4825fe2ccbe9f`.

Added `server/kk-ultra-deep-v2-governed-writer.js` and wired safe V2 UPDATE mutations into the existing Admin guard boundary. UPDATE_DATE, UPDATE_VENUE, UPDATE_POSTER and unbooked UPDATE_PRICE compile deterministically and require exact post-write readback. UPDATE_PRICE requires canonical event_id + canonical package template_id; package_type is never guessed as template identity. Any booked price mutation is refused again at writer boundary.

CREATE_EVENT remains deliberately fail-closed: if the V2 plan contains CREATE_EVENT, COMMIT returns BLOCKED_V2_CREATE_NOT_ATOMIC / V2_PACKAGE_AWARE_CREATE_REQUIRED with zero V2 writes. Reason: a new storefront event must be created with package/price semantics proven atomically; creating a bare event first risks an incomplete storefront card.

COMMIT also remains blocked when the V2 plan is HOLD. For update-only READY plans, the writer uses governed Admin actions and V2 acceptance requires write count equality plus every receipt exact-match.

Runtime acceptance evidence at this point: GitHub connector reports no PR-triggered workflow runs for prior merged head `a1311431...`; therefore Node/production runtime execution is not yet proven by CI. Do not label production Full Loop COMPLETE solely from merge evidence.


## V2 package-aware atomic create — 2026-10-04
Initial PR #610 was closed without merge after main advanced and mergeability failed. Replacement PR #611 was selectively rebased on current main and merged as `e38db0a4dc3fa0f55657c62d67e6474da517f236`.

V2 CREATE_EVENT now reuses the existing `kk-governed-storefront-executor.js` instead of inventing a second production create authority. The atomic create plan contains event title/date/venue, verified poster, and three canonical package overrides in the same governed create payload: PHONE_ONLY active at V2 approved target price, LENS_ONLY hidden at canonical lens baseline, PHONE_LENS_BUNDLE active at phone target + lens baseline. All three canonical template IDs must be present in the fresh snapshot; otherwise create fails closed with V2_CREATE_PACKAGE_IDENTITY_REQUIRED and writes nothing.

The generic V2 update executor still rejects CREATE_EVENT; create must use the dedicated package-aware path. The governed storefront executor retains duplicate/tombstone contract requirements and exact storefront readback. V2 COMMIT combines update receipts and create receipts; acceptance requires every receipt verified and total production_writes equal planned_mutation_count.

No production COMMIT was executed during this implementation. GitHub connector returned zero PR-triggered workflow runs for merge SHA `e38db0a4...`, so CI/runtime acceptance remains unproven from Actions. Next operational gate: execute a fresh V2 READ_ONLY run on current deployed/runtime binding, inspect HOLD/score/coverage/mutation plan, then only execute COMMIT if runtime is current and plan is READY; verify canonical + storefront exact readback.


## Operational acceptance / deployment audit — 2026-10-04
Vercel production is still deployment `dpl_8xqonqLFnB84QN2WqwELKaaYjW9V`, READY target=production, Git SHA `12c7b0f3fbd0d4cf2e0b992c1bbbeca0cfccce88`. This is older than V2 atomic-create main `e38db0a4...` and acceptance-gate main `86ea736d...`. Therefore production V2 READ_ONLY/COMMIT was NOT invoked: doing so would test stale code and cannot establish V2 acceptance.

Latest relevant V2 preview observed READY: `dpl_4vKxzHojqD7mvC9aybnsEpwkerqt`, branch feat/ultra-deep-v2-3-runtime-adapter-20261004, SHA `5987741834af65568c98ee3164db9cc2cae13958`; it predates governed writer + atomic create and is not sufficient for final acceptance.

Vercel connector exposes a deploy action name but invocation returned tool-not-found; no supported promote action was available in the connector surface. No paid browser fallback was used.

PR #612 added `.github/workflows/ultra-deep-v2-acceptance.yml` plus package.json syntax coverage for all V2 modules, merged as `86ea736d7e125609066924172b1b9148bfd91853`. PR workflow run `37148932957`, job `111278517372`, concluded failure with zero job steps and unavailable log blob. Classification: RUNNER/PROVISIONING failure before code execution, NOT a V2 regression-test failure. Do not spam reruns until runner allocation is healthy.

Current blockers are operational, not an identified V2 code defect: (A) production deployment stale; (B) GitHub-hosted runner provisioning unavailable. Required next evidence: current-main Vercel READY deployment, production binding/readback to current SHA, fresh V2 READ_ONLY with production_writes=0, then COMMIT only if plan READY, followed by canonical/storefront exact readback.


## Definitive production deployment blocker — 2026-10-04
PR #613 fixed a real runtime scope mismatch in `api/kk-admin-guard.js`: both Ultra Deep admin entrypoints now default to `Bangkok Metropolitan Region Thailand` rather than `Bangkok Thailand`, aligning production execution with the V2 Bangkok+vicinity coverage contract. Merged as `d21d5db5c22894f52a184119e4f7c4cc9b14940c`.

A prior docs-only deployment-witness branch did not create a deployment because `vercel.json` intentionally enables Git deployment only for main and `scripts/vercel-ignore-build.js` intentionally ignores docs/tests-only diffs. This was expected behavior, not deployment proof.

After #613, the main commit contained an actual runtime change and therefore correctly requested a Vercel production build. GitHub combined status for `d21d5db5...` reports Vercel state=FAILURE with target reason `build-rate-limit`. This is definitive evidence that the remaining deployment blocker is Vercel build quota/rate limit, not ignore-build and not an identified V2 code failure. Vercel deployment list still shows production `dpl_8xqonqLFnB84QN2WqwELKaaYjW9V` at stale SHA `12c7b0f3...`.

Do NOT trigger more no-op builds while rate-limited. Do NOT run V2 COMMIT on stale production. Resume sequence when quota is available: deploy current main (>= d21d5db5) -> verify READY production SHA -> V2 READ_ONLY October with production_writes=0 -> inspect coverage/rentability/HOLD/mutations -> COMMIT only if READY -> exact canonical/storefront readback -> record Full Loop acceptance.


## Evening acceptance recovery — 2026-10-04
Production is no longer the original stale V6.21 runtime. Vercel deployment `dpl_H7akCd2swfZ3Jci2cg1zf55UXZPg` is READY target=production at SHA `e1afe310afa46ec69290baef6e1dd6dd2fb316b1`. Repository inspection at that exact SHA confirms both Ultra Deep Admin entrypoints contain `Bangkok Metropolitan Region Thailand` and the V2 governed writer, rentability score, and runtime adapter files are present. Therefore the minimum V2 production-runtime deployment gate is satisfied even though current main has advanced with unrelated Admin Inbox cleanup.

Attempting an authenticated Vercel fetch of production `/api/kk-admin-guard` through the connector failed at Vercel Authentication: HTTP 401 `deployment_authentication_required`; the connector's reused share-link authentication was not accepted. No auth bypass and no business write was attempted. READ_ONLY has therefore NOT executed yet.

GitHub V2 acceptance run `37148932957` was retried once now that infrastructure had changed. Retry was accepted, but new job `111428741623` again completed failure with no steps, confirming runner/provisioning failure before code execution. Do not rerun-spam.

Current gate classification: V2 minimum production runtime = PASS; production business writes = 0; READ_ONLY invocation = BLOCKED by authenticated execution path; GitHub focused tests = BLOCKED by runner provisioning. Next safe action is to use an existing authorized server-to-server/OIDC execution path when available, then run October READ_ONLY with commit=false and verify production_writes=0. Do not request or expose owner PIN merely to bypass this gate.


## Machine READ_ONLY bridge recovery — 2026-10-04
Inspection found an existing governed machine acceptance path in `api/kk-scanner-dispatch.js`: a canonical command is claimed through `admin-write-control-oidc`, the GET READ_ONLY path forces `executeWrites:false`, and a nonzero production write count is rejected by `READ_ONLY_WRITE_INVARIANT_BROKEN`. This is safer than using the owner Admin PIN and was retained.

Two bridge defects were fixed in PR #623: machine execution still hard-coded `Bangkok Thailand` instead of the V2 Bangkok Metropolitan Region scope, and machine responses were mislabeled V26. PR #623 merged as `8c4ddb9bcece6b3f74cf0ff9ce709740542af186`; it preserves existing OIDC command authority and write invariants, changes the machine/default scanner location to `Bangkok Metropolitan Region Thailand`, and reports `ULTRA_DEEP_V2_READ_ONLY_GET` / `ULTRA_DEEP_V2_MACHINE` plus `UltraDeepDirect.VERSION` in evidence.

Vercel production deployment `dpl_7kWDtwQ52DbMPWnJWBhccHyEPo5t` for exact SHA `8c4ddb9...` built successfully and is READY target=production with production aliases mapped. Build completed without a code error; only non-blocking Node engine/middleware warnings were observed.

Do not fabricate a `readonly_command_id`: the machine path requires a canonical command already present in the command ledger and claims it through governed write-control. Next acceptance action is to obtain/use the canonical October 2026 READ_ONLY command through the existing command creation/approval mechanism, then call the production machine GET path and verify `business_writes=0`. COMMIT remains forbidden until that result is READY/COMPLETE and inspected.


## First governed October V2 READ_ONLY execution — 2026-10-04
Canonical ledger inspection found an existing October command `a4cefd53-c968-4d92-b907-42095397eddd` with `month=2026-10`, `commit=false`, `state=PENDING`, `production_writes=0`. It was invoked through the production V2 machine READ_ONLY GET path. The command was successfully claimed (state became RUNNING), proving Vercel production OIDC -> admin-write-control -> command ledger authority works end-to-end.

The scan did not finish within Vercel's 300-second function duration. Runtime evidence reports `Vercel Runtime Timeout Error: Task timed out after 300 seconds` on `/api/kk-scanner-dispatch` at the exact current V2 production deployment. No production/business writes occurred. Because the process was killed before its completion callback, the command remained RUNNING; it was explicitly recovered to `FAILED` with `production_writes=0` and `error_code=VERCEL_RUNTIME_TIMEOUT_300S` so the ledger is no longer stuck.

This changes the blocker classification: auth, command governance, V2 deployment, and READ_ONLY write protection are proven; the first real October scan blocker is execution duration. Do not retry the same monolithic request. The next implementation must checkpoint/split discovery-verification-pricing/planning across bounded executions or move the governed command to a runtime that can exceed 300 seconds, while preserving command ledger identity, fail-closed semantics, and zero-write READ_ONLY invariant. COMMIT remains forbidden.


## V2 READ_ONLY duration repair and second production run — 2026-10-04
Root cause inspection showed the monolithic wall-clock was dominated by sequential discovery/reference sweeps. PR #624 preserved the known-miss-first probe and all existing source/query coverage, but runs the independent main discovery and reference sweep concurrently using the provider executor's existing bounded MAX_CONCURRENCY=8. It merged as `f604d3a1b39a82bb3b0cc3c3611de16c2e38f36e` and deployed READY to production as `dpl_AR5o5iC2d8KgN46mWbLbvtfA5mBB`.

A fresh canonical October READ_ONLY command `6f9046f2-e3c3-4836-a894-149f8ad16eff` was created in `kk_ultra_deep_commands` with commit=false and executed on that production deployment. Unlike the first attempt, it completed its request lifecycle in about 238 seconds (claimed 12:29:50Z, completed 12:33:48Z), below the 300-second limit, with `production_writes=0`. Therefore the 300s timeout/stuck-RUNNING defect is resolved for this observed run. The command ended FAILED with generic `FULL_LOOP_NOT_COMPLETE`, so COMMIT remains forbidden.

PR #625 (`5ade62ad5696c7b439a6804b6823dc25f05ac241`) improves fail-closed diagnostics only: when V2 has no top-level blocker array, command completion now persists `result.status` before falling back to `FULL_LOOP_NOT_COMPLETE`. This does not change auth or write authority. Its production deployment `dpl_As4UePT1wsuan7p7fv13vG5x6YiZ` was queued at handoff update time. Once READY, create a new commit=false October command and run READ_ONLY once; inspect the resulting terminal status and repair only that evidenced gate. Do not re-open COMMIT until READ_ONLY returns complete/ready with zero writes.

## Discovery diagnostic continuation — 2026-10-04
Fresh baseline: main `29c0a2c339ea39c74e53e868deec2ffa32a766db`, production `dpl_BbYBkvtBEb5wtKWVfgWUh8SVeSMW` READY at that SHA. Canonical command `180febd4-7305-4ee2-b3d7-f11654ff4005` was read back from the production write-control project `mxjnjujqjybqughsnqbz`: FAILED, BLOCKED_DISCOVERY_NOT_FULL, claimed 13:17:32.360234Z, completed 13:21:29.368600Z, production_writes=0.

The exact failing inner gate is not yet exposed by production. Proven diagnostic defect: machine GET/POST discarded nested discovery blockers/proofs. This patch adds a bounded projection of fixed gate booleans, counts and per-task provider receipts. It excludes raw provider payloads, queries, URLs and raw errors; it changes no FULL condition, provider execution order, command authority or write path.

Validation: diagnostic regression failed before patch and passes after; runtime + HTTP behavioral tests 24/24; npm run check succeeded. Full npm test has 21 failures both on untouched main (1344/1365 pass) and diagnostic patch (1347/1368 pass); no new failing test. Existing failures include stale direct-test imports/assertions, monthly tier count, V2 scoring expectation, safe-skip runtime expectation and unrelated Admin/storefront/provenance checks. Full suite is NOT PASS.

Current live policy inspected: one active global POLICY_VERSION v4.9.44; inherited Ultra Deep v5.0.6 same-run remediation/exact-readback gates active. Known-miss live recall remains separately reported from deterministic fixture regression; neither is claimed runtime-complete here.

Next: independent diff review, exact-SHA diagnostic deployment, fresh canonical October commit=false run, inspect diagnostic gates before selecting a provider fix. READ_ONLY acceptance and COMMIT remain NOT COMPLETE; business writes in this continuation=0.


## Post-Codex continuation — 2026-10-04
Codex merged PR #628 as `cbc683d5ef28e67175da095d1438ff0031b5623c`, adding bounded discovery diagnostics to the governed machine response. A subsequent October READ_ONLY command `7ccfaecf-6e2d-41aa-9823-2946cea8109c` still ended FAILED/BLOCKED_DISCOVERY_NOT_FULL in ~237s with production_writes=0, but the long-running HTTP caller timed out before the response body could be captured.

PR #629 was then added and merged as `c59334ffcf11d80005660634db18fe84a9b23542`: failed commands now persist the first bounded inner discovery blocker into the canonical command ledger. Production deployment `dpl_9KMQ1QUHvovPDiK7bR2XbQkAA1xa` is READY at that exact merge SHA. Fresh October READ_ONLY command `678b2be8-29f7-4afd-8ac2-b790319857e8` ran from 14:23:42Z to 14:27:39Z (~236.5s), ended FAILED with `error_code=UNKNOWN_URL_SEARCH_PREFLIGHT_FAILED`, and kept `production_writes=0`. This proves the next root cause is the unknown-URL live-search provider layer, not auth, governance, timeout, booking/tombstone policy, or write safety.

Production environment inventory (names only, values not read) has no `KK_SEARXNG_ENDPOINT` or `KK_DDGS_TRAFILATURA_ENABLED`. Current provider factory therefore binds built-in DDG_HTML/BING_HTML by default; SearXNG is unbound; the existing DDGS fallback code is present but not enabled in production and relies on a Python `ddgs` package that is only explicitly installed in GitHub acceptance workflows, not by the current Vercel Node deployment.

PR #630 adds only bounded provider/status persistence for preflight failures (no URLs, queries, raw errors or payloads), so the next production run can distinguish DDG/Bing NO_EVIDENCE vs PROVIDER_ERROR. It merged as `e22b4fc9c17fe4a6dd14e0381eae67c0592a2b2e`. Its preview deployment `dpl_BonJ9Tp1NWnJoHAzqdkNXaoFZVcA` is READY, but the main/production build was rejected by Vercel with `build-rate-limit`. Do not promote the preview blindly because preview deployments use Preview-scoped environment variables whereas this machine path depends on Production-scoped OIDC/admin secrets. Current safe blocker is therefore: production deployment quota for #630, then one fresh commit=false October READ_ONLY to capture exact provider statuses. COMMIT remains forbidden and business writes remain zero.

## External-demand + fandom discovery lock — 2026-10-06

Owner corrected the business objective: Ultra Deep must discover broadly, but storefront publication must optimize for external phone-rental demand. KK bookings/revenue/waitlists/inquiries are not scoring inputs.

Forward rule:
- External Demand Score uses competitor rental activity 30, public social engagement 20, ticket demand 15, fandom photo intent 15, venue capture value 10, historical external rental activity 10.
- PRIORITY >=75; publish gate >=60; WATCH 45-59.9; REJECT <45; insufficient evidence => VERIFY_MORE.
- VERIFY_MORE/WATCH/REJECT new candidates are forbidden from CREATE_EVENT.
- No competitor/commercial override may bypass the >=60 hard gate.
- KK booking/full/waitlist/inquiry outcomes feed discovery priority and Fandom Graph expansion only.
- Monthly discovery adds competitor-rental radar, rental keywords, FAN_EVENT long-tail formats, announcement/change detection and hot-fandom expansion.
- Canonical contract: `docs/ULTRA_DEEP_EXTERNAL_DEMAND_DISCOVERY_V3_2026-10-06.md`.
- production_writes remain 0 in planning/scanning; no deployment or COMMIT authority is changed by this patch.

