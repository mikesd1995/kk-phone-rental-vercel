# KK Booking no-deposit P0 repair — 2026-10-12

## Owner business truth
KK collects **no booking deposit**. Customer pays the final agreed rental price face-to-face at physical device handover. A booking can be confirmed while `payment_status=unpaid` and `amount_received=0`. Return, verified home Drive upload and customer link delivery precede `completed`. Actual revenue is completed verified receipts; Future is **final booked value**, not amount_received before handover.

## Actual production source findings
1. `admin/admin.js` `autofillBookingAmountFromPackage` copied the package list price into the **cash received** `amount_received` input when creating a booking, making unpaid prepayment appear in Core Column O.
2. `admin/admin.js` `buildActionRows` incorrectly labeled every confirmed/prepared unpaid booking as late payment risk; the shop only collects at handover.
3. Admin one-click `Paid` could mark a booking paid with no observed handover/payment evidence.
4. Server `api/kk-admin-guard.js` previously had reservation/timing guards but no no-deposit create rule. Canonical Apps Script create accepts `payment_status` and `amount_received` from payload.
5. Real Google Sheet `00_Master_Booking` row 4 headers: N=`payment_status`, O=`amount_received`, P=`return_status`, Q=`file_transfer_status`, R=`drive_link`, X=`package_price` (booked price), Y=`balance_due`. A real confirmed/unpaid row was observed with O=1,290 and X=1,290, confirming a **historic data discrepancy**, not a verified cash receipt. Do not overwrite.
6. Rental Analytics helper `_Rental_Dashboard_Data!A1:O` includes `Amount Received`, but **not** `package_price`; `server/rental-dashboard-core.js` mistakenly computes Future from the received amount. **Still open** — replace with a read-only keyed canonical X valuation join and prove archive uniqueness before shipping.

## Fix in this branch
- Authenticated API `createBooking` now **rejects** new entries unless status is pending/confirmed, payment is unpaid, amount_received is 0. Validation occurs before any admin writer call; specific `NO_DEPOSIT_*` errors are returned.
- Admin create form no longer copies package quote into cash received. Amount is readonly 0; payment status only unpaid. The reference package quote remains visible in a hint; backend formula X remains separate.
- No payment debt alerts for pending/confirmed/prepared; after handover unpaid receipts become a staff verification task.
- One-click Paid action removed; staff must open Edit Booking and check actual money/evidence.
- Payment LINE reminder copy now describes payment at handover with no deposit.
- `npm run test:booking:no-deposit` included in Vercel postinstall, in addition to existing 65 tests; fail closed if the no-deposit rule regresses.

## Safety and limitations
- **No Google Sheet writes, no historical financial cleanup, no Money/Drive link fabrication.**
- **No final owner agreement amount change.** Core booking X is a formula, not a deposit.
- Apps Script production source may drift from tracked `apps-script/Code.gs`; deploying that candidate directly is NOT approved. Authenticated Vercel guard covers the public admin write path, not arbitrary direct Apps Script callers.
- Delivery/return/upload/completed hard gate remains **BLOCKED** until the authoritative Apps Script writer can persist timestamps, return inspection, Drive link verification and customer-send evidence atomically. Do not claim the entire lifecycle fixed from this patch.
- **No pricing, hidden-event visibility, stock, marketing autopublish, X approval, LINE outgoing policy changes.**

## Tests and acceptance
1. Exact-head Vercel Preview postinstall Node tests must pass, then manual read-only UI/API smoke and source guard verification.
2. No owner receipts, customer payment, external provider posts or business data mutations as test data.
3. Merge only when branch is accepted as safe; verify Production deployment SHA, creator `createBooking` guard source, public Admin login/booking widgets, events and packages byte parity. Existing Production kept for rollback.
4. Subsequent separate P0 work on revenue X valuation and back-end end-of-rental gate; reconcile legacy 15 confirmed/unpaid positive receipt rows (THB 18,550) and cancelled exceptions with receipts only.

## Cross-chat summary
This is **P0 phase 1: new-booking admission**, not the full #683 end-to-end gate. Keep #683 OPEN until physical handover payment, return, upload, Drive permission, customer link send, and completed exact-readback are all proven.
