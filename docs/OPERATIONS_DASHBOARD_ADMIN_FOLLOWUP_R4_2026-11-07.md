# KK Phone Rental — Admin Operations Dashboard V4 / R4 source-consistency audit

**Date:** 2026-11-07 (Asia/Bangkok)  
**Status:** DRAFT / RELEASE HOLD / NOT DEPLOYED. No Production, Booking, Price, Inventory, Owner Lock, X, ACL or automation writes.

## Repository and scope

- Repository: `mikesd1995/kk-phone-rental-vercel`
- Draft PR: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/851
- Branch: `feat/ops-dashboard-readonly-v4-20261107`
- R3 starting HEAD: `b00dd23bceda56f3b86a7cbb181c0e82edc0c047`
- R4 source/test commits: `f3c611ae2f63117da8826a7bd68ee6ac1e245779`, `3ec47f2e2b344ccfe2730b239038c83ed4494864`, `28f3172fec1affb59889c6b6ccc20c90e99a4f48`, `9f808746f39575399864c361ff575d434c32f941`
- Changed existing PR paths ONLY: `admin/operations-dashboard.js`, `tests/operations-dashboard-readonly.test.js`. This report is a separate documentation change, not an implementation dependency.
- No edits to `admin/index.html`, `api`, `middleware.ts`, `server`, other PRs or `main` in R4.

## Material bug fixes

1. `01_Events.active_on_web=false` and Web Ready `show` with positive packages could previously be presented as ready. R4 requires a matching Core event with `active_on_web=true` and `status=open` before showing a rentable phone package.
2. `01_Events.status=closed` with Web Ready `show` previously displayed an available phone; it now displays HOLD and flags Core mismatch.
3. An orphan Web Ready event ID without a corresponding `01_Events` row previously could present an available phone. It now fails readiness, adds Core QA and gate reasons.
4. `08_Web_Ready.action_for_web=hide` with positive phone packages previously displayed 'พร้อม X เครื่อง'. R4 does not claim ready for hidden/full days.
5. Core vs Web Ready event-date or venue mismatch had a QA warning but still showed 'พร้อม X เครื่อง'. R4 blocks the ready label in addition to the QA/HOLD indicator.
6. QA group and KPI labels now explicitly cover Stock/Core readiness rather than implying the issue is stock only. This is copy/UX scope and still requires registered UX/Visual QA approval.

## Actual read-only backend reconciliation (no PII)

Read 2026-11-07 from the canonical native Google Sheet `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU` using the connected authenticated Google Sheets read API, no mutations. Scope:
- `01_Events!A4:G999`: 438 event records
- `08_Web_Ready!A4:J1000`: 438 event records; 93 `show` rows
- `09_Web_Packages!A4:J1360`: 1,314 package rows

At readback: of 93 Web Ready `show` rows, 0 lacked a Core event, 0 were Core inactive, 0 had a Core `event_status` other than `open`; across 438 Web Ready rows, 0 Core-vs-Web Ready event date mismatches and 0 normalized venue mismatches. **Two `show` event days have zero phone inventory:**
- `EVT-20261203-BTS-WORLD-TOUR-ARIRANG` — 2026-12-03
- `EVT-20261205-BTS-WORLD-TOUR-ARIRANG` — 2026-12-05

Each has Web Ready phone_count=0; phone-only available_count=0 `full`, phone+lens bundle=0 `full`, standalone lens-only=1 `available`. This is an existing Production-business-data discrepancy, NOT corrected by this UI code. PR #813 addresses the related inventory formula; preserve owner booking/locks and no collision with that draft PR.

## Tests and readback

- Before R4 fix, five new Core authority/date cases failed against R3 normalizer: **18/23 PASS**.
- After code change and revised source-accurate test fixture: `node --check admin/operations-dashboard.js` **PASS**; `node --test tests/operations-dashboard-readonly.test.js` **24/24 PASS**.
- Browser baseline: Chromium synthetic authorized/denied sessions, responsive 390px, QA/calendar/plans: **11/11 PASS**; page errors 0.
- Browser Apps Script missing Owner Locks: **4/4 PASS**, all plans held.
- Five new Chromium synthetic Core authority scenarios (hidden, closed, orphan, Web hidden, Core date drift): **5/5 PASS**, zero browser errors and no 390px page overflow.
- Full Node repository suite, GitHub Actions, signed-cookie real Preview, mobile Safari and Production acceptance **NOT RUN**. Browser harness disables CSP for local HTML rendering; cannot certify hosted CSP by that evidence.

Verified local/source digests:
- JS Git blob SHA: `6ab7a6f420534d596540b3e1353547e61e09ee01`; SHA-256: `cb408daf55500ccd998a2944ac882abc194d211d23bf52b096a1e47ee517ae10`
- Tests Git blob SHA: `ddad8c26f7d4d8bfd3ea48ab34c2ed8298cb25ee`; SHA-256: `88d08121d9eed08be619e171a72128fd634cf5d2b0ac4f51e118682f77bc3fdf`
- HTML SHA-256 `5080406488d09d0884fbf3defad695efcce90e08cd9bab7d1f7fa5401fc76f19`
- CSS SHA-256 `9e032908eea9a2dfa58f9c8e65ee164ea3f5fdbb42e82c7baa5a0879da77c0e5`

## Privacy/safety boundaries and unresolved release requirements

- New UI has no write endpoint and does not display names, telephone, payment amounts. **The raw authenticated Admin snapshot still includes customer Booking PII in the browser response**; UI projection alone is not network-level data minimization. Do not claim a redacted backend API.
- Existing primary Apps Script snapshot lacks `visibility_locks`; R4 preserves R3's read-only degraded display with all Owner Locks UNKNOWN/HOLD; X Post Log and independently verified Production source are also absent. All planner entries remain drafts; no X posts.
- Registered pre-implementation `storefront_ux_review` and post-implementation `storefront_visual_qa` have not been obtained; no independent Reviewer approval or complete `npm run code:context`, `npm run code:test`, full `npm test`, `npm run check` or exact-head CI.
- No verified Vercel Preview for the feature branch; no hosted signed-cookie/CSP/API negative tests. Check actual Vercel quotas/free build cost before authorizing runner/deployment; do not increase spend.
- Continue only in isolated PR #851, check concurrent PRs #744/#813. Do not Merge or deploy Production before all Engineering, UX, data privacy and owner release gates pass and exact live readback is available.
- Rollback: R3 HEAD `b00dd23bceda56f3b86a7cbb181c0e82edc0c047` is known; revert the two small R4 code/test commits or close the unmerged Draft PR. No Production rollback is required, as no deployment occurred.

## Next handoff steps

1. Read `AGENTS.md`, R3 and this R4 document; verify HEAD/PR status, owner source of truth and no Codex overlap.
2. Request registered pre/post UX review and independent engineering review, assess security PII projection alternative and fail-closed loader.
3. Run full exact-head tests and hosted authenticated Preview in authorized zero-added-spend environment; validate product mobile and package/Booking/Lock data at readback.
4. Obtain explicit governed release approval, then only when all gates pass merge/deploy/verify; otherwise keep Draft/HOLD with a clear blocker and updated checkpoint.