# Verifier Storefront Promotion V4 — 2026-09-28

## Owner policy now enforced

Storefront publication and competitor-price confidence are separate decisions.

- A verified event is not rejected merely because exact-event competitor pricing is absent.
- Rental-fit eligibility may advance the event to final Verifier when the owner-approved publish threshold passes.
- Final package prices still require an approved KK pricing policy; Scanner never writes final prices.
- Friday–Sunday events with zero exact-event competitor evidence may publish with the owner-approved score fallback, but the price is tagged `PROVISIONAL_NEEDS_PRICE_RECHECK` and must be revisited when Competitor Watch finds stronger evidence.
- Low rental-fit events are rejected as rental-fit decisions, not mislabeled as competitor-evidence failures.

## Governed promotion gate

`server/kk-verifier-storefront-promotion.js` prepares the existing Admin `createEvent` payload only when:
- commercial evidence status is `READY_FOR_FINAL_VERIFIER`;
- title/date/venue are complete;
- verified HTTPS poster evidence exists;
- either a pricing reference exists or rental-fit eligibility is explicitly passed with an approved final pricing policy;
- final KK package prices are resolved;
- final Verifier approval is true;
- owner publish policy allows publication.

The plan still requires duplicate guard and exact storefront readback.

## Owner-hidden protection

Existing Core events with `active_on_web=false` cannot be recreated or silently reopened by Verifier promotion.

- Without explicit owner intent: `OWNER_HIDDEN_REOPEN_PROHIBITED`.
- Even with explicit owner reopen intent, the create-event path is rejected with `OWNER_REOPEN_REQUIRES_EXISTING_EVENT_UPDATE`; reopening must use the existing-event Admin visibility path.

## Booking-close vs event-close

The existing storefront contract remains authoritative:

- close booking / hide all packages -> keep card visible as `show_full` / `เต็มแล้ว`;
- close event -> `active_on_web=false` -> card `hide`.

Verifier must not convert zero availability into an event close.

## Pricing policy

`server/kk-final-pricing-policy.js` resolves owner-approved rental-fit fallback tiers when exact competitor count is zero and the event meets the publish threshold:

- score >= 9.0 -> phone 890, lens 200 hidden, bundle 1,090;
- score >= 8.0 -> phone 790, lens 200 hidden, bundle 990;
- score >= 7.0 -> phone 690, lens 200 hidden, bundle 890.

For Friday–Sunday, these fallback prices are provisional and carry a mandatory recheck marker. Weekday score fallback remains an approved fallback under the current owner rule.

## Lens-only fail-closed guard

The Verifier create payload always forces standalone `TPL-ZEISS-2-35X-LENS` to `active_override=false`, even if an incoming final-price row tries to enable it.

The promotion readback verifier fails closed with `LENS_ONLY_VISIBLE_ON_CREATE` if a newly created event exposes the standalone lens package as `available` or `open`. Lens-only becomes eligible later only through the storefront inventory rule when the same event has an active phone-only booking and spare lens stock.

## Runtime boundary

The Scanner remains staging-only. The Verifier promotion planner remains `production_writes=0`. Actual mutation still goes through the authenticated governed Admin executor so duplicate/date guards, Apps Script locking, audit logging, lens-only package safety, and storefront readback remain in force.
