# Marketing Activation + Attribution Phase 1 — 2026-10-05

## Decision
Do not create a second discovery/pricing/storefront authority. Ultra Deep remains upstream business truth. The existing Marketing Agent and X posting-plan stack is retained.

Phase 1 adds only the missing contract:
**verified sellable event -> Marketing Queue -> owner review -> campaign identity -> attribution -> evidence nudge**.

## Marketing Queue contract
A phone-rental campaign is eligible only when event, pricing and storefront readiness are explicitly verified, the event is not owner-hidden/tombstoned, the owner has not blocked the date, and rentable inventory exists. Lens-only is represented explicitly and must never be presented as phone availability.

Required identity: canonical event_id + event_date. campaign_id is deterministic from event identity, date, channel and objective.

## Attribution contract
Canonical path:
X post -> storefront visit -> LINE conversation -> booking -> completed -> revenue.

Attribution is strict. Booking/revenue may be credited only when campaign_id and booking_id are explicitly linked. Timing proximity, same-day activity, event-name similarity or a LINE conversation alone are not sufficient attribution evidence.

Revenue semantics stay aligned with the locked dashboard rule:
- Actual = completed only.
- Future = pending / confirmed / prepared / picked_up / returned / uploaded.
- Forecast = Actual + Future.
- cancelled / no_show / blank are excluded.

## Learning boundary
Fewer than 3 measured campaigns remains RULE_BASED_COLD_START. With sufficient evidence, the module emits advisory priority nudges only. It cannot rewrite event truth, price, inventory, visibility or Machine SOT.

## Safety / rollout
Phase 1 is READ_ONLY_SHADOW. auto_publish=false, auto_spend=false, price_writes=false, inventory_writes=false, machine_sot_writes=false, production_writes=0. Owner approval remains mandatory.

Implementation may merge independently because it has no production action path. Activation beyond shadow mode is blocked until the canonical Ultra Deep V27 production deployment, READ_ONLY_ACCEPTANCE, Full Loop evidence and exact production/storefront readback are clean.

## Files
- server/kk-marketing-attribution.js
- tests/kk-marketing-attribution.test.js
- Issue #635
