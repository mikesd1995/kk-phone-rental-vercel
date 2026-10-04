# KK Phone Rental — Architecture Contract

## Purpose
Canonical high-level map of authority and flow. Source code and current runtime evidence remain authoritative for implementation/version details.

## Core flow
Public/partner evidence -> Discovery Scanner (staging only) -> commercial evidence -> governed Verifier -> governed writer -> canonical business truth -> public storefront/read models.

Booking/customer intake -> governed booking path -> canonical booking/inventory truth -> availability/read models -> storefront/admin.

Agent Gateway -> registered specialist agents -> invocation/decision evidence -> owner/reviewer gates. Agents advise or prepare governed actions; registration does not grant business-write authority.

## Authority boundaries
- Discovery is evidence/staging, never final truth.
- Verifier governs event verification/promotion under current policy.
- Pricing, booking, inventory and Machine SOT writes use existing governed writers only.
- Owner-hidden/tombstoned events must not resurrect implicitly.
- Public UI consumes sanitized customer-safe data; internal operational annotations never belong on public surfaces.
- Learning systems may propose/adapt only inside their declared authority. They cannot silently rewrite protected policy.

## AI architecture
Use specialized agents already registered in `server/kk-agent-registry.js`; do not create duplicates merely to rename a role.

Key families:
- discovery/source/commercial/verifier;
- storefront art direction, UX, conversion, fandom, accessibility, performance and visual critique;
- marketing/content/QA/selection;
- reliability learning and operating-partner decision support;
- optional external AI adapters behind explicit gates.

## Learning architecture
Observation -> evidence -> classification -> candidate lesson -> regression/acceptance -> human/governed review -> promotion to the correct durable layer.

Promotion targets:
- product invariant -> `PRODUCT.md`;
- visual/interaction invariant -> `DESIGN.md`;
- architecture/authority invariant -> `ARCHITECTURE.md`;
- done/release invariant -> `ACCEPTANCE.md`;
- operational recovery -> `RUNBOOK.md`;
- repeatable domain procedure -> `skills/*/SKILL.md`;
- executable regression -> tests/config/reliability memory.

Never promote an unverified workaround into durable memory.

## Runtime proof
Source, PR, CI, preview and production are distinct states. Production behavior must be proven by current deployment/runtime/readback evidence.
