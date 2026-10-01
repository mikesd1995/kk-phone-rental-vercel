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
- Repair merged via PR #365 in commit `8e5afff18646bd55481f4378eeeab7a33c36e255`.
- Current main `7165976b8156a7c9605bf03127be131fe3e7dc3e` retains the repair.
- Admin Regression on current main completed successfully (run `36841417186`).
- Current READY Production deployment `dpl_FQ7vgbYRmktq9eAokkCxJY52QwFK` serves SHA `cd6ecd52ee252391c93f678100a107174cf226e8`.
- Git ancestry comparison proves that Production SHA is 15 commits ahead of the repair commit with zero commits behind it, so the canonical package-price repair is present in Production.
- Vercel runtime error clusters for `/api/line-webhook` reported no runtime errors in the checked 24-hour window.
- Regression coverage reproduces the incident directly: an incoming `Vivo X300 Pro + Lens` request carrying stale `590 บาท` resolves to the canonical bundle row and renders `890 บาท`; a separate event-specific `1,290` bundle case is also covered; unresolved/ambiguous package lookup fails closed to `รอร้านตรวจสอบราคา`.
- No Production Sheet, booking, pricing, inventory, or customer-message mutation was performed for acceptance.

### Residual evidence boundary
A direct live read of the public package feed could not be completed from the connected Vercel/web fetch surfaces in this acceptance session because the connector denied deployment access and the generic web fetch could not access the API query. This is recorded as an evidence-transport limitation, not as a runtime failure; no synthetic customer LINE message was sent to bypass it.
