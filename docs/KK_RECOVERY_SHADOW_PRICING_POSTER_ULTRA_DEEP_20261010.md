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

**Mutation summary:** 6 code/test/CI commits + this documentation checkpoint in draft PR; NO production business write, no pricing change, no X post, no paid operation, no scheduler activation, no Apps Script edits, no protected-main merge. **Project NOT production-complete.**
