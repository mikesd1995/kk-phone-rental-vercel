# ADR-008: Approval replay protection

Status: Phase-0 implementation decision; nonproduction only.

## Context

An approval for one diff, project or environment must not authorize another operation or be replayed after use.

## Decision

Bind durable approval identity to proposal, workspace/project, environment, target, capability, risk, exact change hash, nonce and expiry. Consume single-use mutation approvals atomically with the governed local operation and audit. Approvers come from trusted host configuration.

## Alternatives considered

Unsigned approver text from a model and an approval boolean were rejected. Reusable approvals across preview and production were rejected.

## Consequences

Reuse the existing canonical change hashing primitive but enforce full binding outside its minimal helper. An approval never bypasses the Phase-0 authority ceiling or kill switches.

## Rollback and migration

A changed proposal requires a fresh approval. Revocation and consumption are historical state; do not reset used approvals to active. Future external execution must preserve the same replay boundary.
