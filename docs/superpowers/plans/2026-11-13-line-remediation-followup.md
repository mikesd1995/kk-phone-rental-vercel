# LINE booking follow-up remediation

**Goal:** Complete authorized source and verification work on existing PR #875, keeping Production on release hold.

**Spec:** Owner master task dated 13 November 2026 and `docs/KK_LINE_MASTER_REMEDIATION_20261113.md`.

**Architecture:** Preserve the existing signed webhook, canonical Apps Script writer/document lock, consent RPCs and one-time decision outbox. Correct boundary validation and bounded transport in place. No alternative outbox, runner, business writes or feature activation.

## Invariants and review focus

- A customer booking must originate in a private LINE user conversation, including legacy consent mode. Owner group destinations remain explicit and valid.
- A canonical recipient must match the same exact provider-issued user ID contract before a Booking changes.
- Capacity blocks admission of new outbox intents before mutation; existing receipt reconciliation remains possible.
- Network deadlines never authorize retries or claim delivery. Post-claim timeout remains uncertain/manual review.
- Cookie/session state alone cannot establish consent. No migration target is inferred from connected account availability.
- Full tests, native disposable SQL and exact-HEAD CI are distinct from live provider and Production acceptance.

## Tasks

- [ ] Reproduce group/room booking admission using synthetic events; reject at webhook and intake boundaries; update positive fixtures to actual provider source shape.
- [ ] Reproduce malformed canonical outbox recipients and full-capacity admission; reject before Booking/intent changes; retain claims/settlement for existing records.
- [ ] Reproduce indefinite network waits; add one reusable six-second deadline without retries; cover fetch/body timeout and durable uncertain settlement.
- [ ] Inspect the audited dependency chain, choose the smallest supported security update, and verify the lockfile and existing OIDC regressions.
- [ ] Run full repository, scoped integration, syntax, native consent and responsive technical checks; obtain independent diff review.
- [ ] Commit source/test/documentation, update existing #875 using a refreshed exact-head lease, observe exact-HEAD CI and update #861.
- [ ] Record refreshed live metadata, environment names, blocked release gates, rollback and next-session state. No merge, Production deployment, real send, Booking write or database migration.

## Execution ledger

- Baseline: #875 `11e3eace5dcf4c384e7767a8ce7a9aa9008c6318`; main/Production `735bbf7c159df7f2fd6b93e5324df131727f91c9`.
- Ruling: continue integrated #875 because all named donor PRs explicitly point there. Do not create a duplicate PR.
- First local full run exposed missing installed TypeScript and Windows checkout line-ending differences in byte/hash tests. Install locked dependencies without scripts and restore exact Git blob bytes; retain failures in local evidence and rerun without weakening assertions.
- Native consent baseline: 11/11 disposable PostgreSQL checks passed; no live schema changed.
