# LINE owner-decision durable outbox — 2026-11-12

## Scope and present status

Source-only Draft PR #872 on branch **fix/line-decision-durable-outbox-20261112**; baseline main SHA **735bbf7c159df7f2fd6b93e5324df131727f91c9**. No production writes or deployment. The old LINE path committed an owner decision in Apps Script and pushed to LINE afterwards; a crash after the decision but before the push could leave the booking confirmed with no customer notification. Legacy idempotent replay suppressed a duplicate but could not recover the missed send.

PR #872 implements a **write-ahead durable notification intent**, canonical claim, provider acceptance receipt and fail-closed uncertainty handling. This is *at most one automatic push attempt*, **not** distributed ACID/guaranteed human delivery. The Apps Script source overlaps #852; independently reconcile the two Code.gs diffs before merging either. PR #862 touches related webhook logic, #865 storefront stock and #866 earlier LINE regression tests.

## Two private release gates (both OFF by default)

- GAS ScriptProperties: **KK_LINE_DECISION_OUTBOX_V1_ENABLED=true**.
- Vercel server: **KK_LINE_DECISION_DURABLE_OUTBOX_ENABLED=true**.
- Both must be activated together only after owner-approved staged acceptance. If the new GAS writer returns an outbox contract while the Vercel sender is disabled, server sends no unreserved LINE notification. If the Vercel sender is enabled against an old GAS writer, it also fails closed. One-sided activation may leave customer contact pending manual follow-up.
- Existing preprepared outbox records cannot be downgraded to legacy unreserved delivery if GAS gate is turned off.

## Canonical protocol and privacy

1. Signed owner postback must pass existing HMAC and exact LINE owner identity check. **When the Vercel durable flag is on, the server first calls private side-effect-free lineDecisionOutboxReadiness and requires the deployed GAS version, enabled=true and readonly=true BEFORE submitting any owner decision.** A misconfigured GAS-only or Vercel-only rollout is rejected before an irreversible booking commit when the Vercel flag is enabled.
2. GAS under DocumentLock validates canonical LINE Booking row A:T and its deterministic request marker. With the GAS gate enabled it writes a **PREPARED** outbox record to ScriptProperties and reads it back **before** mutating Booking status. It then commits the approved/rejected booking status, flushes, and independently reads back the same ID, request marker and contact.
3. Outbox key is derived from SHA-256 of Booking ID. Stored record contains version, booking ID, decision, state, timestamps, unique claim ID, and acknowledged LINE provider message ID. It does not store phone numbers, raw customer LINE IDs, message body or tokens.
4. GAS **claimLineBookingDecisionDelivery** under DocumentLock checks exact Booking status/contact and claimable PREPARED state. First caller transitions to CLAIMED; simultaneous/replayed callers cannot push.
5. Vercel verifies version, booking ID, decision, status, claim UUID and recipient against the canonical decision readback. It sends exactly one LINE customer push and requires a legitimate LINE sentMessages[0].id in the provider response.
6. GAS **ackLineBookingDecisionDelivery** binds the exact claim to the provider message ID and verifies persisted SENT status. Only after that acknowledgement may the owner receive a success reply.
7. On provider/receipt/ACK ambiguity, best-effort **markLineBookingDecisionUncertain** sets UNCERTAIN; even when this write fails, persisted CLAIMED still blocks automatic retries.
8. Authenticated **inspectLineBookingDecisionDelivery** is read-only, document-locked and returns only booking ID/status, decision, outbox state and booleans for receipt/manual review. It does not reveal customer contacts, claim ID or provider message ID.

## Failure matrix

| Failure | State | Action |
|---|---|---|
| ScriptProperties unavailable before decision | Booking remains pending | Stop; repair storage and verify before trying again |
| Crash after Booking commit, before claim | PREPARED | Owner-verified replay can safely claim once after canonical readback |
| Concurrent owner decisions / duplicate webhook | CLAIMED | All later provider sends blocked |
| Provider timeout, HTTP failure or missing receipt | UNCERTAIN or CLAIMED | Owner manual reconciliation; never blind resend |
| Provider accepted, ACK result lost | CLAIMED, UNCERTAIN or SENT | Inspect before any human follow-up; never automatically resend |
| Owner reply token expired after ACK | SENT | Customer push not repeated; inspect for owner confirmation |
| Legacy already-confirmed Booking with no outbox | LEGACY_UNVERIFIED | No auto-backfill; manual historical verification |
| Durable Vercel flag ON but GAS flag OFF | Readiness fails before booking mutation | Verify paired flags/deployed source before retry |
| Mismatched GAS/Vercel versions | Contract failure | Stop provider sends and restore paired version |
| Booking status advanced past initial approved status | Status mismatch | Fail closed; manually reconcile stale notification |

## Tests / source verification

- **Node synthetic:** tests/line-decision-durable-outbox-node-20261112.test.js — claim/receipt/ack sequence, replay and crash window, wrong recipient, provider timeout, missing receipt, invalid IDs and mismatched deployed versions.
- **GAS VM synthetic:** tests/line-decision-durable-outbox-gas-20261112.test.js — write-ahead before Booking commit, crash/replay, claim concurrency, forged ACK, uncertain send, private default-off flag, legacy booking and read-only inspection. Read-only readiness/inspection explicitly skip success/error write-audits.
- **Exact-head workflow:** .github/workflows/line-decision-durable-outbox-20261112.yml — verifies checked-out SHA, Node 20 syntax, both test files, full npm test and no production credentials. CI is synthetic; it does not verify deployed GAS or real LINE receipt.

## Release and rollback gate (HOLD)

1. Independently review exact HEAD with security/privacy and GAS ScriptProperties storage limits/retention. Fix overlaps with #852 Code.gs and check #862, #865 and #866 for behavioral conflicts.
2. Inspect the actual deployed GAS version and Vercel alias SHA. Private backup of relevant ScriptProperties, Booking and Owner Locks; never publish customer data.
3. Deploy reviewed source in a protected staging environment with **both flags OFF**; verify legacy behavior remains unchanged, then enable *both* in staging with synthetic Bookings and approved LINE test recipients.
4. Test one successful customer message, provider receipt, owner success, duplicate owner click, crash after Booking commit, provider timeout and manual reconciliation. Require independent reviewer and explicit owner acceptance, exact-head CI green, backup and rollback rehearsal.
5. Only then authorize paired production deployment / synchronized feature gates; verify deployed identity, customer and owner visible behavior and no Booking/stock regressions.
6. If any mismatch occurs, preserve all prepared/claimed/uncertain records, disable sending as appropriate and do not clear claims or retry sends blindly.

**Limitations:** ScriptProperties has bounded storage capacity; a quota failure must block a status commit, not silently drop an intent. Define an owner-approved retention and archival strategy for historical SENT records before production. An HTTP success and message ID are proof of provider acceptance, not proof the customer read the LINE message. Status inspection does not resolve uncertainty automatically.

## Cross-chat record and closure definition

Audit #489; LINE P0 incident #861; implementation PR #872; baseline tests PR #866; stock formula PR #852, webhook PR #862, storefront PR #865. This source implementation is **not** P0 closure until real provider E2E, independent approval, paired deployment and final production readback are recorded. No Merge, Deploy, Sheets, Booking, Owner Lock, secret or LINE provider mutation is authorized by this PR.
