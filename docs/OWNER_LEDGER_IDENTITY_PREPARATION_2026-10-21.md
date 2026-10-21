# Owner Ledger identity preparation — 21 October 2026

Status: SOURCE PREPARATION ONLY. This document grants no runtime authority. The
live Machine SOT and highest compatible Active policy remain authoritative.

## Observed problem and bounded change

The 21 October read of `_Notification_Ledger` contained 41 notifications with
pipe-delimited IDs. The largest ID was 58 UTF-8 bytes. The deployed transport v1
accepts only its existing restricted identifier alphabet; passing a raw Sheet ID
to it fails validation. The staged historical producer starts from a generic
canonical readback rather than an eligible Ledger row and derives identity from
mutable content. Restoring that producer would not satisfy policy122/150/235.

`server/make-owner-ledger-plan.js` prepares an exact mapping in memory. It is not
connected to a route, producer, database, scheduler, Make scenario or provider.
It neither signs nor writes, and every result keeps `send_allowed:false`.

## Fixed namespace and immutable join

This contract version is scoped exclusively to:

- Spreadsheet `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`.
- Tab `_Notification_Ledger`.
- Transport `TELEGRAM_OWNER_ALERTS` and existing `OWNER_ALERT` wire type.

The exact, well-formed raw Notification ID is encoded using UTF-8 and canonical
base64url. Prefixes `ks1_`, `kr1_` and `ke1_` produce notification, request and
entity identifiers. This is a reversible, injective representation for accepted
inputs within this fixed namespace, not a new business entity assertion. Raw
IDs must be 6–93 UTF-8 bytes, so the resulting notification/request identifiers
fit the existing 12–128-character carrier limits. Unsupported lengths and
malformed Unicode are rejected; nothing is stripped, truncated or normalized.

Retry time, status, attempt count, text and Dedup Key cannot mint a new identity.
The exact source tuple, original ID, original Dedup Key and original immutable
content must remain available in the future durable map. A full SHA-256 content
binding uses unambiguous serialization. It provides integrity checking; it is
not described as a mathematically collision-free hash.

The supplied mapping snapshot can detect conflicts locally. It cannot establish
that any mapping was persisted or that another writer did not race. A future
writer must atomically enforce uniqueness for both the source notification
identity and scoped Dedup Key, compare the complete immutable binding, and read
the exact mapping back before an outbox claim. Conflicts require reconciliation;
creating another ID or treating an ignored duplicate insert as proof is unsafe.

The planner checks exact-one source identity, current `QUEUED` state, Telegram
channel, explicit freshness window, input shape and immutable mapping agreement.
The explicit clock/freshness inputs are offline checks, never owner approval or
proof of live policy admission. Existing September queues and quarantine rows
must not be re-aged. Payload rendering/redaction and business eligibility still
require an independent authoritative Ledger reader and current policy.

The preparatory API consists of `encodeLedgerIdentity`, `decodeLedgerIdentity`
and `planOwnerLedgerNotification`. The planner takes the fixed `spreadsheet_id`
and `tab`, `rows`, `exact_notification_id`, explicit `fresh_since` and
`supplied_now`, and `existing_mapping_snapshot`. Each row has all23 exact current
Sheet header names; a future authenticated reader must materialize empty cells
without inventing evidence. The mapping snapshot contains prior `mapping_record`
values with the exact `source_tuple`, `transport_identity` and
`immutable_binding`. The successful result contains an unsigned `descriptor`,
`text_sha256` and `canonical` wire representation; `claim_admitted:false` and
`mapping_persistence_required:true` remain mandatory.

Historical HTTP Status and Provider Message ID cells may contain finite native
numbers. They must not prevent an independent fresh candidate from being
inspected. Any nonempty evidence on the selected candidate still blocks initial
preparation, including numeric zero. Dedup comparisons are scoped to the
Telegram channel; a distinct LINE notification is not a Telegram collision.

The helper plans only an initial zero-attempt candidate. Encoding is stable
across retry metadata changes, but the planner does not authorize or implement a
retry worker. It does not interpret arbitrary payload prose as approval or
establish recipient, quiet-hours or redaction acceptance. A structurally valid
descriptor must never be used as a substitute for those future gates.

## Current authority and proposed binding packet

Fresh policy reads in this continuation found exactly one compatible GLOBAL
v4.9.44 and 458 Active rules (boolean true and string TRUE both count). Policy462
permits independent preparation beyond a blocked gate. Reconciliation1282 still
says `NO_CANONICAL_ENABLE_NO_MANUAL_BUSINESS_OR_SEND`.

