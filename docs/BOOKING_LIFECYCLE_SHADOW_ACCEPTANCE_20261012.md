# KK booking lifecycle shadow acceptance — 2026-10-12

## Business requirements (owner locked)
- No deposit at booking. Collect cash / transfer payment only at physical device handover.
- Return device, finish Google Drive upload, deliver usable Google Drive link, then mark booking completed.
- Revenue Dashboard: **Actual = completed only**, **Future = active statuses (pending, confirmed, prepared, picked_up, returned, uploaded)**, **Forecast = Actual + Future**. Exclude cancelled, no-show and blank/unknown statuses.
- Neither `amount_received > 0` nor `payment_status=paid` alone proves a customer has received their Drive content, or that the business has verifiable cash documentation.

## Scope implemented in Draft PR #709 (read-only)
- `server/kk-booking-lifecycle-shadow.js` reads booking rows and reports counts/risks, without mutating Sheets, Booking, Google Drive, LINE, Vercel Production or Supabase.
- `checkCompletionTransition(previous,requested)` is an **unwired pure function**. It requires **persisted previous state** `uploaded`, `payment_status=paid` and positive numeric `amount_received`, device `return_status`, `file_transfer_status`, and direct HTTPS `drive.google.com` / `docs.google.com` link. It does **not** accept unsaved client-provided evidence as proof. Historic `completed` rows are not automatically reclassified.
- `tests/kk-booking-lifecycle-shadow.test.js` has eight deterministic cases covering permitted closure, forged payload rejection, skipped upload stage, Drive-host lookalikes, non-closure behavior, Thai baht amount parsing, Actual/Future exclusion, legacy evidence gaps.
- `package.json` postinstall appends the exact Node test to make Preview fail if these regressions break. No paid services added.
- Critically, this is **shadow only**, not the final production closure enforcement. Current Admin does not yet provide a complete authenticated write/readback flow for `return_status`, `file_transfer_status`, `drive_link`, and handover payment proof. Blocking new completion from only the read-only auditor would deadlock legitimate bookings; production writer remains untouched.

## Connected real Google Sheets readback, 2026-10-12
Backend spreadsheet `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`; read-only bounded `00_Master_Booking!A4:W160`. Source-derived results from the new module:

| Metric | Value |
|---|---:|
| completed rows | 16 |
| active/confirmed rows | 24 |
| cancelled rows | 12 |
| blank-status booking IDs | 1 |
| completed lacking in-table 4-part evidence | **16** |
| confirmed/unpaid with amount_received > 0 | **15** |
| cancelled/paid refund reconciliation needed | **1** |
| Actual from completed status | **THB 11,930** |
| Future from active booking amount field | **THB 18,550** |
| Forecast from status rules | **THB 30,480** |
| Verified completed receipts with all required in-table evidence | **THB 0 evidenced**, not a claim that no physical payments occurred |

**Interpretation:** Legacy completed/paid records may reflect cash that was genuinely collected and uploads completed outside this Sheet. Since proof fields are blank, we cannot certify this from the current table. Keep completed statuses and historical account totals unchanged pending manual evidence backfill. Positive `amount_received` on `confirmed/unpaid` often represents a historical quote, not verified cash; do NOT mark it paid, refund it, or clear that field automatically. Paid/cancelled is a reconciliation issue, not automatically fraudulent payment.

The live user/customer phone numbers, names, IDs, and contact details are intentionally absent from all logs and PR evidence.

## Hosted test/build acceptance
- Draft PR #709 branch `fix/booking-lifecycle-evidence-shadow-20261012`, HEAD `e8b69affe2780d44e1a687029b0b6e69df45727e` **at initial hosted validation**, before this documentation-only commit.
- Vercel **PREVIEW** `dpl_67QZ9JgoveXrrCpFUJJE9gpLNnBE` exact source SHA `e8b69affe2780d44e1a687029b0b6e69df45727e`: **READY**. URL: https://kk-phone-rental-vercel-6okhc0hx2-mikesd1995s-projects.vercel.app/
- Build log includes `npm postinstall`, `8/8 PASS` on true hosted Node.js `node:test`, plus unchanged existing suites; zero failures in inspected test summaries.
- No production merge/deploy. The preview and tests verify source readiness only, not customer browser/LINE workflow or real Google Drive link receipt.
- GitHub Actions private-runner zero-step/BlobNotFound issue is tracked at **Issue #707** and not bypassed.

## Required gated engineering follow-up (NOT DONE)
1. Authenticated booking evidence form: separate **quoted package amount** from **cash actually collected** and provide return/transfer/Drive fields with owner approval.
2. Writer must persist evidence to canonical Booking ID with revision/identity check; perform exact readback and maintain audit log without storing private customer contacts in logs.
3. Wire `checkCompletionTransition()` on authenticated server UPDATE after fresh readback, with prior-status progression and replay-safe response; do NOT trust only UI hints.
4. E2E test quote→confirmed/unpaid/0→handover paid→returned→uploaded+Drive→completed→Actual; include failed uploads, unpaid close, lost asset, concurrent update, duplicate LINE callback and cancelled status.
5. Independently reconcile 16 historical completed rows and 15 quoted/unpaid ambiguities with owner/source evidence, and one cancelled/paid exception. Do not mass edit.
6. Run GitHub CI and browser QA gates when runner restored. Only then consider merge/release; approval and no extra spending required.

## Recovery / handoff
Revert only this PR's isolated module, tests, package postinstall hook (verify current HEAD before any revert). Existing production booking data is untouched; legacy no-deposit Phase 1 from PR #699 is already merged. Review existing final production gate Issue #49, Booking Issue #683 and GitHub runner Issue #707. The project has other Draft PRs (#703 visibility audit, #704 temporary artwork, #705 consolidation), none of which were merged or changed by this Booking shadow work.

