# Inbox PostgreSQL receipt integrity — 2026-10-16

## Outcome and scope

Continued existing Draft PR #700 from `73adf54d131b4880458ae7917191e4a646d87d62`; canonical closeout #744 was `b2d42bbe2086ad12bcc0868c508a30de5367f386`, main `a54a348d`. This increment advances actual SQL acceptance and repairs two reproduced privileged-RPC integrity defects. It does not activate the feature or certify Production.

Fresh read-only metadata on `kk-unified-inbox` / `mxjnjujqjybqughsnqbz` (Primary account) reports PostgreSQL17.6 and **no outbound ledger table, reserve RPC or finish RPC**. Therefore the changed SQL is still an unapplied draft migration. No hosted migration or production data, booking, ACL, automation or provider mutation occurred.

## Reproduced defects

1. `kk_inbox_finish_outbound` accepted `SENT` with empty provider identity and zero persisted outbound messages. An invented nonblank provider ID also permitted `VERIFIED_SENT` owner review and a deliberate same-body repeat despite zero matching messages.
2. After a real persisted outbound row and owner verification, a later completion preserved `SENT`, `VERIFIED_SENT` and the original review reference while replacing provider message/request IDs. The matching persisted-message count changed from1 to0. Both `UNCERTAIN` and another `SENT` call could overwrite evidence.

An independent reviewer reproduced both against the original four SQL files under `SET ROLE service_role`. Actual privilege checks deny anonymous and authenticated roles. These are privileged RPC data-integrity failures, **not demonstrated public exploits**. The current server already follows provider receipt → persist exact message → finish, so the repair enforces that established ordering at the database boundary.

## Minimal repair

Modify the pending `20261013152000_kk_inbox_durable_outbound_reservations.sql` without changing its RPC signature, service-only grants, RLS, schema fields or client/UI flow:

- Lock the exact reservation with `SELECT FOR UPDATE` before checking/updating it.
- Reject a conflicting known provider message or request identity, including after owner review.
- Return an already accepted `SENT` receipt without modifying its fields or review evidence.
- Require a nonblank provider message ID and an actual persisted outbound text row for the exact conversation, request UUID, retry UUID and provider ID before transitioning to `SENT`.
- Match the optional provider request header to its persisted value; missing LINE headers remain valid.
- Preserve receipt-free `UNCERTAIN` for provider timeouts and accepted-send/persistence failures. Preserve identical completion retries and normalized uppercase UUID payloads.

No server orchestrator rewrite or speculative refactor was required.

## Actual SQL acceptance and fallback

Native PostgreSQL could not start as a non-root process: the environment maps only UID0; dropping to1000/1001/65534 fails with EINVAL. No paid Supabase branch or new project was created.

The fallback installs **QA-only** PGlite outside the application repository and loads the exact base Inbox SQL, private-media migration, outbound ledger migration and owner-review migration into fresh synthetic PostgreSQL instances. No application dependency or lockfile changed. The standalone acceptance runner blocks global fetch and socket connections, never reads production service keys, and accepts no database URL.

| Evidence | Result |
| --- | --- |
| Original migration, initial32 semantic cases | **24 PASS /8 FAIL** |
| PostgreSQL17.5 WASM / PGlite0.3.14 | **34/34 PASS**,0network attempts |
| PostgreSQL18.6 WASM / PGlite0.5.10 | **34/34 PASS**,0network attempts |
| Dependency-free application full suite | **1,802/1,802 PASS** |
| Routed regression | **89/89 PASS** |
| Full postinstall, including Inbox ship gate | **PASS**,185/185 Inbox checks |

Coverage includes real SQL role denial, RLS/grants, wrong-conversation media metadata, reservation/replay identity, missing/invalid inputs, UNCERTAIN holds, owner review/repeat gating, receipt binding/immutability, exact transaction lock lifecycle, and the existing server store/orchestrator through a local SQL bridge with a synthetic provider. Twenty queued same-backend attempts produce exactly one synthetic provider invocation. **That is not independent-session PostgreSQL concurrency proof.**

The first PG17 lock check reported33/34 because the embedded backend exposes PID0 while its actual advisory lock exposes PID NULL. Investigation proved the lock existed and disappeared on COMMIT. The final check matches its exact64-bit conversation/fingerprint lock identity and asserts0→1→0 on both engines. The failure was diagnosed and the assertion strengthened; it was not silently skipped.

## Reproduction

Install a pinned QA tool in a separate temporary directory, with scripts disabled:

```bash
npm install --prefix /tmp/kk-inbox-qa --ignore-scripts --no-audit --no-fund --save-exact @electric-sql/pglite@0.3.14
KK_PGLITE_MODULE=/tmp/kk-inbox-qa/node_modules/@electric-sql/pglite npm run test:inbox:postgres
```

Use0.5.10 in another QA directory for the PG18 run. The runner fails closed if its explicit module path/version is missing or unsupported; it never installs dependencies itself. Normal `npm test` and `postinstall` retain their existing dependency-free behavior. Do not add the optional engine to application dependencies merely to make the command implicit.

Durable raw baseline and engine results, source hashes, package integrity pins and fallback details are linked in `KK_INBOX_POSTGRES_RECEIPT_ACCEPTANCE_20261016.json`. Historical results remain history; the PR pins the final published source/tree.

## Remaining release gates

Embedded SQL acceptance is now proved. **Independent-session contention, crash recovery, hosted PostgREST/Storage and actual provider delivery are not.** The storage bucket in this harness is a structural local fixture; it does not prove actual image archival or authenticated browser access. Production PostgreSQL17.6 configuration/version acceptance is separate from the two embedded versions tested.

The engineering gate remains BLOCKED on RELEASE_READBACK. Authenticated Admin/LINE visual acceptance, a legitimate fresh image with wrong-room denial, verified booking linkage, Private Core/ACL cutover, natural governed Scanner/Verifier/Make runtime and exact owner-governed release/rollback acceptance remain HOLD. No automatic send, migration replay, scheduler change or paid activation is part of this increment.

Rollback: preserve the starting #700 source above; if any version of this migration is later applied, use an independently reviewed compensating migration rather than rewriting applied history. Do not apply this draft to a live project merely to produce a green test.

Independent final review accepted the scoped SQL/harness diff with no BLOCKER or MATERIAL findings and independently ran PostgreSQL17 acceptance34/34,0network. A minor negative-fixture coupling was then corrected: the wrong-request case retains the actual retry key, testing request identity alone. Final reruns remain34/34 on both engines. The optional runner fails closed without an explicit external QA engine; syntax checks pass.
