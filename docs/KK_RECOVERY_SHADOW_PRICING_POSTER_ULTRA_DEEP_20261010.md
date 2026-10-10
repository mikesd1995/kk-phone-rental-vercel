# KK Phone Rental — Ultra Deep / Demand Pricing / Poster recovery checkpoint (10 Oct 2026)

**Owner scope:** Skip Booking/LINE/Apps Script Gate 1 for this round. Focus Ultra Deep source/runtime, AI demand pricing, storefront/posters, Marketing/Learning. Do not weaken booking-price/date lock, approved owner price, hidden/tombstone, unique 2-phone inventory or exact readback just because Gate 1 is deferred. No paid credits or auto X publishing.

## 1. Actual SOURCE changes on existing draft PR #680 (no protected-main merge)
1. `9d0bd02f810ae59bb6240a2aeadd7d84072248e0` — `server/kk-demand-pricing-shadow.js`: normalize Google Sheets positive/negative lock flags (`TRUE/1/YES` vs `FALSE/0`), reject string `0`, negative/unknown/fractional inventory and owner collisions. Every blocked suggestion remains `SHADOW_ONLY`, `production_writes=0`.
2. `0539654898fe0224f494bf3841afe8c803071bf7` — two regression tests for Sheets text guards and duplicate booking/outcome source receipts. Learning now deduplicates by `booking_id` / `observation_id` / `source_ref` within event before counting gross/outcome observations and 5-record learning threshold.
3. `e0bc969fce6d3d316dde60320775a932367ec6b5` — strict formatted price parser accepts `1,090` as THB 1090; rejects malformed `1,09`. Prevents `current_prices=null`, missing bundle premiums or undercounted `completed` gross from formatted Sheet prices.
4. `75eda5db4a74c180e45ffba319330749011e1b3c` — regression for current phone/bundle `1,090/1,290`, historical paid phone evidence and `completed` Actual using formatted THB.
5. `6f3bac54baedb884251f218dc732b8d6c14e08a7` — attach `tests/kk-demand-pricing-shadow.test.js` to existing Vercel postinstall `test:ultradeep:recall` acceptance (the previously green 172-case suite alone did NOT run these new price tests).
6. `1b80b8acbc4f507e3a70ba09b349b55f8002dea4` — fix double-escaped digit regex found by the new Preview acceptance: first actual test-gated commit `6f3bac54` failed 1/187 with `null !== 1090`; corrected exact source and Vercel Preview accepted it.
7. All code/test/CI commits above were saved/read back by GitHub Contents API with exact blob SHA checks. Existing repo branch already has a much wider October/November resumable scanner and pricing proposal changes — these new changes are **narrow source hardening**, not proof that the whole PR is accepted. Never describe deterministic weighted pricing as trained ML or proven causal revenue uplift.

**Release status:** PR #680 remains **DRAFT**; main/Production is NOT changed by these commits, live customer prices are NOT changed, no booking/visibility/LINE activity occurred. Do not merge/downgrade gates until real exact-head tests, security, preview and authoritative runtime acceptance pass.

## 2. CI / Vercel execution evidence and fallback
- Current patch test head initially `0539654898fe0224f494bf3841afe8c803071bf7`: GitHub Actions runs **38059577807** (OpenAI Optional Zero-Cost Acceptance), **38059577848** (Ultra Deep V2 Acceptance), **38059577852** (Storefront Automated Visual QA) all report failure with job `steps=[]`. Attempted log retrieval returned HTTP404 `BlobNotFound`, no executable log body. Root cause of runner allocation failure is **not verified**, and no tests can be declared green on these Actions receipts.
- Vercel Preview for first source-only commit `9d0bd02...` is deployment `dpl_4LjFBbrDMW3iTQsgRNsTWzWbn5wQ` **READY**; subsequent observed preview for `05396548...` `dpl_FeEzie4pp1U1QvkSiHQEFzBPcQPL` **CANCELED**. READY at earlier SHA does not prove the final test changes. Newer head(s) must be checked by exact SHA, never infer based on an unrelated green status context. Do not rerun or pay to force hosted CI when jobs terminate pre-step.
- **Validated exact source commit `1b80b8acbc4f507e3a70ba09b349b55f8002dea4`: Vercel Preview `dpl_8jCRJGhRUoUc2kjwgU7ENyTTezup` READY. Build Log explicitly reports `test:ultradeep:recall` **187/187 PASS, 0 fail** including three new Pricing Shadow regression tests; original poster **1/1 PASS**; build/deploy completed. The predecessor `6f3bac54` Preview `dpl_GgxB1zjG3WwQTjX3DocXmVKV2Kk3` ERROR because the newly wired price test caught the over-escaped regex, **186/187 PASS / 1 FAIL**. This defect was fixed at `1b80b8ac`; not suppressed by weakening assertions. Documentation-only commit `8b7c57a` had Preview CANCELED and does not by itself prove tests. Production alias remains unchanged.
- Safe fallback is source-code review plus branch-readback and zero-cost runner/allowance when demonstrably available. **No local Node suite** ran through the connector itself; **actual Node tests executed inside Vercel Preview build at exact source SHA `1b80b8ac`** as described above. GitHub-hosted CI and Visual QA still lack green evidence. Vercel Preview test pass is source acceptance evidence, not autonomous Full Loop or live Production acceptance.

