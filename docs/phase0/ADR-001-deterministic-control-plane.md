# ADR-001: Deterministic control plane

Status: Phase-0 implementation decision; nonproduction only.

## Context

PR #152 supplies governance primitives, but model output alone cannot establish scoped execution authority or durable state.

## Decision

Keep deterministic platform contracts and service operations independent of model providers. Models and external tools supply untrusted proposals. Phase 0 registers no production or external executor and activates no agent runtime.

## Alternatives considered

Prompt-only enforcement was rejected because external text can attempt to change policy. A provider-specific agent framework was deferred because it is unnecessary for durable control-plane tests.

## Consequences

Tests can exercise local state transitions and failure boundaries without an AI provider. A policy helper is not itself an authenticated authority service.

## Rollback and migration

Preserve the existing KK runtime and remove the isolated platform modules through a reviewed revert. Future execution wiring requires a deliberate integration change and acceptance evidence.
