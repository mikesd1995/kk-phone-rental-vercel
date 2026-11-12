# KK Phone Rental — LINE decision Durable Outbox v1 (2026-11-13)
**Status: source-only DRAFT; NOT deployed or activated; P0 #861 remains OPEN.**

## Scope and dependencies
- Stacked change: PR #876 targets PR #866 (provider idempotency key + bounded retry); it deliberately does **not** merge/deploy either.
- `apps-script/Code.gs` is also changed in open formula PR #852; integrate with a source-aware merge / exact-head re-test before releasing. #862 webhook and #865 storefront are separate release-gated work.
- Scope is **customer notification AFTER owner approves/rejects a pending LINE booking**, not initial LINE booking cards or outbound owner approval card; do not close issue #861 because of this change.
- No Production ScriptProperty/Vercel variables, Sheets, owner locks, real LINE provider calls or customer bookings have been mutated by this PR.

## Ownership and feature gates
- **GAS:** ScriptProperty `KK_LINE_DELIVERY_OUTBOX_ENABLED` equals literal `true`. Default missing/OFF.
- **Node/Vercel:** `KK_LINE_DELIVERY_OUTBOX_ENABLED` equals literal `true`. Default missing/OFF.
- Before *any* enabled booking decision, the worker calls authenticated read-only action `lineDeliveryOutboxReadiness` and requires `{outbox_contract:'v1',enabled:true,schema_ok:true}`. An old GAS deployment cannot pass. Every decision POST also carries `outbox_contract:'v1'|'off'`; the canonical writer refuses mismatch **before booking status mutation**. If the versions/flags are inconsistent the integration fails closed, never falling back to unsafe old sends.
- The LINE owner approval itself additionally requires `KK_LINE_BOOKING_AUTOMATION_ENABLED` and `KK_OWNER_LINE_USER_ID`. Both were **absent from the read-only Vercel production env-name list** on 2026-11-12. Do not invent or enable production owner IDs without owner-controlled configuration review.

## Explicit outbox installation — NOT automatic
1. Require independent review, deployed GAS exact code identity, owner-approved maintenance window, private read-only booking/Owner Locks validation and a protected rollback snapshot.
2. Confirm canonical Spreadsheet App identity and schema ownership. Run the **manual GAS function** `kkInstallLineDeliveryOutbox_()` from the intended owner-authorized script project. It creates only a new `19_Line_Delivery_Outbox` sheet with 11 exact headers. Never invoke without approval or run via a public HTTP route. The booking decision handler will NOT create the tab automatically.
3. Run `kkLineDeliveryOutboxPreflight_()` (read-only, returns schema/status counts), validate no unexpected formulas, duplicate outbox IDs, or human-edited ledger rows.
4. In staging with synthetic booking IDs/customer test recipients, deploy both matching versions; test fresh approval, rejection, replays, network 503, provider timeout/409 accepted, zero LINE sends on denied/uncertain claims, ACK failure and stale lease.
5. Only after protected owner UAT and reviewer approval, coordinate GAS property and Vercel env opt-in; verify both sides' flags and readiness without touching real customer bookings. Test a permitted controlled booking and fully read back its canonical status, outbox row, LINE provider acceptance metadata, owner reply and provider message history. Require owner explicit release approval before Production.
6. Keep a documented rollback: turn **Node outbox flag OFF and GAS outbox flag OFF together only when no in-flight decision exists**, or freeze the owner approval flow. Never silently revert to legacy sending for decisions with stored outbox intents; keep ledger history private and do not delete.

## Ledger contract
Sheet columns A:K: `outbox_id, booking_id, decision, recipient_sha256, state, claim_id, claimed_at, provider_request_id, attempt_count, created_at, updated_at`.
- **Never store raw LINE recipient IDs in the outbox**: hash from the canonical booking's existing customer contact; the send worker retrieves the real contact through authenticated claim only after booking/status/identity readback.
- Deterministic `KLO-<sha256 prefix>` key per booking+decision. Reject duplicates, mismatched identities, changed recipient, wrong booking channel, missing governed LINE request marker, schema drift and oversized ledgers (limit 50,000 rows).
- Under the canonical document lock: `PREPARED` outbox intent is written and verified **before** modifying `00_Master_Booking` status; after Booking readback, intent is set to `READY`. If the write crashes during either phase, an owner decision replay can repair a PREPARED intent but never backfills an already-committed *legacy* booking lacking one.
- `READY` may be claimed **once**: `CLAIMED` stores a unique token and 120-second lease under the same lock; sends use the same LINE provider retry key for at most two bounded attempts. Only a claim holder can ACK. `ACCEPTED` means LINE accepted the HTTP request, **not** that the user received/read it.
- A timeout/crash after claim, lease expiry, provider failure or ACK uncertainty transitions to `FAILED_UNCERTAIN`, `FAILED_TERMINAL` or `UNCERTAIN` and requires owner/operator reconciliation; no blind automatic resend. An expired claim must never be reissued with a new provider request/key.
- Provider retry keys expire after **24 hours**; secrets rotation may change the HMAC-derived key, so never retry uncertain attempts after a crash/restart without evidence. LINE reply tokens are never retried.

## Offline test gates
`tests/line-delivery-outbox-contract-20261113.test.js` covers GAS native syntax via VM, manual install/schema validation, precommit/commit/ready crash windows, replay, unique claim and ACK, expired leases, failed uncertainty, contact tamper, stale legacy booking, disabled flag, malformed ACK, node sender order, 503 failure, flag mismatch and read-only readiness before decision.
The dedicated `LINE owner delivery safety regression` workflow tests this contract, legacy LINE privacy regression, full `npm run check` and `npm test` on the exact PR SHA. Independent approval, real provider E2E and Production readback remain mandatory regardless of green CI.

## Operational runbook
- **READY:** canonical decision committed; safe first claim possible.
- **CLAIMED under 120 seconds:** in-flight, no second push. Expired → UNCERTAIN; no unattended restart.
- **ACCEPTED:** provider accepted; cannot be reclaimed; user delivery may still fail.
- **FAILED_UNCERTAIN / FAILED_TERMINAL / UNCERTAIN:** STOP, verify actual LINE request acceptance and recipient contact privately. Only a specially reviewed owner maintenance procedure (not supplied as a public API) may reconcile terminal records. Never reset status manually in the sheet to force a new send.
- Legacy decided bookings with no outbox row are deliberately blocked when the feature is on; reconcile individually, do not auto-backfill.
- Preserve private evidence and follow Owner Locks, Booking, CI, independent review and exact-head Production safety gates.

### Completion boundary
This PR can complete **source implementation + offline regression**. It cannot close the original P0 until authorized GAS install, staging/provider UAT, exact production-version readback, owner approval and independent code review are all evidenced. Keep Issue #489 as cross-chat SOT.
