KK Phone Rental — DEPLOYMENT SAFETY NOTICE
Updated: 2026-09-22

CRITICAL — GOOGLE APPS SCRIPT REMAINS FAIL-CLOSED FOR PRODUCTION DEPLOY

The exact owner-recovered Apps Script 9_5_9 source is now staged in the review branch for provenance and Gate 2 hardening.

Verified source state:
- Recovered baseline reports v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX.
- The recovery artifact was captured before behavior changes and committed as a dedicated provenance commit.
- The review branch adds return_time persistence plus reservation-window collision hardening on top of recovered 9_5_9.
- The staged behavior candidate is versioned `v16.7.0_CRM_PRO_PHASE3_9_5_10_RETURN_TIME_ATOMICITY_CANDIDATE`; this version is NOT live.
- Production Apps Script remains the authoritative live deployment until controlled acceptance completes.
- GitHub issue #9 tracks source recovery/equivalence and deployment authorization.

DO NOT:
1. DO NOT deploy this review branch to Apps Script merely because GitHub CI or Vercel Preview is green.
2. DO NOT create or replace a production Apps Script deployment until owner-authenticated source/project identity is proven.
3. DO NOT change the live Apps Script deployment before timezone and installed-trigger inventory are read back from the owner-authenticated Apps Script project.
4. DO NOT use synthetic booking/event rows as deployment acceptance.
5. DO NOT treat a version label, API 200, Vercel Preview, or static source diff as proof of live Apps Script equivalence.
6. DO NOT overwrite production with historical repository 9_5_8.

REQUIRED BEFORE ANY APPS SCRIPT DEPLOY:
1. Confirm the exact live Apps Script project/deployment identity using the authorized owner account.
2. Confirm the recovered 9_5_9 baseline preserves all live production behavior that must survive the patch.
3. Review the exact diff from recovered 9_5_9 to the return_time/collision hardening.
4. Require GitHub regression tests to pass on the exact PR head.
5. Fresh-read Apps Script project timezone and installed triggers; record mismatches without silently mutating them.
6. Perform a controlled deployment only after the above evidence is durable.
7. After deployment, perform one legitimate authenticated Admin write acceptance using real owner-directed business work, then exact-read the resulting booking and audit record. No synthetic acceptance row.
8. Confirm no retry/duplicate write and no cross-day asset collision regression.

STAGED GATE 2 BEHAVIOR:
- createBooking accepts optional pickup_time and optional return_time and persists both.
- updateBooking can update or clear return_time.
- snapshot exposes persisted return_time.
- blank pickup starts reservation at 00:00 Bangkok on event day.
- blank return reserves through 06:00 Bangkok next day.
- return_time <= pickup_time is interpreted as next-day return.
- picked_up with no return_time is treated as open-ended.
- physical asset collision checks run inside the same Apps Script DocumentLock immediately before writes and include overlapping cross-day windows.
- Vercel booking preflight uses the same return_time semantics.

VERCEL / FRONTEND
- Vercel changes continue through pull request review and current CI/Preview gates.
- A successful Vercel deployment never authorizes Apps Script deployment by itself.
- Public/read-only fallback and existing production data remain unchanged by this review branch until an explicit production cutover.

CURRENT SAFETY RULE
Recovered 9_5_9 is now available for review, but production Apps Script stays protected until owner-authenticated project evidence, exact-head tests, controlled deployment, and real authenticated write acceptance all pass.