## Continuation: connected fallback Admin warning and exact-head hosted acceptance

This work continues the **same Draft PR #709**; no new PR and no business mutation. Earlier isolated shadow-only source and tests were already hosted READY. New code changes:

- `ab06a1e1fc4d5f355abc52dbc62604b6a3dfbc67` — `server/admin-sheet-fallback.js` calculates `booking_closure_evidence_shadow` from the canonical read-only Booking projection via `BookingLifecycleShadow.audit(bookings)`. Returns aggregated statuses/amounts/issue counts, not names, phone numbers, contacts or per-booking identifiers.
- `df9c5d3d96cc5304d1ceae0bd95b4d4240ea095f` — `admin/admin.js` adds warning rows to System Guard for historical incomplete closure evidence, confirmed/unpaid with positive amount field, and cancelled/paid refund review. No quick mutation buttons or paid-state changes added.
- `5db469deb02fe234e6d962f30d73e8ab916ec8fe` — first aggregate/UI regression tests (10 tests total in hosted Vercel). Preview `dpl_GYsYt3qV378b7GMLBJvrA46DxnFN` **READY** at this SHA, `10/10 PASS`.
- `bdaf211adda3479a928c90c57815d9041f9c7171` — test canonical `Fallback.buildFromRaw` on a synthetic booking without any live write. Verified isolated function output `completed:1`, `missing_evidence:1`, no `booking_id` leaked in aggregate.
- `16fc8870b39c48698dc54e0da39022cf29ef2b03` — refactor `bookingClosureGuardRows(data)` and ensure an external/live System Health response does **not** overwrite the warnings (warnings appended once from current `state.data`).
- `8a4f54d9ebe9d576510edcedaa5386139799f381` — corresponding live-Health regression test. Vercel preview `dpl_BrdmBvWb7kdLSsLNFqqhcEYWJr8g` **FAILED** due to **one stale test assertion** for the previous variable `const closure=d.booking_closure_evidence_shadow` after the helper signature changed. Build failed in `npm install`, not an underlying business-data or runtime bug.
- `796fd163afa2b59759527caf8ae26a14d2d36713` — corrected that exact test expectation to `const closure=data&&data.booking_closure_evidence_shadow`. **Vercel Preview `dpl_HgrpueFWMqMvrBucsorUkTwtzXHQ` READY** at **exact same SHA** (not a stale preview), `12/12 PASS, 0 FAIL` from hosted Node.js `tests/kk-booking-lifecycle-shadow.test.js`, plus other unchanged postinstall suites. Preview URL https://kk-phone-rental-vercel-hjdp20ce7-mikesd1995s-projects.vercel.app/ . This is hosted build and static contract acceptance, **NOT proof of browser-rendered Admin clicks or a production Booking writer**.

### Concurrent upstream/Production state (independently read back)

During this same continuation **PR #704 became MERGED by separate work** (not performed by this Booking shadow task). Vercel Production current custom alias `kk-phone-rental.vercel.app` points to `dpl_B4NFKuic55jMVHfXUXcp6tD9Yigz`, READY, main SHA `7503add3f51b385a71f46c880fa3c756b84a3669`. Direct GitHub source at that exact SHA confirms **temporary exact-event fallback, a temporary-brand label and accessibility alt logic are present in `script.js`**. Web/browser tooling could not independently fetch/decode public images or click customer CTA; **DO NOT mark visual QA pass**.

Fresh live Core/Web Ready readback: `01_Events!A4:I550` has 343 events / **82 owner Core active**; `08_Web_Ready!A4:K550` has 344 events / **80 effectively shown**; **0 shown rows with empty image URL**, **3 shown rows using KK-owned temporary brand image**. Other Core-active rows not shown are not automatically reopened due to owner locks or SOURCE_DATE_UNVERIFIED. `00_Master_Booking!A4:W160` reports 16 completed, 24 confirmed, 12 cancelled, 1 blank-status booking. Current reporting policy under bounded Sheets fields: Actual 11,930 THB; Future 18,550 THB; Forecast 30,480 THB; zero verifiable 4-part closure receipts *in this tab*, not necessarily zero cash collection.

GitHub Actions runner remains pre-job failing, tracked in Issue #707; account/billing/root cause not repaired or bypassed. October Supabase `public.kk_ultra_deep_scan_shards` still **0** receipts. Draft PRs #703 and #709 remain unmerged. PR #704 was merged concurrently; do not claim its rollout was performed by this booking task.

### Strict blocker and next gate
Admin writer currently delegates Booking mutations to a legacy Apps Script route; Direct Writer Phase 1 is **explicitly booking_routed:false**, and the no-deposit Phase 1 guard (PR #699 merged) covers only create-time unpaid/zero receipt, not post-handover persisted evidence. New shadow contract is intentionally not wired as a rejection gate yet: the writer and Admin edit form must first support authenticated, atomic `return_status`, `file_transfer_status`, `drive_link`, receipt data, exact `booking_id`-revision readback, and idempotent owner approval. Premature blocking would trap legitimate uploaded bookings and corrupt the operational flow. Cross-check proof with the owner before any historic backfill. No event-status, stock, pricing, payment, Booking, Supabase or Google Sheets mutation was done. No paid plan or TinyFish used.

**Recovery:** For reverting newly connected warning UI, revert the above `admin-sheet-fallback.js` and `admin/admin.js` commits with the corresponding test changes after verifying current HEAD. This leaves prior read-only `server/kk-booking-lifecycle-shadow.js` and Google Sheet business data unchanged. For full rollback, revert the entire Draft PR #709 before merge (there is no Production deploy of it).
