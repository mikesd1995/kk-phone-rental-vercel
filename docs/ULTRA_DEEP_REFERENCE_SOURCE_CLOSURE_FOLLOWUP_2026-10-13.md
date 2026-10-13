# KK Ultra Deep October — Reference Source Date Closure follow-up
**Date:** 2026-10-13 (Asia/Bangkok)
**Task:** Finish source-level repair of October Independent Reference Recovery and save verifiable cross-chat evidence.
**Repository:** `mikesd1995/kk-phone-rental-vercel`
**Branch:** `audit/ultra-deep-panpuri-oct21-20261013`
**PR:** [#720](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/720) (DRAFT, UNMERGED, UNDEPLOYED)
**Issue:** [#719](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/719)
**Authorization/scope:** isolated code, tests and GitHub documentary evidence only. No paid provider, GitHub-hosted runner retry, Vercel deployment, Google Sheets write, price/booking/inventory/poster mutation or merge.

## Why Phase 4 was not end-to-end complete

Phase 4's Runner V16 admitted high-quality `event_date:null` independent leads into the Verifier candidate pool and Reconciliation V3 counted them as hard coverage gaps. However, the monthly Runner NEVER consumed the Verifier's source-backed date as a new reconciled reference during the same read-only scan. As a result, *even a legitimate exact-match October JSON-LD primary Event could not resolve the undated gap*, leaving `FULL=false` indefinitely unless some other provider independently supplied a dated hit. The Direct V28 diagnostic on FULL-HOLD was read-only, but its output was not fed back to the primary Reconciliation.

The offline 12-shard merger likewise needed to expose a separate actionable pending-date blocker instead of only generic reconciliation failure.

## Applied source changes on Draft PR #720

1. **`server/kk-ultra-deep-reference-source-resolution.js` V2 — NEW:** Bounded read-only primary-source resolution of at most four explicit, previously scoped undated references, two concurrent fetches, <=5s per fetch and respect for the inherited Runner deadline. The Verifier must return the exact source-linked candidate, target-month `YYYY-MM-DD`, primary ticket/event host, exact event detail page, valid venue and authoritative event evidence. Otherwise the lead stays `HOLD_PRIMARY_SOURCE`, `BUDGET_EXHAUSTED`, `LOOKUP_LIMIT_REACHED` or another explicit HOLD.
2. **No unsafe navigation:** Source Date Resolution forces HTTP `redirect:'manual'`, rejects 3xx/redirected or altered final source URLs, and does not elevate self-attested JSON-LD on untrusted publisher domains. Source scope also rejects localhost, literal IP/IPv6, internal/local origins, malformed/off-month calendar dates, generic home/search/group/category pages and fake ticket-hostname suffixes.
3. **`server/kk-ultra-deep-runtime-runner.js` V17:** Resolves the eligible independent reference's `event_date` from the primary-source Verifier BEFORE recomputing recovered candidates, `Reconciliation.reconcileCandidateSets` and known-miss live evidence. `source_date_verified:true` is *coverage evidence only*, never automatic owner/business permission. Public/live path uses bounded source verification; `use_only_injected_providers:true` remains offline by default unless `reference_source_verification:true` with controlled `referenceFetchFn`. Unverified sources still block FULL.
4. **`server/kk-ultra-deep-direct-zero-cost.js` V29:** Reuses the Runner's sanitized source receipt on FULL-HOLD instead of refetching the same source again. The legacy fallback still performs bounded read-only inspection if no Runtime attempt happened. Neither path can proceed to the governed writer while FULL is blocked, including commit-intent.
5. **`server/kk-ultra-deep-readonly-shards.js` V2:** Shard merger adds `REFERENCE_SOURCE_DATE_VERIFICATION_PENDING` blocker and `reconciliation.pending_source_date_count` diagnostic. No local shard receipt is ever deemed a Production FULL/release certificate. The V2 fingerprint is intentionally incompatible with older V1 shard reports.
6. **`package.json`:** Adds `tests/kk-ultra-deep-reference-source-resolution.test.js` to existing `test:ultradeep:recall`, plus syntax checks for the new implementation/test.
7. **New regressions:** `tests/kk-ultra-deep-reference-source-resolution.test.js` has 14 cases (trusted source, wrong month/venue/title, source outage, owner-only popup, deadline, four-event cap, fake primary publisher, redirects and IP/localhost SSRF, runtime provider→source date→FULL reconciliation and injected-only no network). `tests/kk-ultra-deep-reference-date-recovery.test.js` gains a duplicate-HTTP-fetch prevention case. `tests/kk-ultra-deep-readonly-shards.test.js` gains all-12-shards synthetic receipts with a missing-date source hard HOLD.

## Validation and precise limits

**A. Exact-GitHub-source JavaScript isolated regression:** **105/105 PASS** across the 6 relevant earlier modules/suites after SourceResolution V2 and Direct V29; separate offline-shard suite **9/9 PASS** after fixing *test-harness-only* fake crypto fingerprint and hashbang handling. Every test executed against current GitHub branch JavaScript using V8 with mocked Node modules/public providers. No paid or live source calls. **NOT native Node/CI**.

**B. Native Node isolated source validation:** The *exact* new `server/kk-ultra-deep-reference-source-resolution.js` file was manually materialized into an isolated local Node 22.16.0 test workspace. `git hash-object` returns **`71c076c7c5bd674175cd4c97c438f0ce0ae8ae7f`**, exactly matching GitHub's blob SHA for SourceResolution V2. Command: `node --test /mnt/data/kk_ultradeep_native_smoke/tests/source-resolution-native-smoke.test.js`; **11/11 PASS, 0 fail, exit 0**. Test dependencies `CandidateVerifier` and `Reconciliation` were isolated mocks (NOT exact source), so this is proof of Node syntax/execution of this exact *one module* and fail-closed control-flow, **NOT a complete native project test**. Initial smoke 10/11 was due to a mismatch between the mock verifier's uncaught redirect exception and the real verifier's handled fetch-error contract; only the local smoke assertion was corrected, followed by 11/11 PASS. The GitHub source file was unchanged by the smoke assertion correction.

**C. Hosted GitHub CI:** Two independent workflows on the PR repeatedly show `conclusion=failure` with `steps=null` and 404 `BlobNotFound` job logs. No supported evidence Checkout or Node actually ran. This is a **pre-execution/runner-provisioning/access-style failure**, *not proof of any application test assertion failure*; account billing/Actions permission/policy root cause is not independently confirmed. Do not spend/add a payment method/top up or rerun expensive hosted jobs merely for a green label. GitHub's published Actions documentation notes normal jobs have `Set up job` and `Complete job` steps: https://docs.github.com/en/actions/how-tos/monitor-workflows/use-workflow-run-logs.

**D. Live production/business readback:** During this follow-up, Vercel alias `kk-phone-rental.vercel.app` still pointed at Production deployment **`dpl_7TYLb87ir9qNzXRtkeb49543dwVm`**. Google Sheets checked PAÑPURI `EVT-20261021-PANPURI-PHUTATCHAI-THAI-POPUP` remains present in Backend Core, while direct Tracker searches for PHUTATCHAI in Candidate Queue, October monthly and Miss Learning return zero. This is explicitly **not an authorized Tracker backfill**.

**E. Live October 12-shard/144-task/646-variant scan:** Still **NOT RUN** on a trusted zero-cost public provider host. Zero new public-provider receipts and zero claimed source-recall FULL. Synthetic 12-shard regression does not count toward real coverage. Neither GitHub CI failures nor synthetic provider responses certify a Production release.

## Exact safe next acceptance plan (NO silent writes)

1. Obtain a trusted free checkout of PR #720's exact SHA and run Node 20+ `npm run check`, `npm run test:ultradeep:recall`, `node --test tests/kk-ultra-deep-readonly-shards.test.js` and the V2 source contract. Retain stdout, exit codes and exact tested commit. Never equate partial isolated tests with green full CI.
2. Resolve GitHub Actions pre-runner failure through repository Settings → Actions permissions and repository/account usage; if still zero-step/BlobNotFound, use GitHub Support with run IDs. No automatic spending, top-up, or self-hosted runner deployment.
3. Run actual free public-provider October 12 shards on a trusted Node host, with `--plan` first, safe read-only command then merge; retain source receipts, time budgets, known misses, exclusions, blocked and undated references. A bounded Source Date Resolution receipt must never be mixed up with an independent, verified full-source report.
4. Validate PAÑPURI 21 October official source and invited/access/photography/telephoto-lens rules; do not call owner-added Core a scanner discovery. Other booked/owner-hidden October events stay protected.
5. Only after owner authorization + correct governed writer + exact row/readback can Tracker rows be written. No direct Sheets patching or duplicate event creation.
6. Continue release HOLD until all separate Native CI, Live Full Provider, owner booking/tombstone and storefront Production acceptance gates pass; then seek owner release decision, not automatic Merge/Deploy.

**Final scope status:** Source-level closed-loop bug repaired and tested with explicit limits. Entire KK Ultra Deep Production project remains **HOLD**.
