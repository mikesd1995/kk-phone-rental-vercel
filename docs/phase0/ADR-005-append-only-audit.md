# ADR-005: Append-only audit strategy

Status: Phase-0 implementation decision; nonproduction only.

## Context

Governed local state mutations must not succeed while their required audit history is missing.

## Decision

Persist mandatory audit records in the same transaction as local state and idempotency records. Historical events are append-only, scoped and hash-linked or content-hashed for integrity verification. Reject update/delete through repository and DB guards.

## Alternatives considered

Best-effort logs and mutable audit rows were rejected because failure could hide an accepted state change. A separate remote audit service was deferred.

## Consequences

Audit storage failure rolls back the local transaction. Hashes make corruption detectable; they are not a signature against a malicious host administrator with unrestricted DB access. Retention and legal hold remain human-controlled.

## Rollback and migration

Never repair evidence by overwriting history. Record subsequent reconciliation events. Rollback SQL is for an explicitly isolated disposable fixture, not a way to erase a populated audit database.
