# Scoped preparation of the owner's one new Telegram UAT

This is a private Apps Script preparation path for the owner's 23 October 2026 instruction. It creates one NEW Telegram test identity; it does not reconcile, retry, delete, rename, reset or send the historical identity. It confers no Scanner/Verifier, scheduler, normal business queue or LINE authority. Installing this helper and exercising its no-network preparation are separate from protected source merge and provider acceptance.

The only historical exception is notification `KKUAT_TG_41097307-885b-4aa7-8da2-8db97d4b5e74` and claim `CLAIM|b871e6e4-ac71-45c8-8587-5f86c3158a16`, with `ADMISSION_UNKNOWN`, null envelope, exact original `SENDING` attempt 1 row, no provider or error evidence, and source AND claim older than 120 seconds. Any additional unresolved or malformed pending record blocks preparation. Existing default preparation helpers, run helpers, per-ID send fence and finalizer remain unchanged.

Before preparing a grant, the source operator must freshly inspect compatible live Machine SOT / Active policy; native old source-map and outbox absence; old per-ID gate OFF; Make 6176241 inactive, provider module disabled and no incomplete work; no provider execution for the old identity; Apps Script global FALSE and UAT FALSE; and no recognized conflicting live lease. Preserve malformed lease observations. A generic gateway denial is not evidence of absent DB rows.

Run the existing private editor entrypoint `logOwnerHistoricalTelegramUatNoSendPreview()` with no arguments. It acquires the existing ScriptLock and logs only `notification_id`, `claim_id`, `status`, `pending_sha256` and `claimed_row_sha256`; the full pending value, candidate, envelope and credentials are never logged. The pending hash is SHA256 of its exact property text bytes; the row hash is SHA256 of JSON serialization of the fixed 23-column claimed-row snapshot, with Date cells normalized to ISO timestamps. The original pending and every preexisting Sheet row must remain unchanged.

Set one non-secret Script Property `KK_OWNER_LEDGER_NEW_TG_UAT_GRANT` to JSON containing EXACTLY these ten string fields:

```json
{
  "version": "kk-owner-new-telegram-uat-grant-v1",
  "grant_id": "A fresh lowercase UUID version 4",
  "owner_authorization_reference": "OWNER_2026-10-23_ONE_NEW_TELEGRAM_UAT",
  "issued_at": "Current UTC ISO timestamp including milliseconds and Z",
  "expires_at": "Later UTC ISO timestamp, no more than 300 seconds after issued_at",
  "old_notification_id": "KKUAT_TG_41097307-885b-4aa7-8da2-8db97d4b5e74",
  "old_claim_id": "CLAIM|b871e6e4-ac71-45c8-8587-5f86c3158a16",
  "old_pending_sha256": "Exact lowercase 64-hex hash from the current private preview",
  "old_claimed_row_sha256": "Exact lowercase 64-hex hash from the current private preview",
  "native_reconciliation_evidence_sha256": "SHA256 of the freshly saved native reconciliation evidence packet"
}
```

The strings above describing timestamps/UUIDs/hashes are documentation placeholders, not a runnable grant. Root constructs actual values from fresh evidence. This property contains no password, key, signed envelope or transport capability. The native-evidence hash anchors the operator's qualification; it does not magically prove live native state or replace independent checks.

After all runtime/deployment/Make/private-relay preparation is ready, execute the no-argument private entrypoint `prepareOwnerTelegramUatAfterNoSendReconciliation()` once. Under ScriptLock it validates the grant, exact historical pending/claimed row and disarmed state. It creates a fresh UUID and persists `KK_OWNER_LEDGER_NEW_TG_UAT_GRANT_CONSUMED`, including the original grant and generated new ID, with exact readback BEFORE the first Sheet append. Its status is deliberately `CONSUMED_PREPARATION_OUTCOME_UNCONFIRMED`; neither an exception nor that status authorizes automatic retry. Do not delete/reset/replace the consumed marker. If consumption, append, preservation or plan readback is unknown, inspect the recorded new ID through native read-only paths and preserve uncertainty; do not generate another fixture.

On success only one new `TELEGRAM_OWNER_ALERTS` / `TRANSPORT_UAT` / `TEST` / `QUEUED` / attempt 0 row exists. The helper compares every preexisting row, the old pending's exact bytes and the consumed marker, then stores/readbacks the usual single Telegram plan with a 120-second source window and UAT FALSE. It makes no network/provider calls. The full prospective source snapshot remains bounded to 128 rows and 262144 UTF8 bytes.

The existing `runOwnerTelegramUat()` may select only this newly allowlisted ID; the old pending per-ID fence still rejects re-admission. Only actual Make module 8 provider ID/time, native durable ACK, immutable source-map join and exact Sheet finalizer readback earn SENT. Close per-ID admission, Make, global/UAT and Vercel fuses after the single attempt even on uncertainty. No source test, grant, prepared row or provider-free diagnostic is natural runtime or whole-project closure evidence.

## Actual finite preparation and expired relay, 23 October 2026

The source was independently reviewed (168 related tests); full local regression passed 2198 tests plus 29 poster ACL tests. The added `inconsistentBefore` regression first failed, then passed after the historical claimed row was joined to its complete original before-row plus exactly the four allowed claim mutations. Installed combined KK Agent source SHA256 is `f1b11c7a293059d5394d6ea1922fcb337b210e55ad04a61f365d0c5843b09d76`; the original Code.gs bytes and existing send/finalizer paths remain intact.

The sole consumed grant created `KKUAT_TG_caf84575-743a-4cbe-8588-6e8ee6d2532c` at `2026-10-23T05:23:54.024Z`, Sheet row 45. Its claim is `CLAIM|47af8985-f021-403e-bbbd-1f08dc73f8ed`, `SENDING`, attempt 1. Native admission succeeded at `05:25:09.884986Z`, producing exactly one immutable source-map/outbox join with content version `61ff881b417f20e3a9d8d4e43398bcc3cd7191a8a9e397b2c92c8b1ad7959e07`. Source rows 1 through 44 remain exactly equal to the preflight native value snapshot.

This is NOT a successful Telegram send. Navigating from the editor through Script Properties removed the editor breakpoint; the actual admission completed without stopping. A subsequent existing finalizer read-only inspection recovered the persisted ADMITTED envelope after its original descriptor window (`05:25:07.598Z` through `05:27:07.598Z`) had expired. The envelope was never sent to Make, re-signed, re-aged, written to a local plaintext artifact or used for a provider call. Make 6176241 was never activated, patched or run during this attempt. Native outbox remains QUEUED, with receipt/reservation/provider/acceptance fields NULL. The existing authenticated finalizer correctly refused `OWNER_DURABLE_SENT_REQUIRED` without changing the Sheet to SENT.

The new per-ID gate was returned OFF at `05:29:21.194287Z`; the old gate and historical claim were never reopened. Both Vercel fuses were returned FALSE and an exact-main default-OFF redeployment was requested; its final READY/canonical readback belongs in the separate runtime packet. Do not delete/reset the consumed marker, extend the expired descriptor, replay either claim, create another test fixture from this grant or infer provider ACK from admission. A future provider test requires an explicitly governed fresh admission and a verified private same-consumer relay that does not depend on delayed UI inspection. Protected source merge, actual provider ACK, canonical natural runtime and whole-project closure remain separate gates.