| Binding | Observed / required admission |
| --- | --- |
| Current Telegram consumer | Policy225/235 names Make A6176241; inactive in morning native readback |
| Candidate webhook consumer | A6600107 remains held; source availability transfers no authority |
| LINE consumer | Existing Apps Script Ledger-only path under policy225; independent of this Telegram-only contract |
| Durable ledger project | `zehlsagzrpromtfqqflt`; never borrow Primary Inbox bindings |
| Server credential | `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, in the proper server secret store only; actual project scope/ACL/RLS must be reviewed |
| Explicit project fence | `SUPABASE_URL` project must equal `KK_MAKE_OWNER_TRANSPORT_PROJECT_REF` |
| Signing/recipient | Server-only signing secret and independently verified fixed owner recipient; never row/caller recipient |
| Wire protocol | Existing HMACv1 canonical fields, TTL at most120s, fixed Telegram-only audience |
| Outbox admission | Durable exact mapping, fresh eligible row, immutable content, exact enqueue readback |
| Provider proof | Actual Telegram response/target/message ID/time plus exact reservation and durable ACK join |
| Make B | B5988323 is not a fallback sender; morning queue count1 with identity/age unknown |

The 08:24 morning environment metadata showed all transport settings and both
runtime-ledger server-key aliases absent. That observation is a timestamped
baseline, not permission to create bindings. A server-only broad service key is
not automatically least privilege. No key values belong in this document or in
the repository.

## Finite future execution after the specific gates are satisfied

| Action | Required evidence before mutation | Required readback / stop behavior |
| --- | --- | --- |
| Accept one consumer per channel | Fresh live policy and separately reviewed exact binding; reconcile6176241 versus6600107 through the governed policy path | Exact authoritative binding, no second sender |
| Add durable mapping support | Reviewed schema/ACL and single-writer/fencing/transaction plan | Unique source ID and scoped Dedup Key; complete immutable tuple readback; no racing overwrite |
| Stage server configuration disabled | Accepted exact project, secret-store destination, privilege scope and owner recipient | Presence-only metadata and exact project fence; no secret echo or activation flag |
| Admit fresh isolated owner UAT | New explicitly scoped Ledger identity/payload; current policy/locks/transactions and exclusion of old queues | Exact Ledger and mapping/outbox readback; UAT credit remains separate from natural credit |
| Conduct one positive attempt | Specific activation admission, one consumer, dynamic response, fresh signed envelope and unexpired atomic reservation | At most one provider attempt; actual response/target/ID/time retained |
| ACK and join | Actual provider acceptance tied to exact notification and reservation UUID | Exact durable outbox ACK and original Sheet identity/provider/timestamps; API Accepted At is not renamed sent_at |
| Stop / return to approved HOLD | Completed finite UAT or failure/uncertainty | Preserve attempt, reservation, receipt and uncertainty; never reset to QUEUED or retry unknown delivery automatically |

The ACK API's numeric-string validation does not authenticate provider delivery
by itself. Never fabricate a numeric ACK, substitute a manual Make sender or
claim SENT from HTTP200/scenario execution alone. An expired or uncertain
reservation cannot be resurrected by changing timestamps or minting another ID.

The LINE acceptance must use the existing governed Ledger consumer; booking
approval callbacks and Inbox delivery are different subsystems. The historical
14 October P0 notification runbook is retained as historical investigation only.
Its booking-approval/replacement-activation sequence is not current authority
for Scanner notification recovery.

## Separate closure gates

Case17503357 still has no newer causal reply after the approved Scanner follow-up
as of the current 21 October Help/Gmail read. The Verifier archived-results cause
was repaired previously; that does not grant another Scanner restore. Do not
clone, reschedule, create a watchdog, backfill or repeat enable while the live
causal gate remains unresolved.

Whole-project acceptance still requires the future natural canonical occurrence,
exact shared/role locks and Manifest, verified business output and Sheet
readback, safe release and post-slot task persistence, then both Telegram and
LINE provider receipts joined durably to the authoritative Ledger identity.
Offline planning, source tests, hosted CI, deployment health and provider delivery
are separate statuses.

## Source verification in this continuation

The final helper has25 regression tests. Review reproduced three defects before
repair: control characters, channel-scoped dedup ambiguity, and historical native
numeric evidence cells. The retained review RED run has22 passes/3 failures; the
final focused helper/transport run has43/43 passes. Independent helper/transport/
API/gateway verification has68/68 passes. Full local regression has2046/2046
passes plus29/29 poster-ACL checks, with zero failures or skipped tests.

Final source SHA-256:

- Helper: `cf3680655d68c4ce471d8fa723564839edd9402e8fcf2a113d76650cffb31aff`.
- Tests: `3225b28a588fd3867229ed5c6bd1979ca8c63326ed52385b73edeeb875038c73`.

The current production health check still returns source6786e556 and zero
production writes; invalid unsigned Prepare/ACK requests are denied with503
`MAKE_OWNER_TRANSPORT_DISABLED_OR_UNBOUND`. This is denial-boundary evidence
only. The preparation is not deployed, has no hosted-CI or positive provider
acceptance, and grants zero natural-runtime credit.
