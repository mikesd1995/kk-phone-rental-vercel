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
