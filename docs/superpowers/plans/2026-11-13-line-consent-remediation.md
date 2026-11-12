# LINE consent native verification and remediation plan

**Goal:** Repair proven source defects in the coordinated LINE release candidate and leave executable evidence without changing Production.

**Architecture:** Continue existing integrated PR #875, which already contains #871 consent and owner safety. Keep #871 and related donors as dependency references, never merge them independently. Use the existing disposable PostgreSQL CI runtime; no live database credentials or new runtime dependencies.

**Spec:** Owner CODEX MASTER TASK, 13 November 2026; `docs/LINE_BOOKING_COORDINATED_RELEASE_HANDOFF_20261112.md`.

## Constraints and invariants

- Release HOLD: no merge, Production deployment, real feature activation, real Booking/Owner Lock edits, customer messages or self-approval.
- Verified LINE identity plus persisted current-version evidence remains required. No cookie/localStorage authority.
- Keep canonical writer, lock, idempotency and outbox boundaries intact.
- Separate source/mock, disposable PostgreSQL, hosted Preview and real provider acceptance.

## Review focus

- Execute first acceptance and duplicate acceptance in PostgreSQL, rather than inspect SQL text.
- Reject revoked/expired sessions and isolate provider/account/Terms versions.
- Verify anon/authenticated cannot access either private evidence or service RPCs.
- Reapply the migration safely on its own candidate schema.
- Never turn a malformed canonical recipient into an outbound customer notification.

## Task 1: Native consent proof and minimal SQL correction

Files: `scripts/test-customer-auth-native.mjs`, `supabase/kk_customer_auth_v1.sql`, `.github/workflows/canonical-owner-v2.yml`.

- [ ] Add a disposable PGlite test against the exact migration, including real first acceptance, replay, expiry/revocation, isolation and role-denial checks.
- [ ] Reuse the existing pinned PGlite CI installation; extend its existing trigger paths and run the probe on exact HEAD.
- [ ] Observe a native failing acceptance before correcting implementation.
- [ ] Resolve the ambiguous conflict target with an explicit unique constraint; run native verification again.
- [ ] Run existing consent/API regression and full exact-HEAD CI.

## Task 2: Independent review, release evidence and handoff

Files: only source/test paths justified by concrete reviewer findings, plus `docs/KK_LINE_MASTER_REMEDIATION_20261113.md`.

- [ ] Triage independent review findings; reproduce material defects before minimal fixes.
- [ ] Read back current PRs, exact checks, Production SHA, env names and database schema without secrets/customer rows.
- [ ] Record all source changes, commands, actual results, migration/rollback steps and external blockers.
- [ ] Update #861 and relevant PR metadata; keep independent GitHub approval and live provider acceptance explicitly BLOCKED.

## Session ledger

- Discovery: main/Production `735bbf7c159df7f2fd6b93e5324df131727f91c9`; primary #871 `94617a8bc0f659f1b240eda8edfb5d1acbd0a3f3`; integrated #875 `8972a3255fc288a850fddb44f5115b55779a49ad`.
- Ruling: use existing #875 for coordinated fixes because its current tree already contains the #871 behavior plus guarded owner outbox; updating donor #871 alone would create drift. No new PR.
- Local clone failed DNS. Exact-ref connected source snapshot is used for local tests; remote exact-HEAD Actions supply complete-repository/native validation.
- Existing local consent/API tests: 20/20 PASS. This does not execute the SQL migration.
- Read-only connected active Inbox database contains neither customer auth table; this is not authorization to choose it as the migration target.
