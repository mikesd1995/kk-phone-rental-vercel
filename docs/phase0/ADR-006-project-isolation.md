# ADR-006: Workspace and project isolation

Status: Phase-0 implementation decision; nonproduction only.

## Context

Identifiers alone do not prove an agent is entitled to query another project, and reused approvals/certificates create cross-project risk.

## Decision

Require workspace_id/project_id throughout records, repository keys, references and service sessions. Every read/write is scoped. Bind delegation, approval, certificate, checkpoint and tool request to the trusted service session; require exact scope equality in Phase 0.

## Alternatives considered

Prompt-only project labels and globally keyed record lookup were rejected. General cross-project delegation is deferred.

## Consequences

Composite DB keys and foreign keys protect integrity; the trusted service must not expose the raw repository or let untrusted callers choose a privileged session. Display names carry no authority.

## Rollback and migration

Add cross-project authority only through a separately reviewed contract. Migrating project identities requires explicit data mapping and preserved historical attribution, never silent reassignment.
