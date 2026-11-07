# KK Phone Rental — Operations Dashboard V4 follow-up / source-only safety fixes

Date: 2026-11-07 (Asia/Bangkok). Status **STAGED / RELEASE HOLD**. No merge, Vercel deployment, Google Sheet edit, booking change, X posting, Owner Lock write, ACL change or new spend.

## Scope, ownership, and continuity
- Repo: `mikesd1995/kk-phone-rental-vercel`; Draft PR #851, isolated branch `feat/ops-dashboard-readonly-v4-20261107`.
- Original PR HEAD at review: `938d46c9ab5b6162875403bfd9f78dd5426cc906` (base `d4bd11f6ff78f67f41b79a26448d036007737701`).
- Changed paths in this follow-up: `admin/operations-dashboard.js`, `tests/operations-dashboard-readonly.test.js`, this dated document. No modification to core admin, storefront, API, `middleware.ts`, main or PR #744/#813.
- Prior V4 candidate and V3 offline dashboard remain in Library for rollback and inspection. No snapshots containing customer PII are attached.

## Confirmed issues and repairs
1. **Owner Lock empty state:** Previously the allow-set included empty string. An `event_id` with a lock row of `lock_state=''` could be treated as safe even though a meaningful lock state was missing. The allow-set now contains only `SEEN_CORE` and `REOPENED`. An empty lock state explicitly yields `UNKNOWN` and `Owner Locks ไม่มีหลักฐาน` HOLD. A mix of conflicting states is displayed `CONFLICT` rather than silently `LOCKED`.
2. **Duplicate Event and package IDs:** The `events` Map previously silently replaced earlier rows with later duplicate `event_id`; duplicate `package_id` could make package data ambiguous. The normalizer now rejects snapshots with duplicate nonempty source IDs (`DUPLICATE_EVENT_ID`, `DUPLICATE_PACKAGE_ID`) and the UI remains closed rather than trusting one row arbitrarily. Existing Web Ready duplicate checks remain.
3. **Duplicate or missing Booking ID:** Counting booking rows without validating `booking_id` could overstate demand or imply a trustworthy booking count. Unknown/missing/duplicate booking identities now make the relevant event booking aggregate `null` (รอตรวจ) and add HOLD. Booking IDs themselves are not included in the output projection; no names, phone numbers or payment amounts are rendered.
4. **Fractional and invalid inventory:** Prior numerical conversion treated 0.5 items and extremely large numeric values as valid availability. The new `stockCount` requires a nonnegative safe integer for `available_count` and `available_phone_count`; other values become unknown/HOLD. Web `show` with unknown/zero phone count is included in QA.

## Evidence
- Local Node syntax check: PASS.
- Isolated `node --test tests/operations-dashboard-readonly.test.js`: **15 PASS, 0 FAIL**; five focused regressions were added to the prior ten tests.
- Browser Chromium/Playwright fixture: **11 PASS, 0 FAIL**, no page errors, mobile viewport 390 px no horizontal overflow; includes denied authentication and personal-data redaction. The browser harness replaces remote authentication and snapshot calls with synthetic fixtures and disables local CSP for file-based rendering. This is not production or hosted Preview acceptance.
- Exact local/GitHub blob hashes (verified after publication):
  - `admin/operations-dashboard.js`: `16188a193ef4e5b36cdcbe9aca77bf7c78ccdac7`
  - `tests/operations-dashboard-readonly.test.js`: `f7615a825cf96faf20a64cd53b56f24d2b6f45fd`
- Local SHA256:
  - JS: `6e35d20cf09ea5c0b64a1c73d460def2349e400fd11b9eb4343785d1e88117ba`
  - Tests: `724f783b66e2fe11911d0be1e808728e2b3c0102c671f0bd6cb3d09cac192e39`
- The initial additional regression caught a missing `UNKNOWN` UI label and failed **14/15**. Corrected that label and reran **15/15 PASS**; no tests were weakened.
- Google Sheet 18_Event_Visibility_Locks schema and sample (read-only) confirmed meaningful states `SEEN_CORE`, `LOCKED`, `REOPENED`. No Customer PII or booking notes were used in the test source.

## Release blockers (mandatory)
1. PR #851 remains Draft. Independent registered `storefront_ux_review` (pre-implementation) and `storefront_visual_qa` gateway evidence have not been supplied. A retrospective informal review does not replace either registered gate.
2. Exact-head full native repository `npm run code:context`, `npm run code:test`, full `npm test`, `npm run check`, actual GitHub CI, licensed/zero-cost Preview and mobile Safari have not been executed. Local environment cannot reach github.com for a complete repo clone; the checked source is a verified ZIP plus GitHub connector exact blob. Check CI quota before requesting any run that could incur charges.
3. Hosted signed-session GET/HEAD/negative auth tests and response headers, source coverage/freshness, private Core reader cutover, PII negative tests and actual storefront/Booking/Owner Lock/X Post Log reconciliation remain pending.
4. Vercel readback 2026-11-07: latest READY production deployment from main SHA `d4bd11f6ff78f67f41b79a26448d036007737701`; filtered deployments on `feat/ops-dashboard-readonly-v4-20261107` returned **none**. No Preview URL was verified for this PR.
5. No new public API or business writes may be introduced. Publishing remains owner-controlled. Verify conflicts with concurrent PR #744 (Admin) and #813 (phone vs lens inventory) and get independent approval before merge or deploy.

## Next authorized steps
- Read `AGENTS.md`, the code-change/code-review skills and this document first in any new chat.
- Have registered Gateway UX review and independent Reviewer inspect exact HEAD and mobile screenshots; remediate all P0/P1 findings in isolated branch.
- Run context-selected targeted and full regression in authorized runner with zero additional spend; verify real signed-session Preview and storefront inventory invariants.
- Only after approved gates and owner release decision: controlled merge/deploy and exact live readback with rollback plan. Otherwise keep **HOLD**.

## Recovery
- Follow-up repairs are restricted to two files plus this document. Reverting the two isolated file commits or closing the unmerged Draft PR restores the prior candidate. No customer or production rollback is needed since production was never changed by this work.
