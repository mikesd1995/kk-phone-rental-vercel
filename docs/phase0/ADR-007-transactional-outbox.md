# ADR-007: Transactional outbox

Status: Phase-0 implementation decision; nonproduction only.

## Context

External effects cannot share a database transaction with remote providers, and retries can create duplicate sends.

## Decision

Persist a scoped idempotent outbox intent, payload hash and mandatory audit reference atomically with local intent state. Phase 0 stores intent only: no active external, notification or production outbox worker is provided.

## Alternatives considered

Direct provider sends inside transactions and blind retry on timeout were rejected.

## Consequences

A committed intent is not SENT. The future executor must reconcile ambiguous transport outcomes and verify provider/readback identity before declaring success. Compensation metadata records required action without assuming every partial failure should roll back.

## Rollback and migration

Rollback of unexecuted local intent is an auditable state transition. Once a future external effect may have occurred, reconcile before retry or compensation; never infer delivery from an outbox row.
