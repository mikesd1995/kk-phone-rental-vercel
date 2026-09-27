---
name: kk-supabase-migration
description: Use for KK Phone Rental Supabase schema, RLS, privilege and runtime-ledger changes. Enforces least privilege, migration readback and append-only audit semantics where applicable.
---

# KK Supabase Migration

## Preflight

Identify exact project/table/function, read current schema/constraints/privileges, define rollback or compensating migration, and do not mix business-data repair into schema migration.

## Migration safety

- Prefer additive/backward-compatible changes.
- Preserve RLS unless explicitly approved otherwise.
- Explicitly REVOKE inherited/default privileges before GRANT when least privilege matters.
- Keep runtime audit ledgers append-only unless their contract requires mutation.
- Constrain business-write/publish counters at DB level when zero-write is an invariant.

## Readback

Verify migration history, constraints, RLS, anon/authenticated/service-role privileges, bounded integrity checks and no unexpected UPDATE/DELETE authority. Record exact migration version in repo.
