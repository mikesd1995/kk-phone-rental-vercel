# KK Phone Rental — October 2026 Ultra Deep resumable recovery
**Handoff timestamp:** 2026-10-10 00:14+07 and follow-up same session
**Status:** SOURCE PREVIEW TESTED / PRODUCTION FULL LOOP **NOT ACCEPTED**
**Owner constraints:** 0 paid topups; 0 unapproved business/booking/price/visibility writes; owner-hidden tombstones persist; any active booking date excludes other new/promoted events; no automatic X posting or booking confirmation.

## 1. Actual infrastructure ground truth
- Production https://kk-phone-rental.vercel.app/ — latest observed Vercel READY, deployment `dpl_AmYtTipVdrzuT1i5XdYBGp3wdY1L`, **main** SHA `69390a94972b8c636317bbf00d62ab677c0cc66f`. None of the PR #680 source hardening has been merged to Production.
- Supabase unified OIDC control-plane project `mxjnjujqjybqughsnqbz` is ACTIVE_HEALTHY. Public `kk_ultra_deep_commands` read-only audit: 9 October commands (8 FAILED, one historical control-plane COMPLETE, **all commit=false / production_writes=0**). Two most recent Oct6 runs FAILED with `BLOCKED_NO_VERIFIED_CANDIDATES`. Historical `COMPLETE` is *not* an accepted live Full Scan.
- `/api/kk-scanner-dispatch` Production GET reports `KK_ULTRA_DEEP_MACHINE_V26` and legacy External Scanner/Witness `execution_enabled=false`. The legacy readiness flags should **not** be misread as OIDC queue readiness; the queue actually reached Verifier in prior READ_ONLY Oct attempts. V27 ingress acceptance on Production and exact readback are not proven.
- Draft PR #654 (Verifier V4) and Draft PR #655 (Booking-day/State Consistency/Evidence) remain source overlaps; do not blindly merge them or trust a conflicting old base.
- GitHub Actions `Ultra Deep V2 Acceptance` run `37956878434` previously failed with missing step logs (`BlobNotFound`). Re-run was requested but a passing GitHub Actions receipt remains absent.

## 2. Source fixes already on Draft PR #680
1. October source registry, query plan, date-scoped known-misses, independent-artist/mall/brand/social recall and Learning Agent V9. Incorrect `Sapphic Vampire Lair` nightclub false-positive removed from required rental fandom misses.
2. Source Registry V11 rejects month/source identity/query mismatches. `NO_EVIDENCE` from an unrelated query cannot certify FULL coverage.
3. Full Worker/Runner require strict live date-scoped known misses, not synthetic legacy tests. Verifier V4 can read authoritative dates/posters from exact event URLs without bypassing External Demand publication gate.
4. Provider Executor V6 bounded 210s overall execution and hard `!budgetExhausted` completion gate. Interrupted tasks are incomplete, never `NO_EVIDENCE` completed.
5. Booking-day exclusivity and exact repeated-event/date-sibling protection (DAOUOFFROAD Oct30 and Oct31 are separate; official postponement needs explicit canonical ID and evidence).
6. **New State Consistency V3** in `server/kk-ultra-deep-state-consistency.js`: compare active booking **date + event ID**, owner-hidden locks, Core event active and Web Ready show/show_full; blocking contradictions before V2 read-only plan. Returns no-write violations rather than auto-changing cards.
7. **New shard checkpoint contract** `server/kk-ultra-deep-shard-checkpoint.js`: 16-task max; immutable month, phase, plan fingerprint, source-query hash, exact segment index; fail closed on missing, duplicate, interrupted and tampered results. **Checksum is not cryptographic issuer authentication** and never grants FULL/publish.
8. **New resumable phase engine** `server/kk-ultra-deep-month-shard-runner.js`: known-miss → main discovery → reference; 18-second bounded one-shard execution; authenticated external checkpoint store/list bridges; resumes first missing segment after a valid stored segment. Even all segments assembled return `SHARDS_ASSEMBLED_NEEDS_VERIFIER`, **not** Full Scan or Publish eligibility.
9. **Proposed storage** `supabase/migrations/20261010002000_ultradeep_readonly_scan_shards.sql`: service-role-only RLS, immutable append-only rows, foreign key to preexisting `kk_ultra_deep_commands`, unique phase+shard ID, strict commit=false and RUNNING command RPC, batch<=16, production_writes=0. **Migration has NOT been applied to the actual Supabase project.**
10. **Proposed OIDC auth endpoints** in `supabase/functions/kk-admin-write-control/index.ts`: authenticated `shardReceiptStore` and `shardReceiptList` with size/hash/schema checks. `server/admin-write-control-oidc.js` exposes wrappers without service key in Vercel. **Edge code has NOT been deployed to Production.**
11. Existing owner source-of-truth Google Sheets, live prices and storefront remain untouched. `production_business_writes=0`.

