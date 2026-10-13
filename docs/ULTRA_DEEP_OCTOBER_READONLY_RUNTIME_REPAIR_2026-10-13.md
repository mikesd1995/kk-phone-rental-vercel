# KK Ultra Deep — October 2026 read-only Runtime repair & local shard fallback

**Date:** 2026-10-13 ICT  
**Branch:** `audit/ultra-deep-panpuri-oct21-20261013`  
**Draft:** PR #720 / Issue #719  
**Release:** HOLD, **no merge, no deploy, no business write, no paid provider execution**.

## 1. Live root-cause receipts (not assumptions)

- Authoritative command control plane: Supabase `kk-unified-inbox` (`mxjnjujqjybqughsnqbz`), `public.kk_ultra_deep_commands`. Read-only SQL on 2026-10-13 finds **nine** October `FULL_READ_ONLY` commands: **eight FAILED**, one early migration acceptance `COMPLETE` dated 2026-10-03. All show `commit=false` and `production_writes=0`.
- Latest FAILED created 2026-10-06 18:56:49 UTC and completed 18:57:09 UTC: `BLOCKED_NO_VERIFIED_CANDIDATES`. Earlier explicit errors: `VERCEL_RUNTIME_TIMEOUT_300S`, `BLOCKED_DISCOVERY_NOT_FULL`, `UNKNOWN_URL_SEARCH_PREFLIGHT_FAILED`, and DDG/Bing/provider-binding failures. Neither the initial COMPLETE nor a schema-level migration health check proves FULL monthly discovery coverage.
- Actual source plans in PR #720 for October: **33 known-miss tasks + 111 monthly tasks (48 source-universe) + 6 independent reference tasks = 150 tasks**; provider query-variant counts **159 + 489 + 31 = 679** before provider fallback. This makes a monolithic 300-second serverless command risky; **not** proof of the cause of every failure.
- In `server/kk-ultra-deep-candidate-verifier.js` V4, date-less generic search/RSS concert candidates were excluded at `prefilter` before source extraction, even though a first-party JSON-LD event page could contain the exact date. This was a **source-proven blind spot**, not evidence that a live provider successfully returned such a result.
- CI jobs generated from the Draft PR have returned failed conclusions with no retrievable job steps and `BlobNotFound` on job log fetch. Do not label the observed failure as either source test failure or purely quota: exact reason unconfirmed.

## 2. Repair in the isolated branch

| File | Change | Invariant |
|---|---|---|
| `server/kk-ultra-deep-candidate-verifier.js` V5 | Let strong event search leads without snippet date reach source verification. Require source JSON-LD dated event, exact October month, and detect candidate-vs-source date conflicts. | Missing/contradictory source date always HOLD; no new publish authority. |
| `server/kk-ultra-deep-provider-executor.js` V6 | Optional absolute deadline checked before each provider and query variant. Record `TIME_BUDGET_EXHAUSTED` and `time_budget_exhausted`. | Skipped tasks do **not** count as `EVIDENCE_FOUND` or `NO_EVIDENCE`. |
| `server/kk-ultra-deep-runtime-runner.js` V15 | Propagate budget into known-miss, monthly, reference, and preflight; return `RUNTIME_BUDGET_EXHAUSTED` diagnostic and `HOLD_FOR_COVERAGE`. | `full=false`, `production_writes=0` if any task was budget-exhausted. |
| `server/kk-ultra-deep-direct-zero-cost.js` V27 | Clamp monthly runtime budget to 210,000 ms maximum (180,000 default), reserving time for snapshot/verifier/price/other stages. | Discovery HOLD cannot enter commercial/writer stage. |
| `server/kk-ultra-deep-readonly-shards.js` | Deterministic fingerprinted manifest and offline read-only shard execution/strict merge. | Reports always `full=false`, `release_eligible=false`, `authoritative=false`. |
| `scripts/kk-ultra-deep-local-readonly-shards.js` | Local CLI for plan, one shard, run-all, and merge with receipt files; excludes paid provider types (`EXA`, `CRAWL4AI`) by allowlist. | No GitHub Actions minutes, Vercel calls, Supabase writes, or publisher API in this CLI. |
| `.gitignore` | Ignore `.ultra-deep-local-readonly/` locally. | Prevent accidental commit of local provider receipts. |
| Tests and `package.json` | New/extended verifier, executor, runtime, shard, CLI tests; syntax and Ultra Deep recall gates. | Fail-close behavior must remain testable. |

## 3. No-additional-cost local run sequence (NOT executed in this chat)

Requires a trusted local Node.js 20+ checkout with existing dependencies and ordinary network access. Run only from the unmerged PR branch, and keep the output directory private. **Do not run on billable GitHub-hosted Actions, TinyFish, Make, or a new Vercel Deployment**.

```bash
npm run ultradeep:readonly:shards -- --month 2026-10 --size 12 --plan
npm run ultradeep:readonly:shards -- --month 2026-10 --size 12 --run-all
npm run ultradeep:readonly:shards -- --month 2026-10 --size 12 --merge-dir ./.ultra-deep-local-readonly/2026-10
```

The plan is **13 shards** at 12 tasks/shard (last shard 6). Each local receipt includes its deterministic manifest fingerprint, exact task IDs, attempt receipts, unexecuted/timeout state and `production_writes=0`. `--run-all` records one shard at a time and skips existing matching receipts; if a shard was incomplete, remove only that specific local receipt file and rerun that shard with `--shard N`. A changed query plan or shard size invalidates earlier receipts rather than silently merging them.

**Key qualification:** The aggregator's `receipts_complete` means only that the offline reports supplied source-attempt coverage and passed deterministic cross-checks. It **never** authorizes Production; even all 13 synthetic or free-search receipts yield `full=false`, `release_eligible=false`. Source-primary verification, confirmed booking locks, owner acceptance, official trusted runtime and storefront exact readback remain separate required gates.

