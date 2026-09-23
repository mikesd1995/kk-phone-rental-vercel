# ADR-010: Sandbox and credential boundary

Status: Phase-0 implementation decision; nonproduction only.

## Context

Input checks cannot safely execute arbitrary code in the same trusted process that owns control-plane storage.

## Decision

Provide deterministic URL/path/schema/redaction guards and a deny-only credential boundary for Phase 0. Do not execute arbitrary shell, agent-supplied callbacks, provider traffic or production credentials. Only trusted local test fixtures may exercise declared local tool behavior.

## Alternatives considered

Using the host process as a general code sandbox or falling back to privileged tools was rejected. Adding a container service is deferred until an executor is required.

## Consequences

Lexical SSRF/path checks do not constitute network or OS isolation. Future network executors need DNS/redirect validation and connection enforcement; future engineering execution needs OS/container isolation, quotas, isolated filesystem and no production secret mounts.

## Rollback and migration

No external executor needs rollback in Phase 0. A future sandbox is a separately reviewed service integration; failure to prove its boundary must deny execution rather than use the host or production.
