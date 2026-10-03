# Storefront V6.18 — mobile typography normalization — 2026-10-03

Owner review found the mobile catalogue readable hierarchy too compressed, with several customer-facing labels at 9–11px.

## Change
Normalize mobile type without changing the two-column catalogue geometry: event title 14px, price 13.5px, date/venue/status/CTA around 12px, badges 11.5px, and lower-page/supporting copy 11–14px. <=359px receives a slightly tighter but still readable scale.

## Preserved
Poster/card geometry, two-column layout, V6.17 red full-state treatment, V6.16 exact modal scroll restoration, prices, inventory, booking, waitlist, availability, LINE and production-write semantics are unchanged.


## Production promotion follow-up
- Merge SHA: `b178b66745e7e142adb41d12e20ee220edafa811`.
- Git-triggered Vercel deployment did not materialize in the project deployment list on the first verification pass.
- No GitHub workflow runs were returned for the merge SHA on that pass.
- Attempted the available Vercel deploy action as fallback; the connector returned `Tool deploy_to_vercel not found`, so no duplicate/untracked deployment was created.
- Production must not be reported as V6.18 until a deployment for the merge SHA exists and the canonical domain serves the V6.18 marker.
