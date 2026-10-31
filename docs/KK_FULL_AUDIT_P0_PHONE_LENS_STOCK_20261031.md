# KK Phone Rental — P0 Phone/Lens Availability Fix & Full Audit Handoff (2026-10-31 ICT)

**STATUS: SOURCE + REGRESSION STAGED; ALL PRODUCTION/BUSINESS WRITES ON HOLD.**
This is a durable cross-chat state checkpoint. All observations are bounded to the date of the actual check.

## Verified canonical baseline

- Repository: `mikesd1995/kk-phone-rental-vercel`; exact verified baseline `main=30425dd2486d5bd979aded89cfa4984b30af142f`. GitHub `main.protected=false`.
- Earlier Booking P0 fail-closed fix: [Draft #830](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/830), **unmerged**; its CI at head `444c3b73adaed3176c10104969f089cac7260dcf` passed 58/58 Booking tests, but the deployed Apps Script is NOT certified.
- This fix is a fresh, isolated current-main port of the legitimate phone-stock parts of [Draft #813](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/813). Original #813 is unchanged and not closed; it is old-base and has different treatment of lens-only add-ons.
- Read-only live `08_Web_Ready` check on 31 Oct: BTS concerts on 03 Dec and 05 Dec 2026 each showed `available_phone_count=0`, `available_lens_count=1`, `booking_status_for_web=เปิดจอง`, `action_for_web=show`. Actual I and J formulas contained `MAX(G,H)>0`.
- Connected owner Drive metadata still showed canonical Core workbook `anyone:reader`, unlisted `allowFileDiscovery=false`; **not changed**. Avoid storing live Drive file IDs in this public document.

## Changes staged on branch

Branch: `fix/p0-phone-lens-inventory-current-main-20261031` (base exact main above).

1. `apps-script/Code.gs`: `kkFormulaWebReadyAction_` now determines `show` vs `show_full` by `G>0` only; preserved existing all Owner Visibility Locks, historical-hide, health, active and event status guards. Adds `kkFormulaWebReadyBookingStatus_` with phone-only status, and extends **explicit owner repair function** `kkRepairOwnerVisibilityLockFormulas_` to repair I and J in the same operation. This function was not called; it has a wide 5:1000 formula-writing scope and REQUIRES owner approval and staging parity first.
2. `script.js`: `availCnt` reports **new-phone-rental** availability only when a phone package is visible and phone count >0, and never reopens explicit `show_full`. The `showModal` now combines a **phone waitlist** whenever phones are full with any independently authorized **existing-booking lens-only add-on**; it filters phone CTA from a `show_full` date and labels lens-only as existing-booking-only in TH/EN. Lens add-ons are inquiry-only in the UI until the owner confirms the customer's existing phone booking; this is not a new customer phone slot. The underlying package rule admits lens add-ons only when an appropriate existing phone-only booking exists. Booking/Package/Owner verification remains backend-controlled. Mandatory registered UX/Visual QA still blocks release.
3. `admin/admin.js`: treat phones<=0 as phone-full irrespective of spare lens; keep `show_full` override.
4. `index.html`: change the storefront JS cache identifier only so an eventual approved release does not load stale code.
5. `scripts/audit-phone-bookability-public-feed.cjs` and `tests/audit-phone-bookability-public-feed.test.js`: read-only public feed audit and nine donor regression scenarios (schema/CSV/date/duplicate/zero-phone).
6. `tests/nov-dec-phone-stock-full-contract.test.js`: current-main adapted donor exact-source tests; **preserve** valid lens-only add-on path rather than suppress it. Also test `show_full` with stale positive phone count.
7. `.github/workflows/booking-e2e-acceptance.yml`: use existing exact-HEAD Booking E2E to execute both stock regression suites, add path triggers to prevent untested JS/Admin changes. Existing zero-business-write guard unchanged.

## Verification: evidence and non-achievements

- Before opening a PR, an isolated V8 source-function extraction ran 11 synthetic checks against actual branch code; **11 pass / 0 fail**: zero-phone + one-lens, one-phone + one-lens, explicit `show_full` fail closed, lens-only with stale phones, I/J formulas, Owner Locks, I/J repair consistency, lens-only add-on retention, Admin phone full, JS cache marker.
- All tests are **source-only**; no live Sheet edit or real customer Booking was attempted. CI results / exact PR head / UX agent invocation / visual proof / deployed Apps Script identity / Google Sheet formula cutover / browser E2E must be confirmed after PR is created, not inferred from previous #813 success.
- No source or direct payment/Booking/Owner Lock write was made to `main` or Production. No Supabase SQL, no Google Drive ACL change, no scanner/Make/scheduler execution, no merge, no deploy, and no paid resource activation.
- Storefront UX reviewer `storefront_ux_review` **before** implementation and `storefront_visual_qa` **after** implementation are mandatory project gates; their registered Agent Gateway invocation is not available from this connector-only editing session. **VISUAL ACCEPTANCE BLOCKED** even if GitHub CI passes. Existing local Visual QA GitHub Actions is supporting evidence but does not replace the missing registered UX/QA invocation.

## P0 release blockers — do not shortcut

1. Booking fail-open: [Draft #830](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/830), no deployed GAS E2E parity acceptance.
2. Phone/lens false availability: this draft candidate; live `08_Web_Ready!I:J` remains wrong until owner-authorized formula repair and exact-readback for ALL affected future rows. Do not repair just BTS; verify no other collisions, availability status, owner locks and existing bookings.
3. Core workbook link privacy: [Draft #739](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/739) private Core reader requires source parity/negative-auth tests for all 13 source ranges before any ACL restriction.
4. Poster asset public-writer: [Draft #721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721), scoped owner dry-run and verification required.
5. Production commit drift: previously observed CANCELED current-main Vercel attempt, last verified READY on older SHA; GitHub watcher reported `CURRENT_MAIN_DEPLOYMENT_FAILED`. Need recheck newest live state and domain exact deployment mapping.
6. Main branch protection not enforced; ~59 open PRs last reviewed. No bulk closures or merges.
7. Scanner/ledger stale queues [Draft #778](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/778), no replay without TTL/fencing.

## Release gate steps (after required owner approval; do NOT infer approval from this doc)

- Exact PR SHA and workflow CI; targeted tests plus full `npm run check` / `npm test`; independent reviewer and pre/post registered storefront UX/Visual QA with viewport screenshots.
- Verify source drift relative to other open drafts #813 and #830. Integrate dependent guards before promotion; no force push of shared branches.
- Confirm actual Apps Script deployed version and locked owner-only authorized repair command. Dry run repaired formulas for every affected future event row, no hidden→show owner unlock, no loss of editable package price or existing bookings. Use exact readback, error counts, rollback snapshot.
- Validate four public states on Production after owner approval: phone available, phone full + spare lens (waitlist phone but permitted add-on for existing renter), no phone/no lens, and owner-hidden; compare Web Ready, Web Packages, Admin and signed-out storefront.
- Recheck P0 ACL, poster, LINE and customer privacy, release watcher before Stable Business V1 closure.

Do not represent this code-only checkpoint as a production fix. Reuse the above file links and exact PR readback in future ChatGPT conversations rather than repeating the audit from memory.


## Integration checkpoint — 2026-10-31, combined P0 Booking + Stock source candidate

**Repository and changes**
- Baseline \`main\`: \`30425dd2486d5bd979aded89cfa4984b30af142f\`, still unchanged at latest GitHub readback. Current carrier is [Draft PR #831](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/831); [Draft PR #830](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/830) is preserved without modification, not marked obsolete until independent parity review.
- Ports #830's smallest fail-closed Apps Script admission correction into the already reviewed #831 source: \`kkAssertWebPackageBookable_\` now throws if canonical \`09_Web_Packages\` contains zero rows for an event. Caller DocumentLock and every other package, stock, price, visibility and identity guard were left intact.
- Ports #830's **10 exact-source tests** to \`tests/apps-script-web-package-fail-closed.test.js\`, with the existing Booking E2E workflow path and test registration. Both fixes therefore test on the **same exact PR HEAD**, not merely on separate passing PRs.
- The previously exposed LINE message issue for \`lens_only\` was corrected with a conditional opening line: **"สอบถามเพิ่มเลนส์สำหรับผู้จองมือถือแล้ว"**. New phone rentals retain their original message. The small CTA is inquiry-only and the displayed package model is left unchanged; added a source-function regression for both LINE variants. No customer LINE messages were sent by this change.
- Existing storefront modal continues showing the **phone waitlist + eligible lens-only inquiry** simultaneously on phone-full dates. The backend, not public text, remains the authority on whether an add-on is permitted.

**Verification and review evidence**
- [Booking E2E run 41174142075](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/41174142075) on pre-document-edit source SHA \`e8e7f7fe663f2595ffdece7b8b28715db288ddc7\` finished \`SUCCESS\`, **79 tests / 79 pass / 0 fail**, exact checkout and zero-live-write safety assertion. Do not transfer this pass to any later HEAD without fresh readback.
- The local zero-cost [Storefront Visual QA run 41174142076](https://github.com/mikesd1995/kk-phone-rental-vercel/actions/runs/41174142076) completed its all-visible-modal browser audit step at that SHA; confirm **terminal conclusion, screenshots and acceptance artifact** separately.
- Independent review by a different Reviewer and registered \`kk-storefront-ux-reviewer\` / \`storefront_visual_qa\` Agent Gateway invocations **remain outstanding**. The GitHub UI workflow is supplemental, not substitute. The complete \`npm run check\` and full \`npm test\` were not executed here.

**Fresh read-only owner evidence on 2026-10-31**
- \`08_Web_Ready!A37:J38\` still has **BTS 03 Dec / 05 Dec** \`phone=0, lens=1, เปิดจอง, show\`. Both I and J live formulas still use \`MAX(G,H)>0\`; no actual formula repair occurred.
- Canonical Google backend workbook still grants \`anyone:reader\`, unlisted; one verified current BTS poster still grants \`anyone:writer\`. This is a link-reader privacy risk and a public-writer integrity risk; it is not evidence of a confirmed attack. Exact live file IDs intentionally omitted from public handoff.
- \`main\` remains unprotected. Production exact deploy/real-world Booking and LINE E2E acceptance were not verified by this integration.

**Final release HOLD / next concrete actions**
1. Verify terminal exact-HEAD source CI and browser QA, independently review diff and relevant Package/Booking collision paths. Preserve original PR #830 as traceable donor until accepted.
2. Run complete source full regression, registered storefront UX reviewer before/after, security/negative-auth review and backend deployed Apps Script provenance.
3. Only after approval and bounded exact readback: repaired formula rollout (owner-hidden events must not reopen), private Core read cutover before revoking sheet anyone-reader, scoped poster reader ACL repair. Do not modify inventory, price, customer PII, Booking or automated runner as a workaround.
4. Confirm signed-out storefront, Admin, LINE new Booking, existing renter add-on, waitlist and control-plane state on current Production. Resolve production-release drift.
5. Record actual post-release evidence and rollback before declaring Stable Business V1. **No Merge/Deploy/Google ACL/Sheet/Booking/Machine SOT/Automation/Prod writes in this checkpoint.**
