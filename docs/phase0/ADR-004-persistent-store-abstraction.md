# ADR-004: Persistent-store abstraction

Status: Phase-0 implementation decision; nonproduction only.

## Context

Persistence must survive restart without requiring a live shared database or coupling Agent Core to a vendor.

## Decision

Use a scoped repository interface with a local SQLite adapter through Node 24 node:sqlite. SQL artifacts version schema 1 and local migration integrity. Use parameterized queries, transactions and compare-and-swap versions behind the service boundary.

## Alternatives considered

Shared Supabase provisioning was rejected for Phase 0. An in-memory-only store cannot prove restart recovery. A new npm database dependency was unnecessary.

## Consequences

Node 24 is required for the isolated platform suite; the existing production runtime need not change. SQLite is a trusted local service store, not an agent-accessible SQL sandbox or multi-user network database. Host/OS compromise is outside these application controls.

## Rollback and migration

Keep SQL up/down artifacts and test them only against isolated disposable databases. Unknown schema versions and changed migration content fail closed. A future vendor adapter must preserve repository contract tests and explicit migration plans.
