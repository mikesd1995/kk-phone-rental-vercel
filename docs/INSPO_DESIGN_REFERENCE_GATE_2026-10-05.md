# Inspo Design Reference Gate — 2026-10-05

## Purpose
Use Nutlope/inspo as a read-only design-intelligence layer before major KK storefront design work. It does not replace KK Art Director, Design Council, Visual QA, owner acceptance, or business truth.

Upstream reviewed: https://github.com/Nutlope/inspo (MIT). Upstream describes a read-only MCP catalogue of real production websites, mobile/desktop captures, design-system extraction and a recommend(brief) workflow.

## Required flow
For redesign / new surface / new page / visual-system / major-layout work:

brief -> Inspo research -> evidence packet -> KK Art Director synthesis -> Design Council -> single implementation writer -> rendered multi-viewport Visual QA -> owner acceptance.

Small bugfixes, copy fixes and data fixes do not require Inspo.

## Evidence contract
A required packet must record:
- provider = Nutlope/inspo
- research brief/query
- at least 3 reference identifiers/URLs returned by research
- patterns KK intends to adopt
- patterns KK explicitly rejects

Fail closed if the reference set is absent/thin. Inspo is reference-only and may never become price, inventory, booking, event, or acceptance authority.

## Copyright / originality boundary
References are for analysis and synthesis. Do not copy a site's page or component verbatim. Preserve source attribution in research evidence where applicable. KK must synthesize its own brand-fit implementation.

## Availability fallback
If Inspo MCP is unavailable, do not pretend it ran. Major redesign remains blocked on this gate unless the owner explicitly chooses a documented alternative reference-research path. Existing production and bugfix work continue unaffected.

## Cost / safety
Default path is read-only and zero production writes. Do not self-host, install paid AI dependencies, or enable paid external AI merely to satisfy this gate.

## Acceptance
Unit tests cover mandatory-vs-optional classification, fail-closed evidence, reference-only authority, and anti-copy/business-truth boundaries.
