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

- [x] Add a disposable PGlite test against the exact migration, including real first acceptance, replay, expiry/revocation, isolation and role-denial checks.
- [x] Reuse the existing pinned PGlite CI installation; extend its existing trigger paths and run the probe on exact HEAD.
- [x] Observe a native failing acceptance before correcting implementation.
- [x] Resolve the ambiguous conflict target with an explicit unique constraint; run native verification again.
- [x] Run existing consent/API regression and full exact-HEAD CI.

## Task 2: Independent review, release evidence and handoff

Files: only source/test paths justified by concrete reviewer findings, plus `docs/KK_LINE_MASTER_REMEDIATION_20261113.md`.

- [x] Triage independent review findings; reproduce material defects before minimal fixes.
- [x] Read back current PRs, exact checks, Production SHA, env names and database schema without secrets/customer rows.
- [x] Record all source changes, commands, actual results, migration/rollback steps and external blockers.
- [x] Update #861 and relevant PR metadata; keep independent GitHub approval and live provider acceptance explicitly BLOCKED.

## Session ledger

- Discovery: main/Production `735bbf7c159df7f2fd6b93e5324df131727f91c9`; primary #871 `94617a8bc0f659f1b240eda8edfb5d1acbd0a3f3`; integrated #875 `8972a3255fc288a850fddb44f5115b55779a49ad`.
- Ruling: use existing #875 for coordinated fixes because its current tree already contains the #871 behavior plus guarded owner outbox; updating donor #871 alone would create drift. No new PR.
- Local clone failed DNS. Exact-ref connected source snapshot is used for local tests; remote exact-HEAD Actions supply complete-repository/native validation.
- Existing local consent/API tests: 20/20 PASS. This does not execute the SQL migration.
- Read-only connected active Inbox database contains neither customer auth table; this is not authorization to choose it as the migration target.

- Native RED proved on test-only commit e163cdfe1faac7a3f620dbe10120f4d039c16142, Actions run 43295709740, job 131453370863: 7/10 passed, first acceptance PostgreSQL 42702 column reference provider_id is ambiguous; two dependent receipt checks failed. Existing full Node regression passed.
- Implementation: explicit kk_customer_terms_identity_version_key constraint removes the OUT-parameter conflict; the authenticated API and SQL grants are unchanged. Migration reapply and real role-denial remain required.

- Task 1 complete: native original 42702 RED -> GREEN; upgrade 42704 RED -> GREEN with function-local #variable_conflict use_column and original unique index. Native 11/11 PASS.
- Task 2 code complete: independent review P1 legacy recipient and P2 notification replay guards each RED -> GREEN, full signed owner approve/reject fixture added. Local 163/163 scoped tests PASS; source commit 1a926aeab853638698f6b2d472547e020855b4bc.
- Final source runtime fix supersedes the named-constraint approach described in the earlier ledger; existing-schema compatibility is now tested.
- Fresh actual LINE shop channel2011794771/provider2005383568 webhook verified Success with an empty events array. No customer/owner send, no settings changed. Same-provider Login channel absent.
- Current Core backend metadata31 tabs, no19_Line_Decision_Outbox. Production unchanged; live acceptance and independent GitHub APPROVED review remain BLOCKED.
- Full handoff: docs/KK_LINE_MASTER_REMEDIATION_20261113.md. Final exact-HEAD CI and branch readback are recorded in #861 after documentation commit.
