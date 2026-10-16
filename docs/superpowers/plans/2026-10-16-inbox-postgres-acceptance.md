# Inbox PostgreSQL Acceptance Implementation Plan

**Goal:** Execute the staged Inbox SQL and server orchestration against an isolated actual PostgreSQL engine, repair reproduced database integrity failures, and preserve honest release gates.

**Scope:** EXISTING PR #700, starting remote73adf54d131b4880458ae7917191e4a646d87d62/local8bec0b9b. Canonical closeout #744 b2d42bbe2086ad12bcc0868c508a30de5367f386, main a54a348d. No new broad candidate, deployment or production state change.

**Constraints:** No paid branch/database, no real LINE messages, no production migrations/data/ACL/schedule changes, no application runtime dependency. Native PostgreSQL cannot run with the environment's sole mapped UID; use externally installed, integrity-pinned QA-only PGlite0.5.10 / PostgreSQL18.6 WASM. It is a real SQL backend but only one session: multi-session advisory lock contention and hosted service acceptance remain UNVERIFIED.

**Files:** Create `scripts/accept-inbox-postgres.cjs` (fail-closed optional local acceptance runner), durable acceptance doc/manifest; modify only reproduced outbound migration integrity boundary plus explicit test command and necessary guards.

**Invariants:** Only service_role accesses Inbox functions/private tables. Real source SQL is loaded unchanged into a fresh synthetic database. Exact conversation media membership, immutable request identity, duplicate holds, owner-verified intentional repeat, receipt identity and monotonic state survive failures. Never treat a queued single-backend race as multi-session proof.

## Execution

- [x] Refresh current PR heads; inspect context pack, SQL/backend boundaries and scoped rules.
- [x] Prove native fallback constraint (uid_map only0; unprivileged UID drops failEINVAL); install pinned QA-only engine outside application; execute all4 source SQL files successfully.
- [x] Add real SQL role/media/reservation/review/orchestration acceptance, including receipt integrity negatives; record RED before migration changes.
- [x] Repair only demonstrated integrity failures; preserve current server call sequence and useful UNCERTAIN behavior; run the same acceptance GREEN.
- [x] Independent review, targeted/full/postinstall regression and engineering-gate readback; keep live/concurrency gaps explicit.
- [ ] Publish exact tested tree on existing #700 with expected-head protection; update #744/Issue49 with SHA, evidence, failures/fallback and next action.

**Review focus:** A false SENT status without persisted receipt; receipt overwrite after owner verification; ordinary roles accessing service RPCs; wrong-room media; ambiguous provider persistence; accidental production/network use by the harness.

**Decision:** User has authorized continued implementation and GitHub continuity without repeated planning questions. Native multi-session DB could not start; the embedded SQL alternative advances syntax/privilege/state acceptance, with no claim that it closes the remaining concurrency gate.

- Proven RED24/32 with8receipt-integrity failures. Repaired source passes34/34 on PostgreSQL17.5/PGlite0.3.14 and18.6/PGlite0.5.10, with0network attempts. PG17 initial lock-filter failure was diagnosed as PID metadata, corrected by exact64-bit lock identity (0->1->0), not by removing the assertion. Application full1802/1802, routed89/89, postinstall/ship185 PASS.
