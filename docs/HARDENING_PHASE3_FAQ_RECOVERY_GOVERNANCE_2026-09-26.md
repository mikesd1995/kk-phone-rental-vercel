# Hardening Phase 3 — FAQ SEO, Admin Recovery, Draft PR Governance — 2026-09-26

## Why this phase exists

Phase 2 closed the main P0/P1 gaps from the post-Smart-Ops audit: guarded Web Storage, operational health visibility, searchable Event controls, batch preflight, exact-safe event-card Undo, lead attribution, deduped search analytics, server-rendered Event social metadata, structured Organization/Service data, and scoped DEP0169 tracing.

This phase closes the remaining low-risk gaps without mutating customer or business data.

## Admin client recovery

Previously, client incidents received an `ADM-*` incident ID and a message telling the operator to refresh.

Phase 3 adds a dedicated recovery panel with **ลองโหลดข้อมูลใหม่**:

- retries the authenticated Admin snapshot first;
- preserves the current page/session when recovery succeeds;
- clears the recovery panel after a successful snapshot;
- falls back to full page reload only when no Admin session marker exists.

This reduces unnecessary full-page reloads and makes transient browser/client failures less disruptive.

## Web Storage guard verification

Regression coverage now asserts that direct `localStorage.getItem/setItem/removeItem` calls remain confined to the three guarded helper functions:

- `safeLocalGet`
- `safeLocalSet`
- `safeLocalRemove`

This protects against reintroducing the same browser-privacy bootstrap failure class.

## FAQ structured data

Homepage JSON-LD now includes `FAQPage` in the existing `@graph`, alongside Organization and Service.

The FAQ schema mirrors the eight FAQ questions already visible to customers in the page UI. No hidden promotional claims, ratings, fabricated location, or unsupported Event schema are added.

## Draft PR governance rule

Current-main operational rule:

- old draft PRs must not be merged directly when they have diverged from current `main`;
- clearly superseded UI/theme drafts should be closed;
- still-relevant experimental/control-plane drafts must be fresh-ported onto current `main` and revalidated before any merge;
- no draft PR is allowed to overwrite current Admin/storefront fixes merely because it predates them.

This phase records that rule durably. PR comments on retained old drafts should reference current-main divergence and require fresh-port review.

## External gates intentionally left unchanged

The following are not safe to invent or auto-fix:

- GA4 remains disabled until the owner supplies a real Measurement ID.
- Apps Script Project timezone and installed-trigger readiness remain CHECK until authenticated readback exists.
- No Sheet timezone/trigger mutation is performed.
- DEP0169 ownership remains evidence-driven; no dependency is changed merely to silence a warning.

## Production safety boundary

No existing Booking, Event, Package, price, Stock, Asset, Archive row, Sheet business value, Apps Script project setting, trigger, secret, or environment variable is mutated by this phase.

## DEP0169 root cause closed in source

The Phase 2 tracer produced bounded Production stack evidence:

- `kk-admin-snapshot-v6`: Vercel `IncomingMessage.get` -> `server/admin-session.js gateMode()`
- `kk-data`: Vercel `IncomingMessage.get` -> `api/kk-data.js` query parsing
- the deprecated `url.parse()` call itself is inside Vercel's `/opt/rust/nodejs.js` request-query getter, not repository source.

Phase 3 therefore removes direct runtime access to `req.query` from:

- `server/admin-session.js`
- `api/kk-data.js`
- `api/kk-scanner-dispatch.js`

Query parsing now uses the WHATWG `URL` API from `req.url`, with safe own-property compatibility for local/unit callers. Admin gate and Event share routes also have pathname fallbacks so rewrites remain fail-safe.

Production acceptance must verify the same Admin/public/Event-share requests no longer emit a new `KK_DEP0169_TRACE`.