## 4. Executed isolated regression evidence (not actual Node CI)

Executed the precise GitHub branch JavaScript files in isolated V8 with injected provider, Node API, deterministic crypto and mock fetch functions. These are **not** a real Node 20+ filesystem test run, not paid/live web provider execution and not a GitHub-hosted green CI:

- Provider Executor + Runtime Runner: **34/34** pass (includes exhausted deadline returning HOLD and zero writes).
- Candidate Verifier V5: **20/20** pass (dated source, missing dates, date conflicts, Pop-up owner HOLD).
- Local shard module + CLI: **8/8** pass (150-task plan, 13 shards, free-only allowlist, report tamper/duplicate rejection, non-release invariant).
- Previous independent integration and known-miss exercises: **9/9** and **12/12** before the runtime patches; re-run against the final exact HEAD for final acceptance.
- Direct-run V27 isolated stub invocation: `runtime_budget_ms=900000` clamps to **210000**; rejected discovery returns `BLOCKED_DISCOVERY_NOT_FULL`, `production_writes=0`. No real provider called.

## 5. Bounded external-source spot-check (NOT 150-task FULL scan)

Public read-only search on 2026-10-13 inspected PAÑPURI, centralwOrld, PopRadar, Natgan, Zipevent and public October sources. Its scope is **partial** and cannot be promoted to a `FULL` scan receipt.

- **PAÑPURI Oct 21**: owner-added Core event `EVT-20261021-PANPURI-PHUTATCHAI-THAI-POPUP` already `active_on_web=TRUE`, `WebReady show`, phone 490 and bundle 590; no duplicate. Independent online search did not yield an attributable official Beacon 3 artist-appearance announcement. PAÑPURI's own centralwOrld store page describes an unrelated second-floor boutique, *not* the first-floor Beacon 3 event. Keep authority/photography and invited-guest rules on owner review.
- **ONG SEONGWU Oct 31**: direct ticket authority at `https://www.zipeventapp.com/e/letsgoong-bkk` corroborates event date and Muangthai Rachadalai Theatre. Backend `EVT-20261031-ONG-SEONGWU-LETS-GO-ONG-BANGKOK` already exists, `active_on_web=FALSE`; do not reopen against Oct 31 booking-day lock.
- **MINDY Oct 29** already listed `EVT-20261029-MINDY-SHOOT-YOUR-SHOT-FANSIGN`, Active TRUE, with explicit rights warning.
- **NEXORA Oct 24** already listed `EVT-20261024-NEXORA-CARD-FEST`, Active FALSE; booked-date suppression remains.
- **DAOUOFFROAD Oct 30** already listed, Active TRUE.
- **VVV Oct 30** already listed, `active_on_web=TRUE` but `WebReady hide`, missing date authority/poster. Keep HOLD; PopRadar calendar alone does not justify overriding that decision.
- **SAPPHIC VAMPIRELIAR Oct 24** surfaced in PopRadar calendar, but no same-name `01_Events` match in bounded search and no independently verified official event proof. Treat as **unverified candidate only**; Oct 24 is an existing protected booking day, hence **do not auto-add or display**.
- Broad third-party calendars include many small gigs, exhibition and off-target events; item counts there are not evidence of rentability or a count of KK missed events.

Sources for further verification: `https://panpuri.com/th/about/our-stores/discover-our-stores/central-world/`, `https://www.centralworld.co.th/blog`, `https://popradar.app/events`, `https://www.natgan.com/?month=2026-10`, `https://www.zipeventapp.com/e/letsgoong-bkk`.

## 6. Explicit remaining gates / continuation

- **G1 Source-provider live October FULL**: HOLD. None of the 13 sharded batches have been executed against external live providers in this chat; no source-bound trustworthy full monthly receipt.
- **G2 Actual Node/npm and GitHub CI**: HOLD. Runner unavailable from this session; current hosted workflow lacks usable step logs/green status.
- **G3 Independent official PAÑPURI primary receipt / publication timestamp**: HOLD.
- **G4 Candidate Queue / Tracker / Miss Learning governed backfill**: HOLD, do not write production business sheets by side channel.
- **G5 Commercial, inventory, booked dates, tombstone, owner approval, exact storefront readback and merge/deploy**: HOLD. No change to protected business data.
- **Zero-cost next execution**: Use a genuinely free connected local/self-hosted Node environment to execute shard receipts, perform read-only full report independently, then request release acceptance only when other gates are green. This CLI is a safe alternative pathway, not a claim that the October scan has finished.

All changes and evidence remain under Draft PR #720; Owner may decide subsequent gates.
## 7. Follow-up fail-close correction (2026-10-13)

- A resumed shard can have an earlier successful provider attempt **and still exceed its deadline on a later query**. Previously `executionProof` could count the earlier `NO_EVIDENCE` as executed; the offline shard merger must not treat that as exhaustive query coverage.
- Commit `d9b4dd7` therefore marks a shard `SHARD_INCOMPLETE` whenever `time_budget_exhausted=true`, even if earlier provider attempts were valid. `combineReports` now requires explicit `SHARD_TIMEOUT_OR_INCOMPLETE` blocker for those receipts.
- Commit `1ed0fe2` preserves `TIME_BUDGET_EXHAUSTED` in provider and source-universe diagnostic receipts instead of normalizing it to `UNKNOWN`; `0707c71` locks that contract in the Runtime Test.
- Commit `ab56888` adds an interrupted-shard regression; exact branch Shard+CLI isolated V8 validations now **8/8**.
- Original GitHub CI and all 13 live-source shard runs **still unverified**. This correction strictly improves failure reporting and does not declare the October sweep complete.
