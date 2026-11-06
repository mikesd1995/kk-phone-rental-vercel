# KK Phone Rental — 2026-11-07 Remediation & Cross-Chat Handoff

**Mode:** source-only changes + read-only preflight. **Do NOT treat this document as authorization to merge, deploy, modify Google Drive permissions, write bookings or change configuration.**

## Fresh identity / protected release

- Latest confirmed GitHub `main` **and** canonical Vercel Production: `d4bd11f6ff78f67f41b79a26448d036007737701` (PR #840 exact, preserving bilingual legal #844). Vercel Production deployment `dpl_Gd9uiw2P2Pii4daCsKCmRSXdUDAJ` READY. Main had no divergent commits during first preflight.
- PR #840 was source-released; its **native SQL / GAS tests were synthetic/disposable**, not an accepted production activation. Owner-approved runtime health attempt remains a separate gated workstream.
- Scope of this remediation: repair **frontend new-phone availability interpretation only**, on a separate branch without touching Main, production, live customer data or Drive ACL.
- Keep TH/EN, 6 November Terms evidence, LINE booking/waitlist and existing customer contracts unchanged.

## Confirmed P0 #1 — Core customer data ACL

Direct Google Drive file metadata readback for canonical workbook **KK Phone rental backend** (`12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`) shows `anyone:reader`, link-discoverability false. Contains `00_Master_Booking` and customer-related fields. This is **not private merely because the URL is unlisted**.
- Event Tracker `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo` and CRM `1mmXkDAk3NJtyWqp7qC8ByQyEgKsTY5IO1ca9xLQijaU` were owner-only at audit.
- Current `api/kk-data.js` still supports public GViz fallback unless strict private-reader flags/credentials are ready. Disabling anyone-reader blindly can break the storefront.
- Production environment metadata did not list `KK_CORE_SHEET_REQUIRE_PRIVATE`, `KK_CORE_PRIVATE_TRANSPORT` or private Apps Script reader flags; absence of env metadata alone is not a functional end-to-end readback.
- Pending: private authenticated transport + exact deployed GAS identity, 13/13 source parity, negative auth tests, public/signed-out storefront (packages, posters, waitlists), independent review and rollback rehearsal. After successful cutover, revoke public reader, verify actual Drive ACL and revisit historical linked copies.
- Related [#738](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/738), [PR #833](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/833). **No ACL edits executed.**

## Confirmed P0 #2 — Poster Drive ACL

Direct permissions sampling of 6 **currently referenced** posters from `08_Web_Ready` returned `anyone:writer` for **6/6**, including CAT EXPO, two BTS files, PERSES, SONRAY and NAMTAN FILM. Previous owner-scope candidate PR #721 documented larger 33 active + 209 historical assets + 4 folders; these larger historical totals were NOT re-audited in this run.
- Do not change Drive permissions to owner-only without testing signed-out poster loads; a read-only public image link may stop loading when fully private.
- Safer path: inventory *current* poster references and parent roles; present exact per-file before/after `writer -> reader` where public image availability is required, then verify independent no-auth image loads and actual ACL readback. Repair historical permissions separately with rate-limited owner-only batch.
- Related [#718](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718), [#743](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/743), [PR #721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721). **No ACL edits executed.**

## Confirmed P0 #3 — Lens-only misrepresented as available new phone

Canonical `08_Web_Ready` rows **37 and 38** for BTS World Tour Arirang 03 Dec and 05 Dec 2026:
- `available_phone_count=0`, `available_lens_count=1`, `booking_status_for_web=เปิดจอง`, `action_for_web=show`.
- Matching `09_Web_Packages`: `phone_only=full/0`, `phone_lens_bundle=full/0`, but `lens_only=available/1`.
- At audit: 93 `show` event rows and 1,314 package rows examined; exactly these **two** visible events were marked OPEN despite zero phones, while all 93 show events had package records. Counts are point-in-time, re-audit before customer claims.
- The source frontend `availCnt()` counted a standalone lens as an available new rental. In a separate candidate branch this is repaired by only counting **phone** availability, honoring explicit `show_full` even with stale positive count, and offering a phone waitlist plus **existing-booking-only lens inquiry** with a distinct non-booking LINE message.
- `showModal` routes `lens_only` to a non-booking inquiry instead of triggering new-phone LINE intake; both waitlist and add-on links still use the existing unchecked Terms gate.
- Keep canonical Apps Script `08_Web_Ready` I/J formula repair **out of this branch**: no spreadsheet or deployed GAS mutation. A later owner-authorized GAS/Sheet repair with exact readback is necessary for upstream correctness.
- This narrow candidate is not equivalent to full [PR #831](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/831) which also guards Apps Script and Admin; port/retire that draft only after independent lineage check, exact-head CI and external reviewer.

## Booking and stock reconciliation (NO data writes)

- `10_Admin_Health_Check`: 11 `Booking integrity risk not OK`, 5 `Event data_health not OK`, 1 `Accessory kit capacity shortfall`.
- Direct `00_Master_Booking` row readback: 11 **confirmed** bookings missing both `customer_contact` and `customer_phone`; 2 of these also miss customer name. No customer identifiers were copied to this doc. Reconcile with the *same* customer LINE conversation; don't manufacture contact data or cancel.
- `15` `confirmed/unpaid` rows marked `Balance due` may be normal under the *no-deposit, payment at handover* policy; do not auto-collect, classify all as overdue or fabricate payments.
- `02_Assets`: 2 phone devices currently rentable; `06_Accessory_Stock` shows 1 power bank + 1 phone bag; physical inventory must be counted before any stock updates.
- 5 event data health warnings all correspond to hidden events, with date/poster verification still pending. Do not surface unverified events.
- Vercel 7-day lookback showed four historical LINE booking reply errors, last observed 5 Nov; 24h lookback had none. Requires separate mocked-provider and existing-customer delivery reconciliation.

## Scanner / operations

- `_Scan_Status`, `_Run_Manifest`, `_Run_Coverage` visible historical records ended around 8 September 2026; this is **not evidence** that no separate manual scans occurred thereafter.
- ChatGPT Scheduled Tasks inspection: KK Discovery Scanner and KK GPT Verifier disabled; Ticket Resell Scanner and KK PR744 Cleanup Gate enabled. Do NOT re-enable old scheduled jobs without owner-lock, queue fencing, stale replay and rate checks.
- 64 open GitHub PRs at prior audit, with many older Draft/HOLDs. Do not wholesale merge or discard; reconcile against latest main one by one.

## Exact release / acceptance checklist

1. Re-read main and Production SHA and compare against this branch; any drift -> rebase and rerun.
2. Run JS syntax and `tests/storefront-phone-lens-capacity-20261107.test.js`, existing booking and legal tests, full Storefront Automated Visual QA on the **exact candidate HEAD**, with TH and EN, mobile and desktop, all visible modals.
3. Exercise lens-only, phone-only, phone+bundle, full/waitlist, owner hidden, missing 09_Web_Packages and existing-renter lens scenarios in **synthetic** browser/provider tests with zero actual LINE sends or booking writes.
4. Independent reviewer and registered UX/visual QA gate, production rollback, current deployed Apps Script/Sheet identity; do not infer live acceptance from isolated tests.
5. Merge/deploy only in a separately gated exact-SHA authorized release after all gates; validate Vercel canonical alias and real displayed phone stock.
6. Separately complete Core private-reader and poster ACL migration with signed-out post-change checks. Never expose customer data or secrets in GitHub documentation.

## Results ledger

- 2026-11-07: fresh preflight confirmed Production/Main `d4bd11...`; source-only branch created from this exact commit. Frontend `script.js` changed narrowly; two browser cache assertions and public `index.html` cache key updated; new isolated regression test; exact-head Storefront QA test entry.
- **At document creation:** no live Booking, customer, stock, price, Core Sheet, poster ACL, runtime configuration, main, merge or Production deployment mutated by this work. CI and Review status must be appended after actual results (never predeclare PASS).
