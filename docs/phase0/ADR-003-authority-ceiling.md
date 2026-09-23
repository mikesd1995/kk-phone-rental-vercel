# ADR-003: Agent authority ceiling

Status: Phase-0 implementation decision; nonproduction only.

## Context

Phase 0 must build capability without enabling autonomous P5/P6 or R4/R5 execution.

## Decision

Enforce P4 as the maximum autonomous ceiling and reject production/admin execution paths. Human service administration is a separate trust boundary, never a tool an agent may discover or invoke. Child authority is no wider than parent authority.

## Alternatives considered

Allowing P5 behind a model confirmation or reusing privileged provider credentials was rejected because it would widen the foundation scope.

## Consequences

Approval metadata can be tested locally but cannot override the Phase-0 production boundary. Every new runtime, provider, schedule, write gateway and executor stays OFF.

## Rollback and migration

Future controlled production support needs separate authority design, explicit owner acceptance and an auditable migration. No flag in this Project Pack enables it.
