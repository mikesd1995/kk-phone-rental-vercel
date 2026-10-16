# Inbox — native PostgreSQL multi-session and process-crash acceptance

Recorded16October2026. Scope: continue the remaining isolated DB gate on existing Draft PR#700, starting source27aa4ec232760fa70f505e4b51373188457cfb8d/tree68ef9d12c7b49c5838a6b511fc135a3033841c6d; canonical#744ad64cf9413d9d664bc17fcf2e5737f6121dc6b5c. Final published head/tree is read back and pinned in the PR and canonical closeout checkpoint. This increment adds QA/reproduction/evidence only; application/API/Admin/server/SQL/package/middleware bytes remain unchanged.

## What improved

| Previous evidence | New proven evidence |
| --- | --- |
| Embedded PostgreSQL single backend, queued20requests | Unmodified native PostgreSQL17.11 in a separate Linux kernel;8actual independent backendPIDs issue requests and one reservation wins |
| Advisory lock present only within one connection |5holder/waiter pairs have different backendPIDs, exact64-bit advisory-key identity and `pg_blocking_pids` attribution; waiter resumes correctly after commit/rollback/backend termination |
| Crash and transaction-loss behavior unverified |6immediate PostgreSQL stop/start recoveries, each confirmed by unclean `pg_controldata` state before restart; committed request/receipt/owner-review state survives and ambiguous sends stay held |
| No native regression guard for missing advisory lock |Ephemeral-copy lock-removal control removes exactly2definitions and fails at the expected advisory-wait assertion:2PASS1FAIL/exit1; normal source15/15/exit0 |
| Host can map only root and cannot run normal PostgreSQL |Disposable offline QEMU TCG guest gives postgres realUID70 without patching binaries or using a paid hosted database |

Parent final and independent reviewer runs both **15/15 PASS**,8distinct burst backendPIDs,5exact advisory waits,6unclean process/WAL recoveries. Full app **1802/1802**, Code Intelligence routed **96/96**, postinstall/Inbox ship **185/185**, Python/shell syntax and diff checks PASS. Reviewer found0BLOCKER/0MATERIAL. Earlier combined Core1934/1934+26/26 ACL evidence is retained with exact runtime/SQL byte parity; this increment does not pretend to rerun a new combined candidate or deploy one.

## Actual boundaries tested

- Service-role RPC grants and actual anon/authenticated denials; all4private tables retain RLS.
- A second backend waits for the holder on the exact conversation/body lock. Commit yields one reservation; rollback/termination lets the waiting request become sole winner. Same UUID never creates a second row.
- Different body fingerprints and conversations can progress while another reservation transaction stays open.
-8simultaneous independent backends create one reservation. These are actual PostgreSQL sessions, not a socket multiplexer over PGlite.
- Immediate server crash after reservation, after a synthetic provider marker, after message persistence and after SENT. Unresolved status blocks a new-click request after restart; the persisted receipt can finish without another provider call.
- Owner evidence and explicit deliberate-repeat reservation survive restart. A held deliberate repeat remains unresolved; concurrent repeat clicks still have one winner.

`qa.provider_calls` is a synthetic local fixture representing the boundary where an external provider might already have received a call. It does not send LINE and does not certify the actual server-to-provider HTTP path. The existing embedded acceptance separately exercises the real Node sendOnce/store sequence against SQL.

## Isolation and reproducibility

The checked-in [runner instructions](../scripts/qa/inbox-postgres-vm/README.md) describe explicit preparation and execution. Assets are pinned in assets.lock.json and downloaded/extracted outside the app. No app dependency/lockfile, package install, maintainer script or service activation is added. Ubuntu index authenticity and package SHA256 were checked; Alpine packages are pinned from official HTTPS repository bytes. An offline complete-cache preparation was independently exercised before final runs. Partial preparation is rejected by a readiness marker.

QEMU8.2.2TCG runs Linux6.12.112 with512MiB/2vCPU. No guestNIC, host share, host disk, monitor, service URL or inherited credential environment is provided. PostgreSQL17.11 runs asUID70 and listens only on a private Unix socket. Both fsync and synchronous_commit are on. Test timeout300seconds, bounded per-lock waits, temporary guest cleanup and strict15-case/8PID/6crash completion evidence prevent partial success from becoming PASS.

## Failures retained and alternate routes

Host setuid/user namespace was unavailable; a PGlite socket multiplexer is still one backend and was rejected for this gate. The first QEMU relocation missed module/option-ROM paths; explicit paths solved that. Initial PostgreSQL config quoting failed before tests; a fixed file solved it. A functional4PASS1FAIL run exposed an incorrect test expectation that idle psql must exit nonzero after server termination; server disappearance, rollback and waiter identity now prove the actual invariant. Fresh asset preparation found legitimate package hard links; safe delayed link extraction and a completion marker replaced the incomplete bootstrap. None required product SQL changes or weakening a business invariant.

The deliberate no-lock negative control is an expected failure and **must remain RED**. Original and executed SQL hashes are both recorded so the modified guest-only control cannot be confused with normal acceptance. The real repository SQL was never altered by that control.

## Remaining limits and next action

The database is inside guest RAM. This proves PostgreSQL **process/WAL recovery while guest RAM is retained**, not VM/host power loss or disk-device durability. Native17.11 is the same major version but not the hosted Supabase17.6 build/configuration. Storage remains a structural fixture.

The isolated native multi-session/process-recovery subgate is now PASS. Hosted PostgREST/private Storage, actual provider receipts/new private image/wrong-room denial, authenticated Admin/LINE visuals, booking linkage, Private Core/ACL cutover, natural governed runtime/business facts, exact hosted CI and owner-governed release/rollback still require legitimate evidence. Actual engineering-gate evaluate remains BLOCKED on RELEASE_READBACK. No production migration, customer/provider send, Booking/ACL/automation mutation, main merge, deployment or paid resource occurred.

Cross-chat start: refresh source heads, read `KK_INBOX_NATIVE_POSTGRES_ACCEPTANCE_20261016.json` and canonical#744 checkpoint. Do not repeat the solved root-UID/PGlite-concurrency dead end. Use the pinned local VM reproducer if SQL/harness changes; otherwise continue only the genuinely unverified hosted/owner gates. Keep the other thread's storefront UI work intact.
