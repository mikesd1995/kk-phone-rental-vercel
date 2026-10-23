# One additional Telegram UAT after private relay expiry

The owner's latest instruction authorizes one additional NEW Telegram test through the existing Make 6176241, with no replay of either historical claim and all send fuses OFF afterward. This additive private Apps Script helper is preparation only. It makes no network/provider call, adds no scheduler or public endpoint, changes no existing send/finalizer/default/v1 helper, and grants no protected source merge authority.

The first Telegram claim `KKUAT_TG_41097307-885b-4aa7-8da2-8db97d4b5e74` / `CLAIM|b871e6e4-ac71-45c8-8587-5f86c3158a16` must remain `ADMISSION_UNKNOWN` with a null envelope. The second claim `KKUAT_TG_caf84575-743a-4cbe-8588-6e8ee6d2532c` / `CLAIM|47af8985-f021-403e-bbbd-1f08dc73f8ed` must remain `ADMITTED`, with its original correctly bound descriptor expired by more than 120 seconds. Its 11-field envelope is checked by the existing validator with historical expiry allowed, but is never logged, returned by the preview, renewed, re-signed or dispatched. Both source and claim ages must exceed 120 seconds. Both actual 23-column Sheet rows must equal their original before-rows plus only Status, Attempt Count, Last Attempt At and the exact claim-note append. Provider/acceptance/error/retry evidence remains empty. Any third malformed or unresolved pending blocks preparation; existing `SHEET_ACK_VERIFIED` pending records remain allowed.

`logOwnerRelayTelegramUatNoSendPreview()` acquires the existing ScriptLock and logs only the two pinned identities/claims/statuses/pending hashes/claimed-row hashes and the prior consumed-marker hash. It never logs candidate, payload, envelope, signature, credentials or other properties. The prior `KK_OWNER_LEDGER_NEW_TG_UAT_GRANT_CONSUMED` marker must remain present and unchanged, identify the second historical item, match its Created At, and preserve the first grant's exact original pending/row binding. Its hash qualifies exact bytes, not permission to reset it.

Fresh native reconciliation must independently prove: the older identity has no map/outbox; the second identity has exactly one matching map and QUEUED expired outbox with NULL receipt/reservation/provider/delivery fields; both historical per-ID gates are OFF; Make 6176241 is inactive/on-demand with module 8 disabled, no incomplete execution and no historical provider dispatch. Refresh live Machine SOT, sole compatible Active GLOBAL policy and locking observations. Malformed historical lease rows must remain disclosed. The native evidence hash below anchors the operator's saved evidence; the source does not claim it can prove live database state from a hash.

Use a distinct non-secret Script Property `KK_OWNER_LEDGER_RELAY_TG_UAT_GRANT_20261023`. Its JSON has exactly eight fields:

```json
{
  "version": "kk-owner-relay-telegram-uat-grant-v2",
  "grant_id": "A fresh lowercase UUIDv4 different from the prior v1 grant ID",
  "owner_authorization_reference": "OWNER_2026-10-23_ONE_ADDITIONAL_NEW_TELEGRAM_UAT",
  "issued_at": "Current canonical UTC ISO timestamp with milliseconds and Z",
  "expires_at": "Later canonical UTC ISO timestamp no more than 300 seconds after issued_at",
  "prior_consumed_grant_sha256": "Exact lowercase 64-hex current preview hash",
  "historical_claims": [
    {
      "notification_id": "KKUAT_TG_41097307-885b-4aa7-8da2-8db97d4b5e74",
      "claim_id": "CLAIM|b871e6e4-ac71-45c8-8587-5f86c3158a16",
      "pending_status": "ADMISSION_UNKNOWN",
      "pending_sha256": "Exact current preview hash",
      "claimed_row_sha256": "Exact current preview hash"
    },
    {
      "notification_id": "KKUAT_TG_caf84575-743a-4cbe-8588-6e8ee6d2532c",
      "claim_id": "CLAIM|47af8985-f021-403e-bbbd-1f08dc73f8ed",
      "pending_status": "ADMITTED",
      "pending_sha256": "Exact current preview hash",
      "claimed_row_sha256": "Exact current preview hash"
    }
  ],
  "native_reconciliation_evidence_sha256": "SHA256 of freshly saved independent native preflight"
}
```

Documentation placeholders above are not a runnable grant. The array must have exactly those two five-field objects in that order. Unknown keys, wrong types, identity/status/hash mismatch, noncanonical/future/expired timestamps, TTL above 300 seconds and reuse of the first grant UUID are rejected before consumption or Sheet write. The script project must be the existing KK Agent, global transport `FALSE`, UAT `FALSE`, and confirmation absent.

