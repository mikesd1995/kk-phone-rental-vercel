# Zero-cost Unknown URL Search V1 — 2026-09-28

Ultra Deep now has a real SearXNG adapter for unknown-URL discovery. It is credential-free and binds through the existing Agent Router automatically, but activates only when KK_SEARXNG_ENDPOINT (or an injected searxng_endpoint) is an HTTPS endpoint.

The adapter sends a bounded search query, requires JSON results, emits HTTPS source URLs only, and remains evidence-only/non-authoritative. Missing endpoint returns no evidence so the provider executor continues fallback rather than pretending search succeeded.

This change does not provision or operate a SearXNG instance. Production acceptance still requires a reachable zero-cost endpoint and a live month scan. No business writes, pricing writes, scheduler changes or provider credentials are introduced.
