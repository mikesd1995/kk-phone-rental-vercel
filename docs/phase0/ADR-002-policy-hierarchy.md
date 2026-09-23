# ADR-002: Policy hierarchy and deny precedence

Status: Phase-0 implementation decision; nonproduction only.

## Context

Lower-layer project and task instructions must never add authority excluded by a higher layer.

## Decision

Reuse server/agent-governance-contract.js hierarchy and deny intersection. The service must require all five trusted layers, explicit identities and ceilings; immutable version records bind decisions to exact content. Unknown or ambiguous policy fails closed.

## Alternatives considered

Last-write-wins policy and implicit P6 defaults were rejected. Duplicating the existing pure resolver was rejected; the service provides the stricter input boundary around it.

## Consequences

Project Pack metadata is not live Machine-SOT policy and grants no execution capabilities. The highest compatible Active KK policy remains runtime authority for KK business operations.

## Rollback and migration

Add new immutable policy versions for reviewed changes. Do not rewrite accepted historical versions or silently resume checkpoints across a changed version.
