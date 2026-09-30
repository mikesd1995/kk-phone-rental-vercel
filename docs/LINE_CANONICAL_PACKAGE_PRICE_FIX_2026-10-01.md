# LINE Canonical Package Price Fix — 2026-10-01

## Incident
A customer-facing LINE Flex confirmation could show a bundle label such as `Vivo X300 Pro + Lens` while echoing a phone-only price such as `590 บาท`. The webhook trusted the price embedded in the customer prefill text.

## Root cause
`server/line-booking-webhook.js` parsed `package_name` and `price_display` from the incoming LINE message and passed both directly to the Flex renderer. The existing parser regression fixture even preserved a mismatched bundle/590 example, so parsing correctness was incorrectly acting as price correctness.

## Repair
- Resolve the event against public `08_Web_Ready` using exact normalized event name + venue.
- Resolve the selected package against canonical `09_Web_Packages` for that event.
- Derive package label by package type and use the canonical row price.
- Do not calculate lens markup in code; event-specific canonical prices remain authoritative.
- If the package cannot be resolved uniquely or has no positive canonical price, fail closed for customer display with `รอร้านตรวจสอบราคา` rather than echoing an untrusted client price.
- No Production Sheet/business data is mutated by this repair.

## Regression coverage
- Reproduces bundle label + stale phone-only price and expects canonical bundle price.
- Covers comma-formatted event-specific bundle price (1,290).
- Covers unresolved package fail-closed behavior.
- Existing parser compatibility remains retained; parsed input price is treated as input evidence, not canonical pricing.

## Acceptance
Pending CI, merge, Production deployment and runtime verification at time of this record.