## 3. Ultra Deep real runtime (read-only)
- Actual unified V27 Supabase control-plane project `kk-unified-inbox` = `mxjnjujqjybqughsnqbz`, ACTIVE_HEALTHY. `public.kk_ultra_deep_commands` currently 9 rows: 1 historical `COMPLETE` / `commit=false` / `production_writes=0`, 8 `FAILED` / `commit=false` / `production_writes=0`. Two October 6 latest failures = `BLOCKED_NO_VERIFIED_CANDIDATES`. This is NOT an accepted autonomous Full Loop.
- 10 October read-only schema query showed **no `kk_ultra_deep_scan_shards`/checkpoint table**, and the command table has no typed shard-command column. PR #680 Supabase RLS migration and Edge Function are draft only, not applied; do not claim SHARDED_READ_ONLY live.
- Public Production `/api/kk-scanner-dispatch` still advertises **External Scanner Witness** V26 and `execution_enabled=false`; this distinct witness flag is not an equivalent readback of V27 queue-control readiness.
- No automatic Scanner/Verifier natural persistence, full live source receipt/Verifier pass, production commit or exact Full Loop readback proven.
- Next P0: review PR #680 against overlapping #654/#655 + #681; complete exact-head CI; controlled service-role-only shard migration and authenticated Edge binding ONLY after reviewed gates; run zero-write November `READ_ONLY_ACCEPTANCE` with genuine external source receipts and all known-miss/coverage validations. Do not create duplicate control plane or fake NO_EVIDENCE as executed source.

## 4. Live storefront image audit — actionable backlog
- Canonical Backend spreadsheet `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`, exact `08_Web_Ready!A4:K460`, read-only on Oct 10: **335 data rows**; `show + show_full` = **96**; **10 visible rows have blank canonical `poster_image_url`**. Live `GET /api/kk-data?sheet=08_Web_Ready&range=A4%3AK` HTTP200, IDs present. Blank canonical URLs are a data-quality finding; rendered card/image status was not independently browser-tested.
- Exact **10** currently affected event IDs:
  - `EVT-20261015-LE7EL-1ST-DEBUT-ANNIVERSARY`
  - `EVT-20261017-MANEKINEKO-IDOL-PARTY-HALLOWEEN`
  - `EVT-20261017-THE-PASEO-POP-THE-STAGE`
  - `EVT-20261025-VVV-TORNADO-SHOPPING-XIAOMI`
  - `EVT-20261030-AF-HALLOWEEN-AFTERLIFE`
  - `EVT-20261030-POPPAH4-HALLOWEEN-NAMP`
  - `EVT-20261030-VVV-SHOW-GO-WHOLESALE-RAMA2`
  - `EVT-20261105-MIZUMI-PHUWIN-MOISTURE-MATCH`
  - `EVT-20261106-BRICE-POND-NARAVIT-FAN-EVENT`
  - `EVT-20261102-SUPER-SUN-ZEE-PRUK-BIRTHDAY-FANSIGN`
- Positive correction to prior backlog: Nov LOLLI `EVT-20261126-LOLLI-POPUP-MEW-SUPPASIT`, `EVT-20261127-LOLLI-POPUP-JAMES-SU`, `EVT-20261129-LOLLI-POPUP-EMI-BONNIE` **now have poster URLs** and verified venue notes `Atrium2, G Floor, Siam Center`. Do not report these as still blank. Individual image delivery, official provenance, public attendance/camera rights still require independent verification.
- External search cautions: the MizuMi official poster found via image search was for a **May 2026 Pond–Phuwin Pajamas Party**, NOT the Nov5 event. Do not substitute a visually similar but wrong-event image. November 2 SUPER SUN × Zee Pruk event date/location is corroborated by published secondary media, but its first-party poster URL has not yet been independently grounded in this continuation.
- Required safe fix for each missing row: corroborate exact primary organizer/artist poster and event date+access; immutable official asset storage; owner-approved bounded `01_Events.poster_image_url` update through authorized Admin/write route (not direct `08_Web_Ready` editing); compare Core -> derived Web Ready -> public customer feed -> rendered card. If poster cannot be verified, keep an explicit `HOLD_POSTER_SOURCE_UNVERIFIED` note and no fabricated media or unrelated screenshot. Preserve owner-hidden/booking/pricing fields.

