# Owner Ledger durable bridge: 21 October 2026

## Scope and status

This change installs an additive, dormant database boundary for the existing
Tracker `_Notification_Ledger` to Telegram outbox identity mapping. It does not
implement the authenticated Tracker reader, Sheet ACK projection, Make sender
admission, LINE sender integration or canonical Scanner/Verifier recovery.

Current Machine SOT was refreshed before the native installation: GLOBAL
v4.9.44, exactly one Active version, 458 Active policy rows. The accepted
Telegram consumer remains Make A 6176241; LINE remains the existing KK Agent
Apps Script consumer. Both canonical tasks remain PAUSED. No provider attempt,
Sheet business write, scenario activation, task edit or schedule change was
made by this change.

## Exact source and native installation

- `supabase/staging/kk-owner-ledger-bridge-v1.sql`: SHA256
  `920424fd2221ebe25e47d4b4ef6105d333fedf67be3e6748c0b595f237ade08e`.
- Independent final review accepted the exact source for a rowless additive
  installation after fresh native preflight. Its staging header records its
  pre-install origin; the actual installation status is recorded here and in
  native migration history, not inferred from that header.
- Ledger project `zehlsagzrpromtfqqflt`, PostgreSQL 17.6; native migration
  **20261021080238**, name `kk_owner_ledger_bridge_v1_20261021`.
- Native catalog readback at 15:02:59 Bangkok confirmed map/outbox counts 0,
  map RLS enabled, only service-role SELECT/INSERT map grants, invoker RPCs,
  empty search paths, and both intended guards installed/enabled.
- Existing claim/ACK bodies were unchanged: MD5(prosrc)
  `b0579d38cd173a9830a367960fe1f400` and
  `9a9190bc72adbdfa771d628d0b3216e8`, respectively.

The migration is transactional and locks the outbox before checking it is
empty. A durable source map fixes Sheet/tab/transport, raw notification ID,
Dedup, audit ID, exact immutable binding text, original descriptor, payload
and expiry. Unique identities and a deferred reverse FK prevent an accepted
map without its exact outbox. Enqueue is atomic, replay returns the original
state without renewing expiry, carrier fields cannot change, and a terminal
row cannot be reset. The existing service caller remains trusted; database
guards do not authenticate a Sheet read or establish provider delivery.

## Findings fixed before installation

1. The original invoker enqueue selected immutable source-map rows `FOR UPDATE`
   despite service_role having only SELECT/INSERT. Removing both locks preserves
   least privilege; immutable rows and unique constraints resolve identity races.
2. The original rollback harness could not record anon/authenticated ACL results
   in its temporary evidence table. INSERT was granted on that temporary table
   only; no production grant was widened.
3. The final migration holds its empty-outbox preflight through installation in
   one explicit transaction and table lock.

## Verification and limits

- `tests/sql/make-owner-ledger-bridge-native-probe.sql`, SHA256
  `64e2de637d7efb7fc7423b0479aad47f7e5e7ca11018d3ac6bea8ff39060cf6e`,
  ran through the native database as a complete single-connection script without
  SQL error: BEGIN, service_role, one anonymous block, ROLLBACK, final readback.
- All 27 assertion paths were reached, including exact enqueue/readback/replay,
  double claim, NULL/invalid/wrong-receipt ACK, immutable carrier/source access,
  Dedup conflicts, reverse-FK orphan rejection and bad-initial-state rollback.
  The client suppresses NOTICE; the final SELECT is evidence only in conjunction
  with the complete exact script succeeding and the separate fresh readback.
- Separate native readback at 15:06:22 Bangkok confirmed map/outbox counts 0,
  no probe functions/triggers, and unchanged original claim/ACK body hashes.
- Synthetic provider ID `123456` existed only within the rolled-back SQL probe.
  No Telegram or LINE request occurred. It is **not a real ACK**.
- Full source regression: 2046 tests plus 29 poster ACL tests = **2075 passed**,
  0 failed, 0 skipped. This suite does not run native SQL or prove deployment.
- The original DDL-based harness remains prepared but was not run. Parallel
  connection race tests and full integration admission remain pending.
- No push, PR, hosted CI, application merge/deploy or production header change
  is claimed by this local source change. Canonical application source remains
  `6786e5568ba3c6a02d2d82594f0c6ba973118932`.

## Remaining integration boundary

Fresh Make 6176241 readback still shows inactive/on-demand, disabled Telegram
send and disabled success/retry writers, last edit 13 October. Its legacy writers
replace all 23 Sheet cells using stale row snapshots without fencing/CAS.
They must be replaced within this accepted consumer, not activated unchanged.

The existing Tracker KK Agent project is
`1NYvGpqhx8QJR6onHX07_8gWxSwIAvhblMDDpMWfYLEKK02sK352J0_WF`.
Its actual read-only health at 09:27 showed LINE configured, Telegram not
configured, transport disabled, UAT unarmed and one `runKKLineMonitor` trigger.
That observation is not a fresh afternoon read. No authenticated private
Tracker HTTP reader or exact ACK writer was found in its function list.

A future finite real-provider acceptance needs the authenticated exact Tracker
reader, accepted single consumers, provider-store binding, fresh eligible Ledger
identity, exact durable map/outbox join, signed TTL120s Prepare/claim, real
provider ID/time, durable receipt-bound ACK and exact Sheet projection. Preserve
API acceptance separately from actual delivery confirmation. Return to approved
HOLD after the bounded attempt; do not replay old queued rows or switch to a
manual/alternate sender. Natural canonical acceptance is a separate gate.

## Support evidence

The owner explicitly authorized a recording without changing either task.
OpenAI case **17503357** requested it at 12:50:58 Bangkok. The Help widget
became blank after reload, so the 23-second cropped browser recording was sent
as a reply to the same case email at **15:01:11 Bangkok**. Native Gmail readback
confirmed SENT message `1a15d7a7dfbd7b86`, existing thread
`1a149ab1c7d902e2`, video/mp4 attachment 513385 bytes. A UI reload retained the
message and attachment. Local video SHA256:
`b6cf62b9fb26e29542b47940f6681c9f9a8d374e190244c6f9097c6b3e36d47f`.

The recording uses consecutive browser captures within read-only scenes,
removes idle gaps, and crops unrelated information. It shows PAUSED tasks,
Custom recurrence, Asia/Bangkok, 31 December 2026, generic latest-run failure,
and inconsistent header/result dates. No task was resumed, retried, saved,
deleted, recreated or rescheduled. This does not establish the historical pause
cause or a supported Scanner correction. Support human receipt/review/reply
after this send remains UNKNOWN until new evidence arrives.

Evidence packet: `outputs/kk-sheet-db-bridge-20261021-0917` outside this checkout.
Cross-chat handoff: `outputs/KK_SHEET_DB_BRIDGE_HANDOFF_2026-10-21.md`.
