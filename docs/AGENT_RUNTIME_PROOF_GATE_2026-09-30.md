# Agent Runtime Proof Gate — 2026-09-30

KK Phone Rental does not treat a registry entry, prompt, document, or agent name as proof that an agent works.

A registered agent is eligible to be described as runtime-ready only when:
1. it is a required agent on at least one registered route;
2. at least one required route is runtime_available;
3. every required route demands persistent invocation evidence;
4. its executable route is covered by regression/acceptance evidence appropriate to its authority.

The registry exposes runtimeProofAudit(). CI fails when an agent is declared without a callable evidence-bearing required route.

This is a governance proof, not proof that every external dependency is currently healthy. Provider-gated agents remain provider-gated, disabled routes remain disabled, and production acceptance still requires live runtime/readback evidence.