## 5. Priority and frozen state for cross-chat
1. **P0 Ultra Deep** actual stored source receipts, coverage/Verifier, no-write full loop, authorized readonly shard storage binding, natural canonical Scanner/Verifier persistence (existing IDs only).
2. **P1 Demand Pricing Shadow** replay 10+ comparable anonymized real events including high-demand midweek TeeTeePor; verify amount parser, string locks, dedup receipts; compare proposals vs current quoted final price, require owner review and no automated production repricing.
3. **P1 Event posters and sellability** source 10 exact missing posters and verify event entry/photography rights; LOLLI previously blank now URL present.
4. **P1 X attribution** counted `assumed_posted` is NOT verified post publication; owner receives one best draft; train only from actual URLs and completed bookings.
5. **P2 Consolidate source PRs** without erasing latest known-miss calendar work. Keep #49, #368, #677, #686 and this document as cross-chat references.

**Historical 10 Oct earlier checkpoint:** 6 source/test/CI commits and documentation were recorded then; subsequent independently verified repairs are detailed below. No protected-main merge or business write.

## 6. Additional owner-directed implementation — 2026-10-10 ~22:30 Asia/Bangkok (P0/P1 source closure)

**Owner authorized:** continue deep repairs without repeating basic questions. The previously deferred Booking/LINE/Apps Script project #1 remains out of scope. However, ALL booking-date, exact-event, owner-hidden, price lock and inventory safety gates must remain active, including when scanning or suggesting prices.

### A. Terminal Ultra Deep acceptance — fixed from already-reviewed PR #681 safety patch
- **Problem:** old `server/kk-ultra-deep-full-loop-v2.js` coerced missing/ambiguous `planned_mutation_count` and `production_writes` to zero. A result could be labelled `COMPLETE` with no truthful candidate-terminal proof or mutation reconciliation.
- **Repair:** `82e3f4acb117ad0086f015bf868d8bbc0a2262d8` source port from the narrower exact PR #681 patch; strict safe nonnegative integer type evidence, complete candidate disposition and mutations, matching write result and exact readback. No Booking/Apps Script code ported.
- **Regression:** `85495e20766cfc2d997ce2ee577367c7ede2a3aa` adds seven terminal-evidence safety test cases, proving fail-closed on missing/forged counters and correct NO_CHANGE/owner-hidden outcomes.

### B. Canonical Project Memory corpus schema — fixed
- **Problem:** `config/kk-project-memory.json` still contained `kind=RUN_RESULT`, an unsupported type causing `KK_PROJECT_MEMORY_V1` bootstrap fail-closed.
- **Repair:** `9124bedf2128cb1a6a49cd50a76c19ee01b7cd92` switches *only* memory id `kk:memory:october-external-demand-reconciliation:20261007` to canonical `kind=ACCEPTANCE`, keeping its factual summary and evidence.
- **Tests:** `e38efaafed2ac5d5ea4d59e382b4ced2fb02675b` validates entire checked-in corpus and keeps invalid RUN_RESULT rejected (no opening of schema to arbitrary kinds).
- **Durable cross-chat memory:** `999341e30c201fb9d412a2bd8726a1fb176513a3` added IMPLEMENTATION record `kk:memory:ultradeep-terminal-poster-gates:20261010`, referring to this handoff and exact technical evidence. This memory file is SOURCE-ONLY until PR merge, not proof of persisted live Agent learning.

### C. Poster audit false-PASS defect — fixed in source
- **Problem:** `scripts/audit-storefront-posters.js` previously treated a fallback-loaded card as PASS even when `08_Web_Ready.poster_image_url` was blank or primary image had failed. It did not report canonical-missing counts separately.
- **Repair:** `9c55cb2eb70f76f41ff3638dc965d47f9f0759cf` added pure `assessPoster`, `canonical_missing`, `canonical_delivery_ok`, `canonical_integrity_status`, per-event metadata and aggregate `canonical_missing_count`/`canonical_delivery_failed_count`. New CLI audit fails when any canonical is blank/broken, even with a working event-specific fallback; never changes Canonical Sheets/Prod.
- **Tests:** `e3e27e904bfab50d4f7ff3f37a3286109b269aac` added five cases: blank canonical, exact-event fallback, broken original with working fallback, healthy original, and no unrelated poster substitutions. `1e364e54861f4598cddcc1ba210cbfd01428d3f0` wired them into existing Vercel postinstall gate.
- **Actual source of truth audit:** `KK Phone rental backend` `08_Web_Ready!A4:K600` on 10 Oct = 335 rows, **96 public visible** and exactly **10 public rows with missing original poster URL**. The IDs are listed verbatim in §4 above and GitHub Issue #677. 3 LOLLI Nov26/27/29 original URL fields are now nonempty. The verified public customer API previously responded HTTP 200 and contained relevant IDs. No rendered-browser claims and **0 live poster repairs** were made in this continuation because no exact original asset provenance was verified for those 10; never use a May MizuMi poster for a November event.
- **Still required:** obtain 10 primary-source original images with exact date/event provenance and access rights, write ONLY exact `01_Events.poster_image_url` through owner-authorized governed updater, derive `08_Web_Ready`, check public feed and rendered full poster; do not overwrite generated Web Ready or use arbitrary screenshots.

