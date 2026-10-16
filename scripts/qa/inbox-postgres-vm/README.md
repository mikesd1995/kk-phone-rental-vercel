# Native PostgreSQL Inbox acceptance (QA only)

This optional runner executes the exact four staged Inbox SQL files inside a disposable Linux VM. PostgreSQL17.11 runs unmodified as guest UID70. QEMU8.2.2 uses TCG,512MiB,2vCPU, no network adapter, host shares, host disks or inherited service credentials. PostgreSQL listens only on a guest Unix socket. No SaaS resources, app dependencies, package installation, runtime/Booking/ACL/automation changes or real provider sends occur.

## Reproduce

Prerequisites: x86_64 Linux, Python3, `dpkg-deb`, and permission to run a user-space QEMU process. Asset downloads are an explicit separate step; the test never installs anything or connects to a database URL.

```sh
python scripts/qa/inbox-postgres-vm/prepare.py --tools /tmp/kk-inbox-vm-assets
python scripts/qa/inbox-postgres-vm/run.py --tools /tmp/kk-inbox-vm-assets --report /tmp/kk-inbox-native-acceptance.json
```

Use a **new** absolute directory outside the repo for prepare. Downloads come only from the pinned official Ubuntu snapshot and Alpine repository URLs, with exact SHA256 from assets.lock.json. Ubuntu package indexes used to establish the lock were checked against a GPG-verified InRelease. Alpine package pins were established from official HTTPS repository bytes. No package maintainer scripts execute. An optional `--package-cache /absolute/complete-cache` makes prepare fully offline; missing or mismatched cache files fail without downloading. A readiness marker is written only after complete extraction and executable hash verification; a partial asset folder is rejected.

The runner emits a JSON report and neighboring serial `.log`. Exit0 requires all15 unique cases,8distinct burst backendPIDs,6unclean-control-file/immediate-stop/start observations and the final guest completion marker. Missing/incomplete evidence fails closed. QEMU is bounded to300seconds and its temporary VM filesystem is deleted after the process ends. Asset packages remain in the explicitly selected QA directory for reuse.

## Prove the guard catches a defect

```sh
python scripts/qa/inbox-postgres-vm/run.py --tools /tmp/kk-inbox-vm-assets --report /tmp/kk-inbox-no-lock.json --negative-control-no-lock
```

**Expected: exit1/technical_pass=false.** This option removes exactly2 advisory-lock statements only from ephemeral copies of the two reservation SQL definitions. It never modifies repository SQL. The same waiter assertion must fail because the second backend completes before the first transaction commits. Reports pin both original and actually executed SQL hashes and mark the negative control explicitly. Restore normal invocation for acceptance; never use a control result as release evidence.

## Cases and limits

Tests cover true independent-session advisory wait/blocking identities; one-winner commit, rollback, backend termination, same-ID retries; independent body/room progress;8simultaneous requests; committed RESERVED/provider ambiguity/persisted message/SENT/verified-review and deliberate-repeat state after6immediate PostgreSQL process crashes; and concurrent deliberate-repeat clicks. A synthetic `qa.provider_calls` table models the already-invoked provider boundary without sending any external message. RPC grants/RLS are checked with actual roles and denials.

The VM database uses RAM-backed storage. `fsync=on` and `synchronous_commit=on` plus unclean `pg_controldata` state and actual restart prove **PostgreSQL process/WAL recovery within the running VM**, not host/VM power loss, disk-device durability or Supabase17.6-specific behavior. Storage is a structural fixture. This does not certify hosted PostgREST/private Storage, real provider receipt/image bytes, authenticated visual QA, booking linkage, Production cutover or release/rollback. Those gates remain separate.
