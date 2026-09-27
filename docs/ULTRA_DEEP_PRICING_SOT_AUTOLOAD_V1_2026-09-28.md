# Ultra Deep Pricing SOT Autoload V1 — 2026-09-28

Closes the remaining autonomous pricing plumbing gap.

For Agent Gateway task `resolve_final_pricing`, the authenticated Admin Guard now reads a fresh private snapshot and injects `03_Packages` templates into Final Pricing Policy V2.

Rules:
- explicit approved per-request baseline still has precedence;
- otherwise active `03_Packages.standard_price` rows are the authoritative KK standard-price fallback;
- inactive templates are excluded;
- competitor/comparable prices remain reference-only and never become final selling prices automatically;
- failure to read fresh SOT fails closed;
- Final Verifier, poster, duplicate guard, governed writer, Web Ready and readback remain required.

Live SOT observed during acceptance: Vivo X300 Pro 890, ZEISS lens 390, bundle 1090. Existing event-specific overrides remain authoritative for events that already have them.