## 3. Reproducible tested exact source
- Combined source code/test SHA: **`b9984d458e82c3aaa628654f97fac553fac2e7ed`** (before this documentation-only commit).
- Vercel Preview **`dpl_JAtS1VWuHHqNNyTUeEYR7ugnrTA3` READY** with build/postinstall **135/135** Ultra Deep/Provider/Checkpoint/State Consistency/OIDC Storage/Month Shards/Verifier/Booking tests PASS, 0 failing; **1/1** original poster integrity test PASS.
- Tests are synthetic injected-provider source proof, not evidence of live Provider coverage, not endorsement of 10–20 market medians, and not authorization for a Production merge.
- Earlier checkpoint SHA `32e3cfca8ddb309e4cd2034e927fda5de89a1700` tested 122/122; state consistency after integration 127/127; OIDC checkpoint bridge `0cd179d71675c6ed1104112af45df8938253dc81` tested 131/131. All newest code included by the 135/135 run.

## 4. Actual business-data issues to reconcile (owner visibility precedence)
Latest read-only Booking/Core/Web Ready evidence from connected Google Sheet prior turn:
- Oct 18 **OH MY FOURTH** 2/2 phones booked.
- Oct 23 **LYKN REFLEXION** 2/2 booked.
- Oct 24 **LYKN** 1/2 booked; owner rule excludes other event even with one available.
- Oct 31 **NCT 127** 2/2 booked.
- Oct23 **RoV T-POP** was present `show_full` alongside booked LYKN. This is a **reported potential conflict** with the owner booking-day exclusivity rule, and separately the owner recently directed that RoV be put on storefront; do **not** silently hide, auto-reopen or infer the newest instruction's precedence without authoritative replay. State Consistency V3 will fail closed and report offending event IDs for governance.
- Official primary dates/poster/venue/filming, exact separate event date identity and owner-hidden tombstones must all be checked. Existing owner-hidden event rows must not be reactivated.
- Missing candidate leads from independent schedules (MINDY Oct29, LE7EL Oct15, Miu Caltex Oct19, VVV Oct14/25, AF Halloween Oct30, SNS Oct31 and others) remain **secondary candidate leads** pending official corroboration, not authorized storefront records.

## 5. Remaining release gates (DO NOT mark October complete before these)
1. **Reviewed source integration**: reconcile PR #654/#655, independently inspect PR #680 changes, require acceptance tests and owner booking/date/tombstone precedence, no risky blind merges.
2. **Storage migration**: review and authorize service-role-only RLS migration and OIDC Edge Function update in unified Supabase project, read back actual table/grants/function, demonstrate no public auth, no automatic business writes.
3. **Runtime machine ingress wiring**: implement and test queue-authenticated shard dispatch/claim/continue + safe total bounds and a stop/resume mechanism. The current phase runner and storage are modular but **not yet wired to a Production HTTP ingress**. Do not launch a new duplicate scanner.
4. **Live source corpus**: execute all bounded October source-universe tasks with real no-cost provider attempts and persistent verifiable receipts (not fixture data). Complete exact-date known misses, official lineup changes, canceled/added-round detection. Bound retry and never treat timed-out tasks as successful.
5. **Verifier/Commercial gates**: independently verified exact event date/name/venue/poster and filming/photo permission, external-only demand score>=60, honest independent comparable rental prices (user target 10–20 shops; if insufficient label unverified). Never alter already-booked-day prices.
6. **Production Acceptance**: authenticated queue-bound October `READ_ONLY_ACCEPTANCE` with `commit=false`, current Booking/owner visibility, robust Verifier source proof, Full Loop evidence and actual exact readback to Core→derived Web Ready→public storefront. Stop on any failure; `production_writes=0`.
7. **Governed promotion**: after all conditions pass and appropriate owner approvals, only selected unbooked/unhidden events may be written; check that they actually appear and correct package/price/poster display. No auto X posts, no booked-day other-event offers or hidden-event resurrection.

## 6. Handoff rule across chats
Use **this document** plus `docs/ULTRA_DEEP_OCTOBER_2026_SECOND_PASS_AUDIT_20261009.md` and Issue #672 as the chronological source of truth. Do not tell owner "done" because Source Tests pass; finish only with live October Full Loop + accepted production readback. No spend, no booking/visibility mutations in this turn.

**State:** `SOURCE_PREVIEW_135_135_PASS` / `CHECKPOINT_PERSISTENCE_CODE_PREPARED_NOT_DEPLOYED` / `V27_PRODUCTION_RUN_BLOCKED` / `OCT2026_AUTONOMOUS_FULL_NOT_COMPLETE` / `PRODUCTION_BUSINESS_WRITES_ZERO`.