Execute `prepareOwnerTelegramUatAfterRelayReconciliation()` only after source installation/exact readback, all property/navigation/deployment preparation, the private relay rehearsal, and the final debugger breakpoint are ready. It consumes its distinct `_CONSUMED` property with the one generated new ID and exact readback BEFORE appending. It then appends one new `TEST` / `TRANSPORT_UAT` / `TELEGRAM_OWNER_ALERTS` / `QUEUED` / attempt 0 row and verifies all prior Sheet values, both old pending strings and the v1/v2 consumed markers after append and after plan storage. The prospective source snapshot remains bounded to 128 data rows and 262144 UTF8 bytes. If any write outcome is unknown, retain the consumed marker and reconcile that recorded ID; never delete/reset/reuse the marker or generate another fixture.

The function logs only seven safe plan fields immediately: status, telegram_notification_id, telegram_content_version, created_at, fresh_until, provider_sends and armed. This avoids an extra editor function switch to read the plan while the source row's own 120-second freshness clock runs. That clock is separate from the signed descriptor's original 120-second TTL during admission. No TTL increase or historical descriptor renewal is part of this change.

Use the existing run/admission and exact ACK finalizer, with the same existing Make consumer and original Telegram connection. One real provider run requires actual message ID/time, durable database ACK and exact Sheet projection before closing the new gate and every fuse. Source tests, a prepared row, admission or this finite Telegram UAT alone cannot prove the natural Scanner/Verifier loop, auto storefront promotion, LINE reporting, X approval/publication or whole-project closure.

## Actual single attempt and final OFF readback

The distinct V2 grant was consumed before creating only `KKUAT_TG_cd84fe0f-ca78-44ed-8b7a-3306dd92bc8e`, Sheet row 46, at `2026-10-23T09:53:38.890Z`. Native admission at `09:54:45.31631Z` bound content version `f13596f8bf693c28280dff0bc5b94464c64cc9ddf02ea9ecd69eac98bb9f78be` to the exact source row. The original signed descriptor window was `09:54:43.622Z` through `09:56:43.622Z`; no timestamp was renewed. All 45 prior Sheet rows remained exactly unchanged, SHA256 `90d3fe138b71d6ab5aff2a4cc819edbceb3e58dbf6ce6d4e9d73855131797ec6`.

Make 6176241 was invoked exactly once, execution `6b346e43610e4318b18ddfb54dc1c1ee`, at `09:56:02.830Z`. Module 6 failed with HTTP Unauthorized before modules 8 and 9 ran; the error completed before expiry. Actual recorded JSON input had eleven correctly typed envelope fields, but its 100-character native test text had become 101 characters because the debugger's U+2026 display ellipsis was captured as data. Native text SHA256 was `b5a18b1001d1b107dcda420a49fd56bf6838b6cee5f9ff7a89d93f57e4fe628d`; the captured text SHA256 was `f41aa09238315beb2b5f2185dd4d39cf026af75a71eb51166c020a877a16a378`. The unchanged handler reproduces `401 SIGNATURE_INVALID` for that mutation with a synthetic signing key. Make did not expose the remote 401 response body, so its precise remote error code remains unobserved; source-supported diagnosis and actual response evidence remain separate.

No Telegram provider ID, receipt, reservation, delivery or durable ACK was created. The new native outbox remains QUEUED with those fields NULL; Sheet row 46 remains SENDING attempt 1. Preserve this consumed grant, claim, original descriptor and uncertainty fence. Do not strip the ellipsis and reuse the signature, replay this identity, mark it SENT, renew its TTL or create another identity under the consumed grant.

Finally, Make was deactivated with module 8 disabled and zero incomplete executions; all three per-ID gates were OFF, with the new gate closed at `09:56:53.31653Z`. Both production flags were restored FALSE and canonical deployment `dpl_3zbMK4oyeYkVBwBap2L6vMbk9Nhn` was read READY at approved main `9d53f6363620a3ff50f79fd43b87eb5edd766c1c`. Actual canonical Prepare and ACK both returned disabled `503` with `send_allowed:false`; the storefront returned `200`. KK Agent health independently reported global transport FALSE, UAT FALSE and the single original `runKKLineMonitor` trigger.

When explicitly invoked against an independently read native anchor, the local exact-data guard described in `OWNER_PRIVATE_RELAY_PREFLIGHT_2026-10-23.md` rejects this representation mismatch before the operator hands data to Make. It is not imported by production and cannot guarantee that a future operator invokes it. It does not establish a successful full-value handoff or provider ACK. A later read-only debugger rehearsal reproduced the shortened display and was stopped before the finalizer network boundary; no safe full-value UI extraction was certified. Positive provider acceptance, credential-store readiness, natural Scanner/Verifier execution and whole-project closure remain unresolved and must not be inferred from source tests or an OFF redeployment.