### D. Executed code acceptance: Vercel Preview source test receipts, not synthetic claims
- Commit `f2143d5e23b8766d26f732d978cdf8625eecbcf2` -> Vercel Preview **`dpl_GH9fqjYDjB48AhYcpnWsDjuSPpy2` READY**, build log **202/202 PASS** (Ultra Deep/Pricing/Project Memory/Terminal) and **1/1 original-poster asset PASS**.
- Commit `1e364e54861f4598cddcc1ba210cbfd01428d3f0` -> Vercel Preview **`dpl_98W6UWj8FS8hYtKV5ggqFXJHH43p` READY**, build log **207/207 PASS** (includes five new canonical poster audit tests) and **1/1 original-poster asset PASS**; 0 failures; deployment completed.
- Later `config/kk-project-memory.json` addition `999341e30c201fb9d412a2bd8726a1fb176513a3` is a distinct newer commit: **do not assert its exact-head Preview passed without checking**. If later document commit is canceled/ignored, preserve the last exact executable source test commit evidence honestly.
- GitHub Actions workflows previously failed before job steps with `BlobNotFound` for logs; Vercel Preview was a legitimate no-extra-cost **source/test fallback**, NOT a substitute for formal GitHub-hosted CI, rendered Visual QA, external live Source receipts, authenticated V27 command or full Production release gate.

### E. Actual V27 / cost / governance revalidation
- Canonical Supabase unified control plane `kk-unified-inbox` project `mxjnjujqjybqughsnqbz`: SQL read-only **9** `kk_ultra_deep_commands` (1 old COMPLETE, 8 FAILED), all `commit=false`, all `production_writes=0`.
- No `kk_ultra_deep_scan_shards`/other sharded checkpoint public table; command schema has no typed sharded column. The migration and corresponding authenticated service-role/OIDC readback/Edge control action proposed on PR #680 **have not been deployed**.
- Source Candidate/Verifier still lacks accepted live FULL/known-miss/official coverage receipts, so **NO autonomous monthly FULL status**. A Vercel Preview Ready tests source only; current Production alias still points to `dpl_AmYtTipVdrzuT1i5XdYBGp3wdY1L` unless rechecked.
- Do not rerun paid/hosted pipelines repeatedly just to get green badges. No TinyFish/Make credit spend or user top-up; no extra scheduler, Writer, business price, Booking, LINE or X publication mutations.

### F. Resume instructions in a new chat
1. Start from this doc, PR #680 and Issues #368 / #677 / #49; check latest exact branch/head, not this text's historical commit.
2. Re-read latest exact-head Vercel Preview logs for memory/doc commits and price/candidate/poster CI. Maintain Draft if source gate unproven.
3. Security/review compare PR #680 vs #681 (the two safe repairs above are now included) plus overlapping #654/#655. Avoid merge of stale Apps Script changes.
4. Fix external runtime availability and genuine candidate verification receipts, then service-role-only Supabase shard storage/OIDC **only after auth/security/source readiness review**. Run Oct/Nov `commit=false` and exact target-month Source/Verifier reconciliation. **Business writes stay 0** for read-only gates.
5. Resolve all 10 missing official poster sources; use exact owner-approved data write and Core→derived→public→rendered readback. If no primary art exists, report HOLD, no substitutes.
6. Backtest demand pricing suggestions against 10+ anonymized completed comparable outcomes and 1–2 competitor raw quotes, current owner locks; no model/causal-lift claim. For X, only real publication URLs count toward learning.
7. Mark project final completion only after CI, production command, full independent source proof, Verifier, readback and owner approvals, not source tests alone.

**Current actual outcomes:** additional repairs are SOURCE/PREVIEW tested; live business mutations=0, paid spend=0, Production FULL not accepted. This report and Project Memory SOURCE record explicitly persist across chats.
