# ADR-009: Capability certificate lifecycle

Status: Phase-0 implementation decision; nonproduction only.

## Context

A skill or agent role describes capability but does not grant permission to execute.

## Decision

Persist certificates bound to subject agent, workspace, project, environment, capabilities, ceiling, issuer, version, content hash and expiry. Require trusted issuance and fresh active lookup. Missing, expired, revoked or mismatched certificates deny execution.

## Alternatives considered

Self-issued certificates and authority derived from skill presence were rejected. Provider identity is not an authorization certificate.

## Consequences

Authority-bearing certificate content is immutable. Revocation narrows authority without rewriting the original grant. An agent cannot obtain a new privilege through delegation or fallback.

## Rollback and migration

Issue a new certificate version under trusted administration for changes. Preserve revocation evidence and reject checkpoints or active runs when security-critical certificate identity drifts.
